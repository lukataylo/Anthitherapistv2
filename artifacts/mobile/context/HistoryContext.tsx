/**
 * HistoryContext — persistent log of past reframing sessions.
 *
 * Stores up to 100 history entries in AsyncStorage under a versioned key.
 * Each entry records the original thought, the full word analysis returned by
 * the AI, and a snapshot of which words the user has reframed so far.
 *
 * ## Persistence strategy
 *
 * The `loaded` ref acts as a guard: writes are unconditionally synchronised to
 * AsyncStorage via `persist()`, but we don't check `loaded` before writing
 * because we only write in response to explicit user actions (after load has
 * already completed). If storage reads fail, we silently fall back to an empty
 * list — the app remains functional, just without history.
 *
 * ## Entry lifecycle
 *
 * 1. `addEntry()` — called immediately when the API responds successfully.
 *    Creates an entry with an empty `reframedWords` map and returns the new id.
 * 2. `updateEntry()` — called by HomeScreen's useEffect whenever `reframedWords`
 *    changes in GameContext. Keeps the stored snapshot in sync as the user
 *    works through the session.
 * 3. `removeEntry()` — triggered by long-pressing an entry card in HistoryScreen.
 *    Confirms with an Alert before deleting.
 *
 * ## Entry cap
 *
 * `addEntry` slices the list to 100 entries (newest first) to prevent unbounded
 * storage growth. The user is unlikely to accumulate more than a hundred
 * reflections, and if they do, the oldest ones are quietly pruned.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WordAnalysis } from "@/context/GameContext";
import { sessionStore } from "@/src/modules/sessionStore";
import type { Session } from "@/src/types";

/** Versioned storage key — increment if the shape of HistoryEntry ever changes. */
const STORAGE_KEY = "temet_history_ui_adapter";

export interface HistoryEntry {
  id: string;
  thought: string;
  /** Full word analysis from the API, preserved so mini-games can use it. */
  words: WordAnalysis[];
  /** Map of word index → chosen reframe. Updated live as the user plays. */
  reframedWords: Record<number, string>;
  /** Unix timestamp (ms) when the entry was created. Used for "time ago" display. */
  savedAt: number;
}

interface HistoryContextValue {
  entries: HistoryEntry[];
  /** Create a new entry and return its id so GameContext can reference it. */
  addEntry: (thought: string, words: WordAnalysis[]) => string;
  /** Patch the reframedWords map on an existing entry. */
  updateEntry: (id: string, reframedWords: Record<number, string>) => void;
  removeEntry: (id: string) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

/**
 * Generates a simple collision-resistant id using timestamp + random suffix.
 * Avoids a uuid dependency for a non-critical use case.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  /** Tracks whether the initial AsyncStorage load has completed. */
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([sessionStore.loadFromStorage(), AsyncStorage.getItem(STORAGE_KEY)])
      .then(([, raw]) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as HistoryEntry[];
        // Guard against corrupted storage containing a non-array value
        setEntries(Array.isArray(parsed) ? parsed : []);
      })
      .catch(() => {
        // Storage read failures are silent — the app works without history
      })
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  /**
   * Write the current entries list to AsyncStorage. Called after every mutation
   * to keep storage in sync. Errors are silently swallowed — a failed write
   * means the change won't survive a restart, but the in-memory state remains
   * correct for the current session.
   */
  const persist = useCallback((next: HistoryEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addEntry = useCallback(
    (thought: string, words: WordAnalysis[]): string => {
      const id = generateId();
      const entry: HistoryEntry = {
        id,
        thought,
        words,
        reframedWords: {},
        savedAt: Date.now(),
      };
      setEntries((prev) => {
        // Prepend the new entry and cap the list at 100 to limit storage usage
        const next = [entry, ...prev].slice(0, 100);
        persist(next);
        return next;
      });
      const completedSession: Session = {
        id,
        createdAt: entry.savedAt,
        completedAt: entry.savedAt,
        moodOnOpen: "low",
        turnCount: words.length > 0 ? words.length : 1,
        status: "complete",
        feedbackPayload: null,
        sessionPhase: "descent",
        checkInState: "none",
      };
      void sessionStore.upsertCompletedSession(completedSession);
      return id;
    },
    [persist]
  );

  const updateEntry = useCallback(
    (id: string, reframedWords: Record<number, string>) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id ? { ...e, reframedWords } : e
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persist(next);
        return next;
      });
      void sessionStore.removeHistorySession(id);
    },
    [persist]
  );

  return (
    <HistoryContext.Provider value={{ entries, addEntry, updateEntry, removeEntry }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}
