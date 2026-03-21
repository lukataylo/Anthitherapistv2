import { applyCheckInChoice, evaluateArcState, SESSION_CHECKIN_MINUTES } from "@/src/modules/arcController";
import type { Analysis, Session } from "@/src/types";

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: crypto.randomUUID(),
    turnId: crypto.randomUUID(),
    sessionId: "s1",
    createdAt: Date.now(),
    dominantEmotion: null,
    underlyingNeed: null,
    beliefDetected: null,
    distortionType: null,
    noteworthy: false,
    reflectionQuestion: null,
    emotionalLoad: 0,
    rawAnalysis: "{}",
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    createdAt: Date.now(),
    completedAt: null,
    moodOnOpen: "low",
    turnCount: 0,
    status: "active",
    feedbackPayload: null,
    sessionPhase: "descent",
    checkInState: "none",
    ...overrides,
  };
}

describe("arcController", () => {
  it("triggers pending on acute emotional load", () => {
    const session = makeSession();
    const analyses = [makeAnalysis({ emotionalLoad: 3 })];
    expect(evaluateArcState(session, analyses)).toEqual({
      sessionPhase: "descent",
      checkInState: "pending",
    });
  });

  it("triggers pending on rapid net increase", () => {
    const session = makeSession();
    const analyses = [
      makeAnalysis({ emotionalLoad: 0, createdAt: 1 }),
      makeAnalysis({ emotionalLoad: 1, createdAt: 2 }),
      makeAnalysis({ emotionalLoad: 3, createdAt: 3 }),
    ];
    expect(evaluateArcState(session, analyses)).toEqual({
      sessionPhase: "descent",
      checkInState: "pending",
    });
  });

  it("triggers by duration when threshold reached", () => {
    const now = Date.now();
    const started = now - SESSION_CHECKIN_MINUTES * 60 * 1000;
    const session = makeSession({ createdAt: started });
    expect(evaluateArcState(session, [], now)).toEqual({
      sessionPhase: "descent",
      checkInState: "pending",
    });
  });

  it("does not re-evaluate when check-in already started", () => {
    const session = makeSession({ checkInState: "shown" });
    const analyses = [makeAnalysis({ emotionalLoad: 3 })];
    expect(evaluateArcState(session, analyses)).toEqual({
      sessionPhase: "descent",
      checkInState: "shown",
    });
  });

  it("applies check-in choice correctly", () => {
    expect(applyCheckInChoice("continue")).toEqual({
      sessionPhase: "ascent",
      checkInState: "continuing",
    });
    expect(applyCheckInChoice("wrap")).toEqual({
      sessionPhase: "ascent",
      checkInState: "wrapping",
    });
  });
});
