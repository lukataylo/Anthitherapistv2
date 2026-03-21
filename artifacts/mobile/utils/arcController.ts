import type { Session, Analysis, Turn } from '@/types/journal';
import { cumulativeEmotionalScore, CHECKIN_THRESHOLD } from '@/utils/emotionalScoring';

type ArcState = {
  sessionPhase: Session['sessionPhase'];
  checkInState: Session['checkInState'];
};

export function computeArcState(
  session: Session,
  analyses: Analysis[],
  turns?: Turn[],
): ArcState {
  const { sessionPhase, checkInState } = session;

  if (checkInState !== 'none') {
    return { sessionPhase, checkInState };
  }

  let triggered = false;

  if (turns && turns.length >= 3) {
    const emotionalScore = cumulativeEmotionalScore(turns);
    if (emotionalScore >= CHECKIN_THRESHOLD) {
      triggered = true;
    }
  }

  if (!triggered) {
    const sorted = [...analyses].sort((a, b) => a.createdAt - b.createdAt);
    const loads = sorted.map((a) => a.emotionalLoad);
    const recent = loads.slice(-3);
    if (recent.some((l) => l === 3)) {
      triggered = true;
    }
  }

  if (triggered) {
    return { sessionPhase, checkInState: 'pending' };
  }

  return { sessionPhase, checkInState };
}
