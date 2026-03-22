/**
 * ChapterContext — story-driven chapter progression.
 *
 * Tracks which chapters are unlocked, the user's active chapter, which pages
 * have been completed, and their responses to reflect/discuss activities.
 *
 * ## Progressive unlocking
 *
 * Only Chapter 1 is unlocked on first launch. Completing all pages in a
 * chapter automatically unlocks the next. This mirrors CBT's progressive
 * exposure hierarchy — skills build on each other.
 *
 * ## Persistence
 *
 * Stored in AsyncStorage under `@chapter_progress_v1`. Failed reads fall
 * back to the default state (Chapter 1 unlocked, no progress).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHAPTERS, type ChapterDef, type PageDef } from "@/data/chapters";

const STORAGE_KEY = "@chapter_progress_v1";

// ── Types ──────────────────────────────────────────────────────────────

export type PageProgress = {
  completed: boolean;
  completedAt?: number;
  /** User's text response for reflect pages. */
  response?: string;
};

export type ChapterProgress = {
  unlocked: boolean;
  startedAt?: number;
  completedAt?: number;
  pages: Record<string, PageProgress>;
};

type StoryState = {
  activeChapterId: string;
  chapters: Record<string, ChapterProgress>;
  moodLog: Array<{ mood: string; timestamp: number; chapterId: string }>;
};

type ChapterContextValue = {
  /** Full progress state. */
  state: StoryState;
  /** The currently active chapter definition. */
  activeChapter: ChapterDef;
  /** Progress for the active chapter. */
  activeChapterProgress: ChapterProgress;
  /** Index of the next incomplete page in the active chapter (or last if all done). */
  activePageIndex: number;
  /** The next page definition to show on the Today screen. */
  activePage: PageDef;
  /** Total pages completed across all chapters. */
  totalPagesCompleted: number;
  /** Total pages across all chapters. */
  totalPages: number;
  /** How many pages are done in the active chapter. */
  activeChapterPagesCompleted: number;
  /** Whether the active chapter is fully complete. */
  isActiveChapterComplete: boolean;
  /** Mark a page as completed. Auto-advances and unlocks next chapter if needed. */
  completePage: (pageId: string, response?: string) => void;
  /** Set the active chapter (for resuming from the Story tab). */
  setActiveChapter: (chapterId: string) => void;
  /** Log a mood check-in. */
  logMood: (mood: string) => void;
  /** Check if a specific chapter is unlocked. */
  isChapterUnlocked: (chapterId: string) => boolean;
  /** Get progress for any chapter. */
  getChapterProgress: (chapterId: string) => ChapterProgress;
  /** Whether a chapter-complete celebration should show. */
  showCelebration: boolean;
  /** Dismiss the celebration. */
  dismissCelebration: () => void;
};

// ── Default state ──────────────────────────────────────────────────────

function buildDefaultState(): StoryState {
  const chapters: Record<string, ChapterProgress> = {};
  CHAPTERS.forEach((ch, idx) => {
    chapters[ch.id] = {
      unlocked: idx === 0,
      pages: {},
    };
  });
  return {
    activeChapterId: CHAPTERS[0].id,
    chapters,
    moodLog: [],
  };
}

const ChapterContext = createContext<ChapterContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────

export function ChapterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoryState>(buildDefaultState);
  const [showCelebration, setShowCelebration] = useState(false);

  // Load from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as StoryState;
            // Ensure all chapters exist in state (forward-compat)
            const merged = buildDefaultState();
            merged.activeChapterId = parsed.activeChapterId || CHAPTERS[0].id;
            merged.moodLog = parsed.moodLog || [];
            CHAPTERS.forEach((ch) => {
              if (parsed.chapters[ch.id]) {
                merged.chapters[ch.id] = parsed.chapters[ch.id];
              }
            });
            setState(merged);
          } catch {
            // corrupted — use defaults
          }
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: StoryState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // ── Derived values ─────────────────────────────────────────────────

  const activeChapter = useMemo(
    () =>
      CHAPTERS.find((c) => c.id === state.activeChapterId) ?? CHAPTERS[0],
    [state.activeChapterId]
  );

  const activeChapterProgress = useMemo(
    () =>
      state.chapters[activeChapter.id] ?? { unlocked: true, pages: {} },
    [state.chapters, activeChapter.id]
  );

  const activePageIndex = useMemo(() => {
    for (let i = 0; i < activeChapter.pages.length; i++) {
      const pp = activeChapterProgress.pages[activeChapter.pages[i].id];
      if (!pp?.completed) return i;
    }
    return activeChapter.pages.length - 1;
  }, [activeChapter, activeChapterProgress]);

  const activePage = activeChapter.pages[activePageIndex];

  const activeChapterPagesCompleted = useMemo(() => {
    return activeChapter.pages.filter(
      (p) => activeChapterProgress.pages[p.id]?.completed
    ).length;
  }, [activeChapter, activeChapterProgress]);

  const isActiveChapterComplete =
    activeChapterPagesCompleted >= activeChapter.pages.length;

  const { totalPagesCompleted, totalPages } = useMemo(() => {
    let completed = 0;
    let total = 0;
    CHAPTERS.forEach((ch) => {
      total += ch.pages.length;
      const cp = state.chapters[ch.id];
      if (cp) {
        completed += ch.pages.filter((p) => cp.pages[p.id]?.completed).length;
      }
    });
    return { totalPagesCompleted: completed, totalPages: total };
  }, [state.chapters]);

  // ── Actions ────────────────────────────────────────────────────────

  const completePage = useCallback(
    (pageId: string, response?: string) => {
      setState((prev) => {
        const chId = prev.activeChapterId;
        const chDef = CHAPTERS.find((c) => c.id === chId);
        if (!chDef) return prev;

        const cp = prev.chapters[chId] ?? { unlocked: true, pages: {} };
        const newPages = {
          ...cp.pages,
          [pageId]: {
            completed: true,
            completedAt: Date.now(),
            ...(response ? { response } : {}),
          },
        };

        const pagesCompleted = chDef.pages.filter(
          (p) => newPages[p.id]?.completed
        ).length;
        const chapterDone = pagesCompleted >= chDef.pages.length;

        const newChapters = { ...prev.chapters };
        newChapters[chId] = {
          ...cp,
          startedAt: cp.startedAt ?? Date.now(),
          pages: newPages,
          ...(chapterDone ? { completedAt: Date.now() } : {}),
        };

        // Unlock next chapter if this one is now complete
        let newActiveId = prev.activeChapterId;
        if (chapterDone) {
          const idx = CHAPTERS.findIndex((c) => c.id === chId);
          if (idx >= 0 && idx < CHAPTERS.length - 1) {
            const nextCh = CHAPTERS[idx + 1];
            newChapters[nextCh.id] = {
              ...newChapters[nextCh.id],
              unlocked: true,
            };
            newActiveId = nextCh.id;
          }
        }

        const next: StoryState = {
          ...prev,
          activeChapterId: newActiveId,
          chapters: newChapters,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(
          () => {}
        );

        // Show celebration on next render if chapter just completed
        if (chapterDone) {
          setTimeout(() => setShowCelebration(true), 300);
        }

        return next;
      });
    },
    []
  );

  const setActiveChapter = useCallback(
    (chapterId: string) => {
      setState((prev) => {
        if (!prev.chapters[chapterId]?.unlocked) return prev;
        const next = { ...prev, activeChapterId: chapterId };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(
          () => {}
        );
        return next;
      });
    },
    []
  );

  const logMood = useCallback(
    (mood: string) => {
      setState((prev) => {
        const entry = {
          mood,
          timestamp: Date.now(),
          chapterId: prev.activeChapterId,
        };
        const next = {
          ...prev,
          moodLog: [...prev.moodLog.slice(-200), entry],
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(
          () => {}
        );
        return next;
      });
    },
    []
  );

  const isChapterUnlocked = useCallback(
    (chapterId: string) => state.chapters[chapterId]?.unlocked ?? false,
    [state.chapters]
  );

  const getChapterProgress = useCallback(
    (chapterId: string): ChapterProgress =>
      state.chapters[chapterId] ?? { unlocked: false, pages: {} },
    [state.chapters]
  );

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  const value = useMemo<ChapterContextValue>(
    () => ({
      state,
      activeChapter,
      activeChapterProgress,
      activePageIndex,
      activePage,
      totalPagesCompleted,
      totalPages,
      activeChapterPagesCompleted,
      isActiveChapterComplete,
      completePage,
      setActiveChapter,
      logMood,
      isChapterUnlocked,
      getChapterProgress,
      showCelebration,
      dismissCelebration,
    }),
    [
      state,
      activeChapter,
      activeChapterProgress,
      activePageIndex,
      activePage,
      totalPagesCompleted,
      totalPages,
      activeChapterPagesCompleted,
      isActiveChapterComplete,
      completePage,
      setActiveChapter,
      logMood,
      isChapterUnlocked,
      getChapterProgress,
      showCelebration,
      dismissCelebration,
    ]
  );

  return (
    <ChapterContext.Provider value={value}>{children}</ChapterContext.Provider>
  );
}

export function useChapter(): ChapterContextValue {
  const ctx = useContext(ChapterContext);
  if (!ctx)
    throw new Error("useChapter must be used inside ChapterProvider");
  return ctx;
}
