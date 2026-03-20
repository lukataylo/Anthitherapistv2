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

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  reflectedToday: boolean;
  recordReflection: () => void;
}

const defaultData: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastReflectionDate: null,
};

const StreakContext = createContext<StreakContextValue | null>(null);

function computeStreak(data: StreakData): StreakData {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const last = data.lastReflectionDate;

  if (last === today) return data;
  if (last === yesterday) return data;
  if (last !== null) {
    return { ...data, currentStreak: 0 };
  }
  return data;
}

export function StreakProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StreakData>(defaultData);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as StreakData;
          setData(computeStreak(parsed));
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: StreakData) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const recordReflection = useCallback(() => {
    const today = todayStr();
    const yesterday = yesterdayStr();

    setData((prev) => {
      if (prev.lastReflectionDate === today) return prev;

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
