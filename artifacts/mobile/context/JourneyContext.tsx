/**
 * JourneyContext — persists journey progress across sessions.
 *
 * Tracks which journeys the user has started, which step they're on, and
 * their responses to each question. Data is stored in AsyncStorage under
 * the key `@journey_progress`.
 *
 * ## Shape
 *
 * ```
 * {
 *   [journeyId]: {
 *     currentStep: number;
 *     responses: Record<number, { text: string; answeredAt: number }>;
 *     startedAt: number;
 *     completedAt?: number;
 *   }
 * }
 * ```
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { JOURNEYS } from "@/data/journeys";

const STORAGE_KEY = "@journey_progress";

export type JourneyResponse = {
  text: string;
  answeredAt: number;
};

export type JourneyProgress = {
  currentStep: number;
  responses: Record<number, JourneyResponse>;
  startedAt: number;
  completedAt?: number;
};

type JourneyState = Record<string, JourneyProgress>;

type JourneyContextValue = {
  progress: JourneyState;
  getProgress: (journeyId: string) => JourneyProgress | undefined;
  submitResponse: (journeyId: string, stepIndex: number, text: string) => void;
  resetJourney: (journeyId: string) => void;
};

const JourneyContext = createContext<JourneyContextValue>({
  progress: {},
  getProgress: () => undefined,
  submitResponse: () => {},
  resetJourney: () => {},
});

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<JourneyState>({});

  // Load persisted progress on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setProgress(JSON.parse(raw));
        } catch {
          // corrupted — start fresh
        }
      }
    });
  }, []);

  // Persist whenever progress changes
  const persist = useCallback((next: JourneyState) => {
    setProgress(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const getProgress = useCallback(
    (journeyId: string) => progress[journeyId],
    [progress]
  );

  const submitResponse = useCallback(
    (journeyId: string, stepIndex: number, text: string) => {
      setProgress((prev) => {
        const journey = JOURNEYS.find((j) => j.id === journeyId);
        const existing = prev[journeyId] ?? {
          currentStep: 0,
          responses: {},
          startedAt: Date.now(),
        };

        const responses = {
          ...existing.responses,
          [stepIndex]: { text, answeredAt: Date.now() },
        };

        const nextStep = stepIndex + 1;
        const isComplete = journey ? nextStep >= journey.steps.length : false;

        const next: JourneyState = {
          ...prev,
          [journeyId]: {
            ...existing,
            currentStep: nextStep,
            responses,
            ...(isComplete ? { completedAt: Date.now() } : {}),
          },
        };

        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const resetJourney = useCallback(
    (journeyId: string) => {
      setProgress((prev) => {
        const next = { ...prev };
        delete next[journeyId];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  return (
    <JourneyContext.Provider
      value={{ progress, getProgress, submitResponse, resetJourney }}
    >
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  return useContext(JourneyContext);
}
