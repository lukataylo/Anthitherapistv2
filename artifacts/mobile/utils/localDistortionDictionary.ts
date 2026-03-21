/**
 * Local distortion dictionary for instant pattern matching.
 *
 * This module provides synchronous, on-device categorisation of distorted words
 * so the annotated cloud view can appear immediately after submission — before
 * the Claude API responds.
 *
 * ## Design
 *
 * Words are keyed by their normalised lowercase form. The lookup covers the
 * same vocabulary as the server-side system prompt plus common variants,
 * contractions, and inflected forms. The returned WordAnalysis objects have
 * their `reframes`, `hint`, `fiftyFifty`, and `explainer` fields left empty
 * — these are filled in once the LLM enrichment phase completes.
 *
 * ## Tokenisation
 *
 * The thought string is split on whitespace. Each token is stripped of leading
 * and trailing punctuation before the lookup. Tokens that don't match the
 * dictionary are classified as "neutral". Word order is preserved.
 */

import { WordAnalysis, WordCategory } from "@/context/GameContext";

/** Map of lowercase normalised word → distortion category */
const DISTORTION_DICT: Record<string, WordCategory> = {
  // ── absolute ─────────────────────────────────────────────────────────
  always: "absolute",
  never: "absolute",
  everyone: "absolute",
  everybody: "absolute",
  nobody: "absolute",
  everything: "absolute",
  nothing: "absolute",
  completely: "absolute",
  totally: "absolute",
  forever: "absolute",
  impossible: "absolute",
  every: "absolute",
  all: "absolute",
  none: "absolute",
  must: "absolute",
  constantly: "absolute",
  invariably: "absolute",
  absolutely: "absolute",
  certainly: "absolute",
  definitely: "absolute",
  literally: "absolute",
  undoubtedly: "absolute",
  inevitably: "absolute",
  entire: "absolute",
  entirely: "absolute",
  utterly: "absolute",
  universal: "absolute",
  universally: "absolute",
  pure: "absolute",
  purely: "absolute",
  perfectly: "absolute",
  perfect: "absolute",
  imperfect: "absolute",
  eternal: "absolute",

  // ── belief ───────────────────────────────────────────────────────────
  worthless: "belief",
  useless: "belief",
  stupid: "belief",
  incompetent: "belief",
  unlovable: "belief",
  unloveable: "belief",
  failure: "belief",
  failures: "belief",
  broken: "belief",
  hopeless: "belief",
  hopelessness: "belief",
  helpless: "belief",
  helplessness: "belief",
  weak: "belief",
  weakness: "belief",
  inadequate: "belief",
  inadequacy: "belief",
  inferior: "belief",
  inferiority: "belief",
  incapable: "belief",
  unworthy: "belief",
  damaged: "belief",
  defective: "belief",
  dumb: "belief",
  flawed: "belief",
  pointless: "belief",
  meaningless: "belief",

  // ── fear ─────────────────────────────────────────────────────────────
  afraid: "fear",
  scared: "fear",
  terrified: "fear",
  worried: "fear",
  worrying: "fear",
  worry: "fear",
  anxious: "fear",
  anxiety: "fear",
  dreading: "fear",
  dread: "fear",
  panic: "fear",
  panicking: "fear",
  fear: "fear",
  fearful: "fear",
  fearfully: "fear",
  nervous: "fear",
  stressed: "fear",
  stress: "fear",
  overwhelmed: "fear",
  overwhelming: "fear",
  threatened: "fear",
  horrified: "fear",
  terrifying: "fear",
  terrify: "fear",
  frightened: "fear",
  frighten: "fear",
  frightening: "fear",
  petrified: "fear",

  // ── self_judgment ────────────────────────────────────────────────────
  loser: "self_judgment",
  losers: "self_judgment",
  idiot: "self_judgment",
  fool: "self_judgment",
  pathetic: "self_judgment",
  disgusting: "self_judgment",
  disgusted: "self_judgment",
  repulsive: "self_judgment",
  horrible: "self_judgment",
  terrible: "self_judgment",
  awful: "self_judgment",
  hate: "self_judgment",
  hating: "self_judgment",
  despise: "self_judgment",
  despising: "self_judgment",
  detest: "self_judgment",
  shame: "self_judgment",
  shameful: "self_judgment",
  embarrassing: "self_judgment",
  embarrassed: "self_judgment",
  guilt: "self_judgment",
  guilty: "self_judgment",
  blame: "self_judgment",
  blaming: "self_judgment",
  unacceptable: "self_judgment",
  wrong: "self_judgment",
  bad: "self_judgment",
  evil: "self_judgment",
};

/**
 * Strip leading and trailing punctuation from a token so that e.g.
 * "always," or "(never)" match the dictionary correctly.
 */
function normalise(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
}

/**
 * Tokenise a raw thought string and classify each token using the local
 * distortion dictionary. Returns a full WordAnalysis[] with `reframes`,
 * `hint`, `fiftyFifty`, and `explainer` left empty — those are populated
 * by the LLM enrichment phase.
 */
export function categoriseLocally(thought: string): WordAnalysis[] {
  if (!thought.trim()) return [];

  const tokens = thought.split(/\s+/).filter(Boolean);

  return tokens.map((token) => {
    const key = normalise(token);
    const category: WordCategory = DISTORTION_DICT[key] ?? "neutral";

    return {
      word: token,
      category,
      reframes: [],
      hint: null,
      fiftyFifty: [],
      explainer: null,
    };
  });
}
