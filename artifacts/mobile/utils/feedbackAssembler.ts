import type { Turn, Analysis, FeedbackPayload, HighlightItem, PatternCategory } from '@/types/journal';
import { getPatternById } from './patternLibrary';

const SEVERITY_ORDER = { high: 0, med: 1, low: 2 } as const;

export function assembleFeedback(
  sessionId: string,
  turns: Turn[],
  analyses: Analysis[],
): FeedbackPayload {
  const analysisMap = new Map<string, Analysis>();
  for (const a of analyses) {
    analysisMap.set(a.turnId, a);
  }

  const matchedTextCount = new Map<string, number>();
  const rawHighlights: HighlightItem[] = [];

  for (const turn of turns) {
    for (const flag of turn.flags) {
      const pattern = getPatternById(flag.patternId);
      if (!pattern) continue;

      const key = flag.matchedText.toLowerCase();
      const count = matchedTextCount.get(key) ?? 0;
      if (count >= 2) continue;
      matchedTextCount.set(key, count + 1);

      rawHighlights.push({
        turnId: turn.id,
        quote: turn.rawText,
        matchedText: flag.matchedText,
        startIndex: flag.startIndex,
        endIndex: flag.endIndex,
        severity: flag.severity,
        category: flag.category,
        categoryLabel: pattern.categoryLabel,
        reframeHint: pattern.reframeHint,
      });
    }
  }

  const highlights = rawHighlights.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const reflectionPrompts: string[] = [];
  for (const turn of turns) {
    if (reflectionPrompts.length >= 3) break;
    const analysis = analysisMap.get(turn.id);
    if (analysis?.noteworthy && analysis.reflectionQuestion) {
      reflectionPrompts.push(analysis.reflectionQuestion);
    }
  }

  const totalFlags = highlights.length;
  const flagsBySeverity = { high: 0, med: 0, low: 0 };
  const flagsByCategory: Partial<Record<PatternCategory, number>> = {};

  for (const h of highlights) {
    flagsBySeverity[h.severity]++;
    flagsByCategory[h.category] = (flagsByCategory[h.category] ?? 0) + 1;
  }

  const dominantEmotionsSet = new Set<string>();
  const dominantEmotions: string[] = [];
  for (const turn of turns) {
    const analysis = analysisMap.get(turn.id);
    if (analysis?.dominantEmotion) {
      const e = analysis.dominantEmotion;
      if (!dominantEmotionsSet.has(e)) {
        dominantEmotionsSet.add(e);
        dominantEmotions.push(e);
      }
    }
  }

  return {
    sessionId,
    assembledAt: Date.now(),
    highlights,
    reflectionPrompts,
    totalFlags,
    flagsBySeverity,
    flagsByCategory,
    dominantEmotions,
  };
}
