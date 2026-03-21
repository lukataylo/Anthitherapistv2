import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { analyseTurn } from "@/src/modules/backgroundAnalyser";
import { applyCheckInChoice, pickCheckInPrompt } from "@/src/modules/arcController";
import { getNextPrompt } from "@/src/modules/promptRotator";
import { sessionStore } from "@/src/modules/sessionStore";
import type { Analysis, CheckInState, Session, Turn } from "@/src/types";

type RuntimeState = {
  session: Session | null;
  turns: Turn[];
  analyses: Analysis[];
  promptTrail: string[];
  checkInPrompt: string | null;
};

type SessionRuntimeContextValue = RuntimeState & {
  isActive: boolean;
  startSession: (mood: Session["moodOnOpen"]) => Promise<void>;
  submitTurn: (text: string, inputMode?: Turn["inputMode"]) => Promise<void>;
  chooseCheckIn: (choice: "continue" | "wrap") => Promise<void>;
  wrapSession: () => Promise<Session | null>;
  clearSession: () => Promise<void>;
  refreshFromStore: () => Promise<void>;
  lastPrompt: string | null;
};

const SessionRuntimeContext = createContext<SessionRuntimeContextValue | null>(null);

function lastAnalysisForTurn(turn: Turn, analyses: Analysis[]): Analysis | undefined {
  if (!turn.analysisId) return undefined;
  return analyses.find((a) => a.id === turn.analysisId);
}

export function SessionRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RuntimeState>({
    session: null,
    turns: [],
    analyses: [],
    promptTrail: [],
    checkInPrompt: null,
  });

  const refreshFromStore = useCallback(async () => {
    const next = await sessionStore.loadFromStorage();
    setState((s) => ({
      ...s,
      session: next.session,
      turns: next.turns,
      analyses: next.analyses,
    }));
  }, []);

  useEffect(() => {
    void refreshFromStore();
  }, [refreshFromStore]);

  const startSession = useCallback(async (mood: Session["moodOnOpen"]) => {
    await sessionStore.startSession(mood);
    const loaded = sessionStore.getState();
    setState({
      session: loaded.session,
      turns: loaded.turns,
      analyses: loaded.analyses,
      promptTrail: [],
      checkInPrompt: null,
    });
  }, []);

  const submitTurn = useCallback(
    async (text: string, inputMode: Turn["inputMode"] = "text") => {
      if (!text.trim()) return;
      if (!sessionStore.getState().session) {
        await startSession("low");
      }
      const turn = await sessionStore.addTurn(text.trim(), inputMode);
      const afterTurn = sessionStore.getState();
      const analysis = lastAnalysisForTurn(turn, afterTurn.analyses);
      const noteworthy = Boolean(analysis?.noteworthy);
      const phase = afterTurn.session?.sessionPhase ?? "descent";
      const nextPrompt = getNextPrompt(turn.index, noteworthy, phase);

      setState((s) => ({
        ...s,
        session: afterTurn.session,
        turns: afterTurn.turns,
        analyses: afterTurn.analyses,
        promptTrail: [...s.promptTrail, nextPrompt],
      }));

      void analyseTurn(turn).then(async (resolved) => {
        if (!resolved) return;
        await sessionStore.storeAnalysis(resolved);
        const latest = sessionStore.getState();
        let checkInPrompt: string | null = null;
        if (
          latest.session?.checkInState === "pending" &&
          (state.session?.checkInState === "none" || state.session?.checkInState === undefined)
        ) {
          checkInPrompt = pickCheckInPrompt();
        }
        setState((s) => ({
          ...s,
          session: latest.session,
          turns: latest.turns,
          analyses: latest.analyses,
          checkInPrompt: checkInPrompt ?? s.checkInPrompt,
        }));
      });
    },
    [startSession, state.session?.checkInState]
  );

  const chooseCheckIn = useCallback(async (choice: "continue" | "wrap") => {
    const current = sessionStore.getState();
    if (!current.session) return;
    const arc = applyCheckInChoice(choice);
    await sessionStore.setCheckInState(arc.sessionPhase, arc.checkInState as CheckInState);
    if (choice === "wrap") {
      await sessionStore.wrapSession();
      setState((s) => ({ ...s, session: null, turns: [], analyses: [], checkInPrompt: null }));
      return;
    }
    const next = sessionStore.getState();
    setState((s) => ({
      ...s,
      session: next.session,
      turns: next.turns,
      analyses: next.analyses,
      checkInPrompt: null,
    }));
  }, []);

  const wrapSession = useCallback(async () => {
    const completed = await sessionStore.wrapSession();
    setState((s) => ({ ...s, session: null, turns: [], analyses: [], checkInPrompt: null }));
    return completed;
  }, []);

  const clearSession = useCallback(async () => {
    await sessionStore.clearSession();
    setState((s) => ({ ...s, session: null, turns: [], analyses: [], promptTrail: [], checkInPrompt: null }));
  }, []);

  const value = useMemo<SessionRuntimeContextValue>(
    () => ({
      ...state,
      isActive: Boolean(state.session),
      startSession,
      submitTurn,
      chooseCheckIn,
      wrapSession,
      clearSession,
      refreshFromStore,
      lastPrompt: state.promptTrail.length > 0 ? state.promptTrail[state.promptTrail.length - 1] : null,
    }),
    [state, startSession, submitTurn, chooseCheckIn, wrapSession, clearSession, refreshFromStore]
  );

  return <SessionRuntimeContext.Provider value={value}>{children}</SessionRuntimeContext.Provider>;
}

export function useSessionRuntime(): SessionRuntimeContextValue {
  const ctx = useContext(SessionRuntimeContext);
  if (!ctx) throw new Error("useSessionRuntime must be used inside SessionRuntimeProvider");
  return ctx;
}
