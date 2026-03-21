import { assembleFeedback } from "@/src/modules/feedbackAssembler";
import type { Analysis, Turn } from "@/src/types";

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: crypto.randomUUID(),
    sessionId: "s1",
    index: 0,
    timestamp: Date.now(),
    inputMode: "text",
    rawText: "I always fail",
    flags: [],
    analysisId: null,
    ...overrides,
  };
}

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

describe("assembleFeedback", () => {
  it("deduplicates repeated phrase beyond two occurrences", () => {
    const turns = [0, 1, 2].map((i) =>
      makeTurn({
        id: `t${i}`,
        index: i,
        flags: [
          {
            matchedText: "always",
            startIndex: 2,
            endIndex: 8,
            patternId: "temporal_universalising_always",
            severity: "high",
            category: "temporal_universalising",
          },
        ],
      })
    );
    const payload = assembleFeedback("s1", turns, []);
    expect(payload.highlights).toHaveLength(2);
  });

  it("sorts highlights by severity high-med-low", () => {
    const turn = makeTurn({
      flags: [
        {
          matchedText: "fine",
          startIndex: 0,
          endIndex: 4,
          patternId: "minimisation",
          severity: "low",
          category: "minimisation",
        },
        {
          matchedText: "always",
          startIndex: 5,
          endIndex: 11,
          patternId: "temporal_universalising_always",
          severity: "high",
          category: "temporal_universalising",
        },
        {
          matchedText: "should",
          startIndex: 12,
          endIndex: 18,
          patternId: "should_statement",
          severity: "med",
          category: "should_statement",
        },
      ],
    });
    const payload = assembleFeedback("s1", [turn], []);
    expect(payload.highlights.map((h) => h.severity)).toEqual(["high", "med", "low"]);
  });

  it("caps reflection prompts at 3 and returns immutable payload", () => {
    const analyses = [0, 1, 2, 3].map((i) =>
      makeAnalysis({
        noteworthy: true,
        reflectionQuestion: `q${i}`,
        dominantEmotion: i % 2 === 0 ? "fear" : "shame",
      })
    );
    const payload = assembleFeedback("s1", [makeTurn()], analyses);
    expect(payload.reflectionPrompts).toEqual(["q0", "q1", "q2"]);
    expect(payload.dominantEmotions).toEqual(["fear", "shame"]);
    expect(Object.isFrozen(payload)).toBe(true);
  });
});
