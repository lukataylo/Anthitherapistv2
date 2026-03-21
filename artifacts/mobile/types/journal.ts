export type PatternCategory =
  | 'identity_fusion'
  | 'temporal_universalising'
  | 'social_universalising'
  | 'capability_foreclosure'
  | 'fixed_nature'
  | 'should_statement'
  | 'external_causation'
  | 'mind_reading'
  | 'fortune_telling'
  | 'minimisation'
  | 'self_dismissal'
  | 'unfavourable_comparison'
  | 'catastrophising';

export type PatternFlag = {
  matchedText: string;
  startIndex: number;
  endIndex: number;
  patternId: string;
  severity: 'high' | 'med' | 'low';
  category: PatternCategory;
};

export type Turn = {
  id: string;
  sessionId: string;
  index: number;
  timestamp: number;
  inputMode: 'text' | 'voice';
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

export type Session = {
  id: string;
  createdAt: number;
  completedAt: number | null;
  moodOnOpen: 'happy' | 'okay' | 'sad' | 'stressed' | 'angry';
  turnCount: number;
  status: 'active' | 'complete' | 'abandoned';
  feedbackPayload: FeedbackPayload | null;
  sessionPhase: 'descent' | 'ascent';
  checkInState: 'none' | 'pending' | 'shown' | 'continuing' | 'wrapping';
  ascentStartIndex: number | null;
};

export type HighlightItem = {
  turnId: string;
  quote: string;
  matchedText: string;
  startIndex: number;
  endIndex: number;
  severity: 'high' | 'med' | 'low';
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
