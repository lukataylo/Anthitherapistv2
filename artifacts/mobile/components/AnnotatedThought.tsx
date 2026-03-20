import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";
import type { WordAnalysis } from "@/context/GameContext";

const CATEGORY_STYLE: Record<
  string,
  { bg: string; text: string }
> = {
  belief: { bg: Colors.beliefDim, text: Colors.belief },
  fear: { bg: Colors.fearDim, text: Colors.fear },
  absolute: { bg: Colors.absoluteDim, text: Colors.absolute },
  self_judgment: { bg: Colors.self_judgmentDim, text: Colors.self_judgment },
};

function matchToken(token: string, words: WordAnalysis[]): number {
  const normalized = token
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
  if (!normalized) return -1;
  const exact = words.findIndex((w) => w.word.toLowerCase() === normalized);
  if (exact >= 0) return exact;
  const stripped = normalized.replace(/'/g, "");
  return words.findIndex(
    (w) => w.word.toLowerCase().replace(/'/g, "") === stripped
  );
}

interface Props {
  thought: string;
  words: WordAnalysis[];
  reframedWords: Record<number, string>;
  onWordPress: (idx: number) => void;
}

export function AnnotatedThought({
  thought,
  words,
  reframedWords,
  onWordPress,
}: Props) {
  const tokens = thought.trim().split(/\s+/);

  return (
    <View style={styles.wrap}>
      {tokens.map((raw, ti) => {
        const wordIdx = matchToken(raw, words);
        const word = wordIdx >= 0 ? words[wordIdx] : null;

        if (!word || word.category === "neutral") {
          return (
            <Text key={ti} style={styles.plain}>
              {raw}
            </Text>
          );
        }

        const reframed = reframedWords[wordIdx];
        if (reframed !== undefined) {
          return (
            <View key={ti} style={[styles.chip, styles.reframedChip]}>
              <Text style={styles.reframedText} numberOfLines={2}>
                {reframed !== word.word ? reframed : raw}
              </Text>
            </View>
          );
        }

        const cat = CATEGORY_STYLE[word.category] ?? CATEGORY_STYLE.belief;
        return (
          <Pressable
            key={ti}
            onPress={() => onWordPress(wordIdx)}
            style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
          >
            <View style={[styles.chip, { backgroundColor: cat.bg }]}>
              <Text style={[styles.chipText, { color: cat.text }]}>{raw}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const FONT_SIZE = 30;
const LINE_HEIGHT = 40;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 5,
    rowGap: 8,
    alignContent: "flex-start",
  },
  plain: {
    fontSize: FONT_SIZE,
    fontFamily: "Inter_700Bold",
    lineHeight: LINE_HEIGHT,
    color: "rgba(255,255,255,0.72)",
    letterSpacing: -0.4,
  },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    justifyContent: "center",
  },
  chipText: {
    fontSize: FONT_SIZE,
    fontFamily: "Inter_700Bold",
    lineHeight: LINE_HEIGHT,
    letterSpacing: -0.4,
  },
  reframedChip: {
    backgroundColor: Colors.successDim,
    maxWidth: 260,
  },
  reframedText: {
    fontSize: FONT_SIZE,
    fontFamily: "Inter_700Bold",
    lineHeight: LINE_HEIGHT,
    letterSpacing: -0.4,
    color: Colors.success,
  },
});
