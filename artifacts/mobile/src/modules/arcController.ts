import type { Analysis, CheckInState, Session, SessionPhase } from "@/src/types";

export const SESSION_CHECKIN_MINUTES = 20;

export const CHECKIN_PROMPTS = [
  "You've shared quite a lot - how are you feeling right now? We can keep going, or take a breath and reflect on what's come up.",
  "That's a lot to hold. Do you want to stay with this, or would it feel good to start finding your way out of it?",
  "We've gone somewhere real today. Do you want to keep exploring, or shall we start to bring this home?",
  "You've done some heavy lifting. Want to continue, or are you ready to ease off and see what you've uncovered?",
];

export type ArcState = Pick<Session, "sessionPhase" | "checkInState">;

export function evaluateArcState(
  session: Pick<Session, "createdAt" | "sessionPhase" | "checkInState">,
  analyses: Analysis[],
  nowMs = Date.now()
): ArcState {
  if (session.checkInState !== "none") {
    return {
      sessionPhase: session.sessionPhase,
      checkInState: session.checkInState,
    };
  }

  if (session.sessionPhase === "ascent") {
    return { sessionPhase: "ascent", checkInState: "continuing" };
  }

  const resolved = analyses
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => a.emotionalLoad ?? 0);
  const recent = resolved.slice(-3);
  const hasAcute = resolved.some((load) => load === 3);
  const netIncrease =
    recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
  const durationMinutes = (nowMs - session.createdAt) / (1000 * 60);

  const triggerRapidDescent = hasAcute || (recent.length === 3 && netIncrease >= 3);
  const triggerByDuration = durationMinutes >= SESSION_CHECKIN_MINUTES;

  if (triggerRapidDescent || triggerByDuration) {
    return { sessionPhase: "descent", checkInState: "pending" };
  }

  return { sessionPhase: "descent", checkInState: "none" };
}

export function applyCheckInChoice(
  choice: "continue" | "wrap"
): { sessionPhase: SessionPhase; checkInState: CheckInState } {
  if (choice === "continue") {
    return { sessionPhase: "ascent", checkInState: "continuing" };
  }
  return { sessionPhase: "ascent", checkInState: "wrapping" };
}

export function pickCheckInPrompt(random = Math.random): string {
  return CHECKIN_PROMPTS[Math.floor(random() * CHECKIN_PROMPTS.length)];
}
