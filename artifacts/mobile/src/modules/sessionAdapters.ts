import type { Session } from "@/src/types";

export type LegacyWordCategory =
  | "neutral"
  | "belief"
  | "fear"
  | "absolute"
  | "self_judgment";

export type LegacyWordAnalysis = {
  word: string;
  category: LegacyWordCategory;
  reframes: string[];
  hint: string | null;
  fiftyFifty: string[];
  explainer: string | null;
};

export type SessionHistoryEntry = {
  id: string;
  thought: string;
  words: LegacyWordAnalysis[];
  reframedWords: Record<number, string>;
  savedAt: number;
  session?: Session;
};

function mapCategory(input: string): LegacyWordCategory {
  if (input === "mind_reading" || input === "fortune_telling" || input === "external_causation") {
    return "fear";
  }
  if (
    input === "identity_fusion" ||
    input === "fixed_nature" ||
    input === "self_dismissal" ||
    input === "unfavourable_comparison"
  ) {
    return "self_judgment";
  }
  if (
    input === "temporal_universalising" ||
    input === "social_universalising" ||
    input === "capability_foreclosure" ||
    input === "should_statement" ||
    input === "catastrophising"
  ) {
    return "absolute";
  }
  return "belief";
}

function thoughtFromSession(session: Session): string {
  if (session.archivedTurns && session.archivedTurns.length > 0) {
    return session.archivedTurns.map((t) => t.rawText).join(" ");
  }
  return "";
}

export function sessionToHistoryEntry(session: Session): SessionHistoryEntry {
  const highlights = session.feedbackPayload?.highlights ?? [];
  const words: LegacyWordAnalysis[] = highlights.map((h) => ({
    word: h.matchedText,
    category: mapCategory(h.category),
    reframes: [],
    hint: h.reframeHint || null,
    fiftyFifty: [],
    explainer: h.categoryLabel ? `Pattern: ${h.categoryLabel}` : null,
  }));
  return {
    id: session.id,
    thought: thoughtFromSession(session),
    words,
    reframedWords: {},
    savedAt: session.completedAt ?? session.createdAt,
    session,
  };
}
