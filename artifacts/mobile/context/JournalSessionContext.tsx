import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, Turn, Analysis, FeedbackPayload } from '@/types/journal';
import { assembleFeedback } from '@/utils/feedbackAssembler';
import { computeArcState } from '@/utils/arcController';

const ACTIVE_SESSION_KEY = 'temet_active_session';
const ACTIVE_TURNS_KEY = 'temet_active_turns';
const ACTIVE_ANALYSES_KEY = 'temet_active_analyses';
const HISTORY_KEY = 'temet_session_history';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface JournalSessionState {
  session: Session | null;
  turns: Turn[];
  analyses: Analysis[];
}

interface JournalSessionContextValue extends JournalSessionState {
  startSession: (mood: Session['moodOnOpen']) => Session;
  addTurn: (rawText: string, flags?: Turn['flags'], sessionOverride?: Session) => Turn | null;
  storeAnalysis: (analysis: Analysis) => void;
  wrapSession: () => FeedbackPayload | null;
  clearSession: () => void;
  loadFromStorage: () => Promise<void>;
  acknowledgeCheckIn: (choice: 'continuing' | 'wrapping') => void;
  markCheckInShown: () => void;
}

const JournalSessionContext = createContext<JournalSessionContextValue | null>(null);

export function JournalSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<JournalSessionState>({
    session: null,
    turns: [],
    analyses: [],
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persistActive = useCallback(
    (session: Session | null, turns: Turn[], analyses: Analysis[]) => {
      if (!session) {
        AsyncStorage.multiRemove([ACTIVE_SESSION_KEY, ACTIVE_TURNS_KEY, ACTIVE_ANALYSES_KEY]).catch(() => {});
        return;
      }
      AsyncStorage.multiSet([
        [ACTIVE_SESSION_KEY, JSON.stringify(session)],
        [ACTIVE_TURNS_KEY, JSON.stringify(turns)],
        [ACTIVE_ANALYSES_KEY, JSON.stringify(analyses)],
      ]).catch(() => {});
    },
    [],
  );

  const loadFromStorage = useCallback(async () => {
    try {
      const [[, sessionRaw], [, turnsRaw], [, analysesRaw]] = await AsyncStorage.multiGet([
        ACTIVE_SESSION_KEY,
        ACTIVE_TURNS_KEY,
        ACTIVE_ANALYSES_KEY,
      ]);
      if (sessionRaw) {
        const session: Session = JSON.parse(sessionRaw);
        const turns: Turn[] = turnsRaw ? JSON.parse(turnsRaw) : [];
        const analyses: Analysis[] = analysesRaw ? JSON.parse(analysesRaw) : [];
        if (session.status === 'active') {
          setState({ session, turns, analyses });
        }
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const startSession = useCallback(
    (mood: Session['moodOnOpen']): Session => {
      const session: Session = {
        id: generateId(),
        createdAt: Date.now(),
        completedAt: null,
        moodOnOpen: mood,
        turnCount: 0,
        status: 'active',
        feedbackPayload: null,
        sessionPhase: 'descent',
        checkInState: 'none',
        ascentStartIndex: null,
      };
      setState(() => ({ session, turns: [], analyses: [] }));
      persistActive(session, [], []);
      return session;
    },
    [persistActive],
  );

  const addTurn = useCallback(
    (rawText: string, flags: Turn['flags'] = [], sessionOverride?: Session): Turn | null => {
      let createdTurn: Turn | null = null;
      setState((prev) => {
        const activeSession = sessionOverride ?? prev.session;
        if (!activeSession) return prev;
        const baseTurns = sessionOverride ? [] : prev.turns;
        const turn: Turn = {
          id: generateId(),
          sessionId: activeSession.id,
          index: baseTurns.length,
          timestamp: Date.now(),
          inputMode: 'text',
          rawText,
          flags,
          analysisId: null,
        };
        createdTurn = turn;
        const nextTurns = [...baseTurns, turn];
        const nextSession: Session = { ...activeSession, turnCount: nextTurns.length };
        const nextAnalyses = sessionOverride ? [] : prev.analyses;
        persistActive(nextSession, nextTurns, nextAnalyses);
        return { session: nextSession, turns: nextTurns, analyses: nextAnalyses };
      });
      return createdTurn;
    },
    [persistActive],
  );

  const storeAnalysis = useCallback(
    (analysis: Analysis) => {
      setState((prev) => {
        if (!prev.session) return prev;
        const nextAnalyses = [...prev.analyses, analysis];
        const nextTurns = prev.turns.map((t) =>
          t.id === analysis.turnId ? { ...t, analysisId: analysis.id } : t,
        );

        const arcState = computeArcState(prev.session, nextAnalyses, nextTurns);
        const nextSession: Session = { ...prev.session, ...arcState };

        persistActive(nextSession, nextTurns, nextAnalyses);
        return { session: nextSession, turns: nextTurns, analyses: nextAnalyses };
      });
    },
    [persistActive],
  );

  const markCheckInShown = useCallback(() => {
    setState((prev) => {
      if (!prev.session) return prev;
      const nextSession: Session = { ...prev.session, checkInState: 'shown' };
      persistActive(nextSession, prev.turns, prev.analyses);
      return { ...prev, session: nextSession };
    });
  }, [persistActive]);

  const acknowledgeCheckIn = useCallback(
    (choice: 'continuing' | 'wrapping') => {
      setState((prev) => {
        if (!prev.session) return prev;
        const nextSession: Session = {
          ...prev.session,
          checkInState: choice,
          sessionPhase: choice === 'continuing' ? 'ascent' : prev.session.sessionPhase,
          ascentStartIndex: choice === 'continuing' ? prev.turns.length : prev.session.ascentStartIndex,
        };
        persistActive(nextSession, prev.turns, prev.analyses);
        return { ...prev, session: nextSession };
      });
    },
    [persistActive],
  );

  const wrapSession = useCallback((): FeedbackPayload | null => {
    const current = stateRef.current;
    if (!current.session) return null;
    const payload = assembleFeedback(current.session.id, current.turns, current.analyses);
    const completedSession: Session = {
      ...current.session,
      status: 'complete',
      completedAt: Date.now(),
      feedbackPayload: payload,
    };
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        const history: Session[] = raw ? JSON.parse(raw) : [];
        return AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([completedSession, ...history]));
      })
      .catch(() => {});
    AsyncStorage.multiRemove([ACTIVE_SESSION_KEY, ACTIVE_TURNS_KEY, ACTIVE_ANALYSES_KEY]).catch(() => {});
    setState({ session: null, turns: [], analyses: [] });
    return payload;
  }, []);

  const clearSession = useCallback(() => {
    setState({ session: null, turns: [], analyses: [] });
    AsyncStorage.multiRemove([ACTIVE_SESSION_KEY, ACTIVE_TURNS_KEY, ACTIVE_ANALYSES_KEY]).catch(() => {});
  }, []);

  const value: JournalSessionContextValue = {
    ...state,
    startSession,
    addTurn,
    storeAnalysis,
    wrapSession,
    clearSession,
    loadFromStorage,
    acknowledgeCheckIn,
    markCheckInShown,
  };

  return (
    <JournalSessionContext.Provider value={value}>
      {children}
    </JournalSessionContext.Provider>
  );
}

export function useJournalSession(): JournalSessionContextValue {
  const ctx = useContext(JournalSessionContext);
  if (!ctx) throw new Error('useJournalSession must be used inside JournalSessionProvider');
  return ctx;
}
