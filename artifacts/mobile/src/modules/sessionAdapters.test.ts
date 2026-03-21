import { sessionToHistoryEntry } from "@/src/modules/sessionAdapters";
import type { Session } from "@/src/types";

describe("sessionToHistoryEntry", () => {
  it("maps feedback highlights to legacy history shape", () => {
    const session: Session = {
      id: "s1",
      createdAt: 1,
      completedAt: 2,
      moodOnOpen: "low",
      turnCount: 1,
      status: "complete",
      sessionPhase: "descent",
      checkInState: "none",
      archivedTurns: [
        {
          id: "t1",
          sessionId: "s1",
          index: 0,
          timestamp: 1,
          inputMode: "text",
          rawText: "I always fail",
          flags: [],
          analysisId: null,
        },
      ],
      archivedAnalyses: [],
      feedbackPayload: {
        sessionId: "s1",
        assembledAt: 2,
        highlights: [
          {
            turnId: "t1",
            quote: "I always fail",
            matchedText: "always",
            startIndex: 2,
            endIndex: 8,
            severity: "high",
            category: "temporal_universalising",
            categoryLabel: "universalising",
            reframeHint: "Try sometimes.",
          },
        ],
        reflectionPrompts: [],
        totalFlags: 1,
        flagsBySeverity: { high: 1, med: 0, low: 0 },
        flagsByCategory: { temporal_universalising: 1 },
        dominantEmotions: [],
      },
    };

    const mapped = sessionToHistoryEntry(session);
    expect(mapped.id).toBe("s1");
    expect(mapped.thought).toContain("I always fail");
    expect(mapped.words).toHaveLength(1);
    expect(mapped.words[0].word).toBe("always");
    expect(mapped.words[0].hint).toBe("Try sometimes.");
    expect(mapped.savedAt).toBe(2);
  });
});
