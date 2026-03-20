import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { Colors } from "@/constants/colors";
import type { WordAnalysis } from "@/context/GameContext";

const CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = {
  belief:       { bg: Colors.beliefDim,       fg: Colors.belief },
  fear:         { bg: Colors.fearDim,         fg: Colors.fear },
  absolute:     { bg: Colors.absoluteDim,     fg: Colors.absolute },
  self_judgment:{ bg: Colors.self_judgmentDim,fg: Colors.self_judgment },
};

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .replace(/'/g, "");
}

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

        if (!word || word.category === "neutral") {
          return (
            <Text key={ti} style={styles.plain}>
              {raw}{" "}
            </Text>
          );
        }

        const reframed = reframedWords[wordIdx as number];
        if (reframed !== undefined) {
          const display = reframed !== word.word ? reframed : raw;
          return (
            <Text key={ti} style={styles.reframed}>
              {display}{" "}
            </Text>
          );
        }

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
