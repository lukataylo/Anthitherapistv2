/**
 * StreakContext — daily reflection streak tracking.
 *
 * Implements a classic "daily streak" mechanic: a counter that increments each
 * day the user submits at least one thought for reframing, and resets to zero
 * if they miss a day. This is a well-established behaviour-change technique
 * that reinforces the habit of daily self-reflection.
 *
 * ## State shape
 *
 * - `currentStreak`       — consecutive days of reflection up to today
 * - `longestStreak`       — all-time best streak (never decreases)
 * - `lastReflectionDate`  — ISO date string (YYYY-MM-DD) of the most recent
 *                           reflection, or null for new users
 *
 * ## Streak logic
 *
 * On `recordReflection()`:
 *   - If `lastReflectionDate` is today → no-op (streak already counted)
 *   - If `lastReflectionDate` is yesterday → `currentStreak + 1` (chain continues)
 *   - Otherwise → streak resets to 1 (chain broken or first ever reflection)
 *
 * On app startup, `computeStreak()` checks whether the streak has gone stale
 * (the user didn't reflect yesterday or today) and resets `currentStreak` to 0
 * so the display is always accurate even after a long absence.
 *
 * ## Why date strings rather than timestamps?
 *
 * Comparing ISO date strings ("2025-03-21") avoids timezone edge cases around
 * "same day" calculations that arise when comparing timestamps directly.
 *
 * ## Persistence
 *
 * Stored in AsyncStorage under a versioned key. A failed read silently falls
 * back to the default (zeroed) state — new users see streak = 0 correctly.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "reframe_streak_v1";

/** Returns today's date as an ISO date string (YYYY-MM-DD). */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns yesterday's date as an ISO date string. */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastReflectionDate: string | null;
}

interface StreakContextValue {
  currentStreak: number;
  longestStreak: number;
  /** True if the user has already reflected today — used to suppress the streak nudge. */
  reflectedToday: boolean;
  /** Call once per thought submitted. Idempotent within the same calendar day. */
  recordReflection: () => void;
}

const defaultData: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastReflectionDate: null,
};

const StreakContext = createContext<StreakContextValue | null>(null);

/**
 * Adjusts stored streak data to account for time that has passed since the
 * last app launch. Called once on load with the data from AsyncStorage.
 *
 * If the last reflection was today or yesterday, the streak is still valid and
 * data is returned unchanged. If the last reflection was earlier (or null for a
 * brand-new user), `currentStreak` is reset to 0.
 */
function computeStreak(data: StreakData): StreakData {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const last = data.lastReflectionDate;

  if (last === today) return data;       // Reflected today — streak is current
  if (last === yesterday) return data;   // Reflected yesterday — streak still valid
  if (last !== null) {
    // Last reflection was before yesterday — streak is broken
    return { ...data, currentStreak: 0 };
  }
  return data; // Brand-new user (null lastReflectionDate) — defaults are correct
}

export function StreakProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StreakData>(defaultData);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as StreakData;
          // Recalculate the streak in case days have passed since the last launch
          setData(computeStreak(parsed));
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: StreakData) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /**
   * Record a reflection for today. Idempotent — calling this multiple times
   * in the same day has no effect after the first call.
   */
  const recordReflection = useCallback(() => {
    const today = todayStr();
    const yesterday = yesterdayStr();

    setData((prev) => {
      // Guard against double-counting multiple reflections on the same day
      if (prev.lastReflectionDate === today) return prev;

      // Continue a chain if the user reflected yesterday, otherwise start fresh
      let newStreak = 1;
      if (prev.lastReflectionDate === yesterday) {
        newStreak = prev.currentStreak + 1;
      }

      const next: StreakData = {
        currentStreak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
        lastReflectionDate: today,
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const reflectedToday = data.lastReflectionDate === todayStr();

  return (
    <StreakContext.Provider
      value={{
        currentStreak: data.currentStreak,
        longestStreak: data.longestStreak,
        reflectedToday,
        recordReflection,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak(): StreakContextValue {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error("useStreak must be used inside StreakProvider");
  return ctx;
}
