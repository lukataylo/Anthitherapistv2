export type SessionPhase = "descent" | "ascent";

export type CheckInState =
  | "none"
  | "pending"
  | "shown"
  | "continuing"
  | "wrapping";

export type PatternCategory =
  | "identity_fusion"
  | "temporal_universalising"
  | "social_universalising"
  | "capability_foreclosure"
  | "fixed_nature"
  | "should_statement"
  | "external_causation"
  | "mind_reading"
  | "fortune_telling"
  | "minimisation"
  | "self_dismissal"
  | "unfavourable_comparison"
  | "catastrophising";

export type Severity = "high" | "med" | "low";

export type PatternFlag = {
  matchedText: string;
  startIndex: number;
  endIndex: number;
  patternId: string;
  severity: Severity;
  category: PatternCategory;
};

export type Turn = {
  id: string;
  sessionId: string;
  index: number;
  timestamp: number;
  inputMode: "text" | "voice";
  rawText: string;
  flags: PatternFlag[];
  analysisId: string | null;
};

export type Analysis = {
  id: string;
  turnId: string;
  sessionId: string;
  createdAt: number;
  dominantEmotion: string | null;
  underlyingNeed: string | null;
  beliefDetected: string | null;
  distortionType: string | null;
  noteworthy: boolean;
  reflectionQuestion: string | null;
  emotionalLoad: 0 | 1 | 2 | 3;
  rawAnalysis: string;
};

export type HighlightItem = {
  turnId: string;
  quote: string;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  severity: Severity;
  category: PatternCategory;
  categoryLabel: string;
  reframeHint: string;
};

export type FeedbackPayload = {
  sessionId: string;
  assembledAt: number;
  highlights: HighlightItem[];
  reflectionPrompts: string[];
  totalFlags: number;
  flagsBySeverity: { high: number; med: number; low: number };
  flagsByCategory: Partial<Record<PatternCategory, number>>;
  dominantEmotions: string[];
};

export type Session = {
  id: string;
  createdAt: number;
  completedAt: number | null;
  moodOnOpen: "good" | "low";
  turnCount: number;
  status: "active" | "complete" | "abandoned";
  feedbackPayload: FeedbackPayload | null;
  archivedTurns?: Turn[];
  archivedAnalyses?: Analysis[];
  sessionPhase: SessionPhase;
  checkInState: CheckInState;
};

export type Pattern = {
  id: string;
  category: PatternCategory;
  severity: Severity;
  regex: RegExp;
  categoryLabel: string;
  reframeHint: string;
  examples: string[];
};
