/**
 * AnnotatedThought — renders the user's thought with distorted words
 * highlighted inline as tappable coloured chips.
 *
 * ## How word mapping works
 *
 * The API returns a `words` array in the same order as the words appear in
 * the thought, but the thought string itself may contain punctuation attached
 * to words (e.g. "failing," or "everything!"). A naive indexOf match would
 * miss those. Instead:
 *
 *  1. The thought is split on whitespace into `tokens` (raw display strings)
 *  2. Each token is "normalised" — lower-cased, punctuation stripped
 *  3. `buildTokenMap` tries to match each normalised token against the
 *     normalised form of each word in the `words` array, consuming matches
 *     greedily (the `used` flag prevents the same word from matching twice)
 *  4. The result is a `tokenMap` array of the same length as `tokens`, where
 *     each entry is either the matched word index or null (for unmatched tokens)
 *
 * This approach handles punctuation and repeated words correctly.
 *
 * ## Rendering states per token
 *
 *  - No match or "neutral" → plain white text
 *  - Matched significant word, already reframed → green highlighted chip
 *    showing the reframed text (or the original if the user skipped)
 *  - Matched significant word, not yet reframed → coloured chip (colour per
 *    distortion category) with an onPress handler to open the GamePanel
 *
 * ## Why Text-in-Text?
 *
 * Rendering as nested `<Text>` spans inside a single parent `<Text>` allows
 * the content to reflow naturally across multiple lines — something that's
 * impossible with an absolute-positioned Pressable approach.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { Colors } from "@/constants/colors";
import type { WordAnalysis } from "@/context/GameContext";

/** Background and foreground colour per distortion category. */
const CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = {
  belief:       { bg: Colors.beliefDim,       fg: Colors.belief },
  fear:         { bg: Colors.fearDim,         fg: Colors.fear },
  absolute:     { bg: Colors.absoluteDim,     fg: Colors.absolute },
  self_judgment:{ bg: Colors.self_judgmentDim,fg: Colors.self_judgment },
};

/**
 * Strip punctuation and lower-case a string for fuzzy matching.
 * Leading/trailing non-alphanumeric characters (except apostrophes within
 * contractions) are removed so "always," matches the API word "always".
 */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .replace(/'/g, "");
}

/**
 * Build a token-to-word-index map by matching each display token against the
 * `words` array. Each word is consumed at most once to handle repeated words
 * correctly (e.g. "never ever never" → three separate matches).
 *
 * @returns Array parallel to `tokens`; each entry is the matched word index
 *          or null if the token has no match in the word list.
 */
function buildTokenMap(tokens: string[], words: WordAnalysis[]): (number | null)[] {
  const available = words.map((w, i) => ({
    norm: normalize(w.word),
    idx: i,
    used: false,
  }));

  return tokens.map((raw) => {
    const norm = normalize(raw);
    if (!norm) return null;
    const hit = available.find((a) => !a.used && a.norm === norm);
    if (hit) {
      hit.used = true;
      return hit.idx;
    }
    return null;
  });
}

interface Props {
  thought: string;
  words: WordAnalysis[];
  reframedWords: Record<number, string>;
  onWordPress: (idx: number) => void;
}

export function AnnotatedThought({ thought, words, reframedWords, onWordPress }: Props) {
  const tokens = useMemo(() => thought.trim().split(/\s+/), [thought]);
  const tokenMap = useMemo(() => buildTokenMap(tokens, words), [tokens, words]);

  return (
    <Text style={styles.root}>
      {tokens.map((raw, ti) => {
        const wordIdx = tokenMap[ti];
        const word = wordIdx !== null ? words[wordIdx] : null;

        // Token has no match, or matched a neutral word — plain text
        if (!word || word.category === "neutral") {
          return (
            <Text key={ti} style={styles.plain}>
              {raw}{" "}
            </Text>
          );
        }

        // Word has been reframed or skipped — show the replacement in green
        const reframed = reframedWords[wordIdx as number];
        if (reframed !== undefined) {
          // If the stored reframe equals the original word, the user skipped;
          // display the original text rather than repeating it in the chip
          const display = reframed !== word.word ? reframed : raw;
          return (
            <Text key={ti} style={styles.reframed}>
              {display}{" "}
            </Text>
          );
        }

        // Significant word not yet reframed — coloured tappable chip
        const cat = CATEGORY_STYLE[word.category] ?? CATEGORY_STYLE.belief;
        return (
          <Text
            key={ti}
            style={[styles.highlight, { backgroundColor: cat.bg, color: cat.fg }]}
            onPress={() => onWordPress(wordIdx as number)}
            suppressHighlighting
          >
            {raw}{" "}
          </Text>
        );
      })}
    </Text>
  );
}

const FONT_SIZE = 32;
const LINE_H = 42;

const styles = StyleSheet.create({
  root: {
    fontSize: FONT_SIZE,
    fontFamily: "Inter_700Bold",
    lineHeight: LINE_H,
    letterSpacing: -0.5,
    color: "#fff",
  },
  plain: {
    color: "#fff",
  },
  highlight: {
    fontSize: FONT_SIZE,
    fontFamily: "Inter_700Bold",
    lineHeight: LINE_H,
    letterSpacing: -0.5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  reframed: {
    fontSize: FONT_SIZE,
    fontFamily: "Inter_700Bold",
    lineHeight: LINE_H,
    letterSpacing: -0.5,
    backgroundColor: Colors.successDim,
    color: Colors.success,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
});
