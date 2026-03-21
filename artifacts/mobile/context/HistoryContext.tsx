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

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { sessionStore } from "@/src/modules/sessionStore";
import type { Session } from "@/src/types";
import { sessionToHistoryEntry, type SessionHistoryEntry } from "@/src/modules/sessionAdapters";

export type HistoryEntry = SessionHistoryEntry;

interface HistoryContextValue {
  entries: SessionHistoryEntry[];
  sessions: Session[];
  refresh: () => Promise<void>;
  removeEntry: (id: string) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = useCallback(async () => {
    try {
      await sessionStore.loadFromStorage();
      const history = await sessionStore.getHistorySessions();
      setSessions(Array.isArray(history) ? history : []);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removeEntry = useCallback(
    (id: string) => {
      void sessionStore.removeHistorySession(id);
      setSessions((prev) => prev.filter((session) => session.id !== id));
    },
    []
  );

  const entries = sessions.map(sessionToHistoryEntry);

  return (
    <HistoryContext.Provider value={{ entries, sessions, refresh, removeEntry }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}
