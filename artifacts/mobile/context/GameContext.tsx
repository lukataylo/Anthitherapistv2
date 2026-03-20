import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export type WordCategory =
  | "neutral"
  | "belief"
  | "fear"
  | "absolute"
  | "self_judgment";

export interface WordAnalysis {
  word: string;
  category: WordCategory;
  reframes: string[];
  hint: string | null;
  fiftyFifty: string[];
  explainer: string | null;
}

export type AppScreen = "capture" | "cloud" | "game";

interface GameState {
  screen: AppScreen;
  thought: string;
  words: WordAnalysis[];
  reframedWords: Record<number, string>;
  activeWordIndex: number | null;
}

interface GameContextValue extends GameState {
  setThought: (thought: string) => void;
  setWords: (words: WordAnalysis[]) => void;
  openGame: (wordIndex: number) => void;
  closeGame: () => void;
  markReframed: (wordIndex: number, reframedWord: string) => void;
  skipWord: (wordIndex: number) => void;
  goToCapture: () => void;
  significantWords: WordAnalysis[];
  reframedCount: number;
  totalSignificant: number;
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

  const setWords = useCallback((words: WordAnalysis[]) => {
    setState((s) => ({
      ...s,
      words,
      reframedWords: {},
      screen: "cloud",
      activeWordIndex: null,
    }));
  }, []);

  const openGame = useCallback((wordIndex: number) => {
    setState((s) => ({ ...s, activeWordIndex: wordIndex, screen: "game" }));
  }, []);

  const closeGame = useCallback(() => {
    setState((s) => ({ ...s, activeWordIndex: null, screen: "cloud" }));
  }, []);

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

  const goToCapture = useCallback(() => {
    setState({
      screen: "capture",
      thought: "",
      words: [],
      reframedWords: {},
      activeWordIndex: null,
    });
  }, []);

  const significantWords = state.words.filter(
    (w) => w.category !== "neutral"
  );
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
