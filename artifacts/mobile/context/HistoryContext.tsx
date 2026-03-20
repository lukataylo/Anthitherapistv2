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

const STORAGE_KEY = "reframe_history_v1";

export interface HistoryEntry {
  id: string;
  thought: string;
  words: WordAnalysis[];
  reframedWords: Record<number, string>;
  savedAt: number;
}

interface HistoryContextValue {
  entries: HistoryEntry[];
  addEntry: (thought: string, words: WordAnalysis[]) => string;
  updateEntry: (id: string, reframedWords: Record<number, string>) => void;
  removeEntry: (id: string) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as HistoryEntry[];
          setEntries(Array.isArray(parsed) ? parsed : []);
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);

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
        const next = [entry, ...prev].slice(0, 100);
        persist(next);
        return next;
      });
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
