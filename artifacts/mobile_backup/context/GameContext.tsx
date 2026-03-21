/**
 * GameContext — active thought session state.
 *
 * This context owns everything related to the current in-progress reframing
 * session: the raw thought text, the AI-analysed word list, which words have
 * been reframed, and which screen the user is currently on.
 *
 * ## State shape
 *
 * - `screen`          — controls which UI layer is visible:
 *                         "capture" → text input
 *                         "cloud"   → annotated thought review
 *                         "game"    → the GamePanel bottom sheet for a single word
 * - `thought`         — the raw text the user typed
 * - `words`           — ordered list of WordAnalysis objects returned by the API,
 *                       one per word in `thought` (including neutral words)
 * - `reframedWords`   — map of word index → chosen reframe string. Populated
 *                       as the user works through the session. Persisted to
 *                       HistoryContext after each change via HomeScreen's useEffect.
 * - `activeWordIndex` — the index of the word currently open in the GamePanel,
 *                       or null when the panel is closed.
 *
 * ## Screen transitions
 *
 *   capture ─── setWords() ──────────────────────────► cloud
 *     ▲                                                  │
 *     └─── goToCapture() ──────────────────────────────  │
 *                                                        │
 *   cloud ──── openGame(idx) ───────────────────────► game
 *     ▲                                                  │
 *     └─── closeGame() / markReframed() / skipWord() ───┘
 *
 * ## Not persisted
 *
 * GameContext is intentionally session-only (no AsyncStorage). Persistence is
 * handled by HistoryContext, which stores completed entries. When the user
 * taps an entry in the History tab, `loadSession()` hydrates GameContext from
 * the saved entry so they can continue reframing.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

/** Four distortion categories assigned by Claude, plus "neutral". */
export type WordCategory =
  | "neutral"
  | "belief"
  | "fear"
  | "absolute"
  | "self_judgment";

/**
 * Single word as returned by the /api/reframe endpoint and stored in context.
 * See the API route documentation for field semantics.
 */
export interface WordAnalysis {
  word: string;
  category: WordCategory;
  reframes: string[];
  hint: string | null;
  fiftyFifty: string[];
  explainer: string | null;
}

/** The three screens the app can be on within the Home tab. */
export type AppScreen = "capture" | "cloud" | "game";

interface GameState {
  screen: AppScreen;
  thought: string;
  words: WordAnalysis[];
  /** Key: word index in the `words` array. Value: the chosen reframe string. */
  reframedWords: Record<number, string>;
  activeWordIndex: number | null;
}

interface GameContextValue extends GameState {
  setThought: (thought: string) => void;
  /** Called after the API responds successfully — loads words and transitions to "cloud". */
  setWords: (words: WordAnalysis[]) => void;
  /** Hydrate a past session from HistoryContext (used when tapping a history entry). */
  loadSession: (thought: string, words: WordAnalysis[], reframedWords: Record<number, string>) => void;
  /** Open the GamePanel for the word at the given index. */
  openGame: (wordIndex: number) => void;
  /** Close the GamePanel without recording a reframe (returns to "cloud"). */
  closeGame: () => void;
  /** Record a successful reframe and close the GamePanel. */
  markReframed: (wordIndex: number, reframedWord: string) => void;
  /**
   * Mark a word as skipped — stores the original word as the "reframe" so the
   * progress counter still advances and the word stops being tappable.
   */
  skipWord: (wordIndex: number) => void;
  /** Reset to the empty capture screen, clearing all session state. */
  goToCapture: () => void;
  /** Derived: words whose category is not "neutral" (the ones requiring reframing). */
  significantWords: WordAnalysis[];
  /** Derived: how many significant words have been reframed or skipped. */
  reframedCount: number;
  /** Derived: total number of significant words in the current session. */
  totalSignificant: number;
  /** Derived: true when every significant word has been reframed or skipped. */
  allDone: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>({
    screen: "capture",
    thought: "",
    words: [],
    reframedWords: {},
    activeWordIndex: null,
  });

  const setThought = useCallback((thought: string) => {
    setState((s) => ({ ...s, thought }));
  }, []);

  /**
   * Transition from capture to cloud after the API responds.
   * Clears any previous reframedWords so the new session starts clean.
   */
  const setWords = useCallback((words: WordAnalysis[]) => {
    setState((s) => ({
      ...s,
      words,
      reframedWords: {},
      screen: "cloud",
      activeWordIndex: null,
    }));
  }, []);

  /** Transition to the game screen for a specific word. */
  const openGame = useCallback((wordIndex: number) => {
    setState((s) => ({ ...s, activeWordIndex: wordIndex, screen: "game" }));
  }, []);

  /** Close the GamePanel, returning to the annotated thought view. */
  const closeGame = useCallback(() => {
    setState((s) => ({ ...s, activeWordIndex: null, screen: "cloud" }));
  }, []);

  /**
   * Record the user's chosen reframe for the active word, then close the panel.
   * The reframedWords map is also synced to HistoryContext by HomeScreen via a
   * useEffect that watches this value.
   */
  const markReframed = useCallback(
    (wordIndex: number, reframedWord: string) => {
      setState((s) => ({
        ...s,
        reframedWords: { ...s.reframedWords, [wordIndex]: reframedWord },
        activeWordIndex: null,
        screen: "cloud",
      }));
    },
    []
  );

  /**
   * Skip a word — store the original word text as its "reframe" so the progress
   * counter treats it as handled without actually changing the word in the display.
   */
  const skipWord = useCallback((wordIndex: number) => {
    setState((s) => ({
      ...s,
      reframedWords: {
        ...s.reframedWords,
        [wordIndex]: s.words[wordIndex]?.word ?? "",
      },
      activeWordIndex: null,
      screen: "cloud",
    }));
  }, []);

  /**
   * Restore a past session from HistoryContext so the user can continue
   * reframing words they haven't worked through yet.
   */
  const loadSession = useCallback(
    (thought: string, words: WordAnalysis[], reframedWords: Record<number, string>) => {
      setState({
        screen: "cloud",
        thought,
        words,
        reframedWords,
        activeWordIndex: null,
      });
    },
    []
  );

  /** Return to the empty capture screen, discarding the current session. */
  const goToCapture = useCallback(() => {
    setState({
      screen: "capture",
      thought: "",
      words: [],
      reframedWords: {},
      activeWordIndex: null,
    });
  }, []);

  // Derived values — computed outside render to avoid re-computation per render
  const significantWords = state.words.filter(
    (w) => w.category !== "neutral"
  );
  /**
   * Count only entries in reframedWords whose corresponding word is significant.
   * This guards against stale entries from a previous session bleeding through
   * if the words array was replaced.
   */
  const reframedCount = Object.keys(state.reframedWords).filter((idx) => {
    const word = state.words[Number(idx)];
    return word && word.category !== "neutral";
  }).length;
  const totalSignificant = significantWords.length;
  const allDone = totalSignificant > 0 && reframedCount >= totalSignificant;

  const value: GameContextValue = {
    ...state,
    setThought,
    setWords,
    loadSession,
    openGame,
    closeGame,
    markReframed,
    skipWord,
    goToCapture,
    significantWords,
    reframedCount,
    totalSignificant,
    allDone,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
