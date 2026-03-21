import { getPatternById } from "@/src/modules/patternLibrary";
import type { Analysis, FeedbackPayload, HighlightItem, Turn } from "@/src/types";

const SEVERITY_ORDER = { high: 0, med: 1, low: 2 } as const;

export function assembleFeedback(
  sessionId: string,
  turns: Turn[],
  analyses: Analysis[]
): FeedbackPayload {
  const phraseCounts = new Map<string, number>();
  const highlights: HighlightItem[] = [];
  const flagsBySeverity = { high: 0, med: 0, low: 0 };
  const flagsByCategory: FeedbackPayload["flagsByCategory"] = {};
  let totalFlags = 0;

  for (const turn of turns) {
    for (const flag of turn.flags) {
      totalFlags += 1;
      flagsBySeverity[flag.severity] += 1;
      flagsByCategory[flag.category] = (flagsByCategory[flag.category] ?? 0) + 1;

      const key = flag.matchedText.toLowerCase();
      const seen = phraseCounts.get(key) ?? 0;
      phraseCounts.set(key, seen + 1);
      if (seen >= 2) continue;

      const pattern = getPatternById(flag.patternId);
      highlights.push({
        turnId: turn.id,
        quote: turn.rawText,
        matchedText: flag.matchedText,
        startIndex: flag.startIndex,
        endIndex: flag.endIndex,
        severity: flag.severity,
        category: flag.category,
        categoryLabel: pattern?.categoryLabel ?? flag.category,
        reframeHint: pattern?.reframeHint ?? "",
      });
    }
  }

  highlights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const reflectionPrompts = analyses
    .filter((analysis) => analysis.noteworthy && analysis.reflectionQuestion)
    .map((analysis) => analysis.reflectionQuestion as string)
    .slice(0, 3);

  const dominantEmotions = Array.from(
    new Set(
      analyses
        .map((analysis) => analysis.dominantEmotion)
        .filter((emotion): emotion is string => Boolean(emotion))
    )
  );

  const payload: FeedbackPayload = {
    sessionId,
    assembledAt: Date.now(),
    highlights,
    reflectionPrompts,
    totalFlags,
    flagsBySeverity,
    flagsByCategory,
    dominantEmotions,
  };

  return Object.freeze(payload);
}
