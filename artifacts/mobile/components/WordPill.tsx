import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { MotiView } from "moti";
import { Colors } from "@/constants/colors";
import type { WordCategory } from "@/context/GameContext";

interface WordPillProps {
  word: string;
  category: WordCategory;
  isReframed?: boolean;
  reframedWord?: string;
  onPress?: () => void;
  delay?: number;
  isNeutral?: boolean;
}

const CATEGORY_COLORS: Record<WordCategory, string> = {
  neutral: Colors.neutral,
  belief: Colors.belief,
  fear: Colors.fear,
  absolute: Colors.absolute,
  self_judgment: Colors.self_judgment,
};

const CATEGORY_TEXT: Record<WordCategory, string> = {
  neutral: Colors.neutralText,
  belief: Colors.belief,
  fear: Colors.fear,
  absolute: Colors.absolute,
  self_judgment: Colors.self_judgment,
};

const CATEGORY_BG: Record<WordCategory, string> = {
  neutral: Colors.neutral,
  belief: Colors.beliefDim,
  fear: Colors.fearDim,
  absolute: Colors.absoluteDim,
  self_judgment: Colors.self_judgmentDim,
};

export function WordPill({
  word,
  category,
  isReframed = false,
  reframedWord,
  onPress,
  delay = 0,
  isNeutral = false,
}: WordPillProps) {
  const displayWord = isReframed && reframedWord ? reframedWord : word;
  const effectiveCategory = isReframed ? "neutral" : category;
  const isSignificant = category !== "neutral" && !isReframed;
  const isComplete = isReframed;

  const pillBg = isComplete
    ? Colors.successDim
    : CATEGORY_BG[effectiveCategory];
  const pillBorder = isComplete
    ? Colors.success
    : isSignificant
    ? CATEGORY_COLORS[category]
    : "transparent";
  const textColor = isComplete
    ? Colors.success
    : CATEGORY_TEXT[effectiveCategory];

  return (
    <MotiView
      from={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        delay,
        damping: 12,
        stiffness: 160,
      }}
      style={styles.container}
    >
      {isSignificant && !isComplete && (
        <MotiView
          from={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{
            type: "timing",
            duration: 1200,
            loop: true,
            repeatReverse: true,
          }}
          style={[
            styles.glow,
            { backgroundColor: CATEGORY_COLORS[category] },
          ]}
        />
      )}
      {isComplete && (
        <MotiView
          style={[styles.glow, { backgroundColor: Colors.successGlow, opacity: 0.5 }]}
        />
      )}

      <MotiView
        from={{ scale: 1 }}
        animate={isSignificant && !isComplete ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={
          isSignificant && !isComplete
            ? { type: "timing", duration: 1200, loop: true, repeatReverse: false }
            : undefined
        }
      >
        <Pressable
          onPress={isSignificant ? onPress : undefined}
          style={({ pressed }) => [
            styles.pill,
            isNeutral && styles.pillNeutral,
            {
              backgroundColor: pillBg,
              borderColor: pillBorder,
              borderWidth: isSignificant || isComplete ? 1 : 0,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Text
            style={[
              styles.text,
              isNeutral && styles.textNeutral,
              { color: textColor },
            ]}
          >
            {displayWord}
          </Text>
        </Pressable>
      </MotiView>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 4,
    position: "relative",
  },
  glow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  textNeutral: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
