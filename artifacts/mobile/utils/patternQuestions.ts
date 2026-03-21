import type { PatternCategory, PatternFlag } from "@/types/journal";

type QuestionEntry = {
  questions: string[];
};

const CATEGORY_QUESTIONS: Record<PatternCategory, QuestionEntry> = {
  identity_fusion: {
    questions: [
      "Is this who you are, or how you feel right now?",
      "Would you describe a friend this way?",
      "When did you first start seeing yourself like this?",
    ],
  },
  temporal_universalising: {
    questions: [
      "Can you think of one time this wasn't true?",
      "What would 'sometimes' look like instead of 'always'?",
      "Has anything changed about this over time?",
    ],
  },
  social_universalising: {
    questions: [
      "Is this really everyone, or specific people?",
      "Who in your life doesn't fit this pattern?",
      "What would it mean if even one person felt differently?",
    ],
  },
  capability_foreclosure: {
    questions: [
      "What's the smallest version of this you could try?",
      "What would you need to feel ready?",
      "Has there been a time you surprised yourself?",
    ],
  },
  fixed_nature: {
    questions: [
      "What if this is a phase, not a fact?",
      "How were things different a year ago?",
      "What would changing this look like?",
    ],
  },
  should_statement: {
    questions: [
      "Whose voice is that 'should' coming from?",
      "What would you choose if 'should' wasn't in the picture?",
      "What happens if you replace 'should' with 'could'?",
    ],
  },
  external_causation: {
    questions: [
      "What part of this is within your control?",
      "Is there a small action you could take right now?",
      "What would change if you focused on what you can do?",
    ],
  },
  mind_reading: {
    questions: [
      "How do you know what they're thinking?",
      "What's the evidence for this?",
      "What else could they be feeling?",
    ],
  },
  fortune_telling: {
    questions: [
      "How certain are you this will happen?",
      "What's the best case scenario?",
      "Have your predictions been wrong before?",
    ],
  },
  minimisation: {
    questions: [
      "What if this matters more than you're giving it credit for?",
      "Would you minimise this if a friend told you?",
      "What would it feel like to take this seriously?",
    ],
  },
  self_dismissal: {
    questions: [
      "What are you protecting yourself from by dismissing this?",
      "What would it mean to let this matter?",
      "Is there something underneath this you're avoiding?",
    ],
  },
  unfavourable_comparison: {
    questions: [
      "What are you not seeing about your own situation?",
      "Is this a fair comparison?",
      "What would you tell someone comparing themselves to you?",
    ],
  },
  catastrophising: {
    questions: [
      "What's the most likely outcome — not the worst?",
      "How have you handled similar situations before?",
      "What would help you feel safer right now?",
    ],
  },
};

const GENERIC_OPENERS = [
  "What's underneath that feeling?",
  "Say more about that.",
  "What does this remind you of?",
  "How long have you been carrying this?",
  "What would feel different if this wasn't true?",
];

export function getPatternQuestion(
  flags: PatternFlag[],
  turnIndex: number,
): string | null {
  if (flags.length === 0) {
    return GENERIC_OPENERS[turnIndex % GENERIC_OPENERS.length];
  }
  const highSeverity = flags.find((f) => f.severity === "high");
  const target = highSeverity ?? flags[0];
  const entry = CATEGORY_QUESTIONS[target.category];
  if (!entry) return GENERIC_OPENERS[turnIndex % GENERIC_OPENERS.length];
  return entry.questions[turnIndex % entry.questions.length];
}
