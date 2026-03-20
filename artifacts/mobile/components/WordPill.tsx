import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
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
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [delay, scaleAnim]);

  useEffect(() => {
    if (!isNeutral && !isReframed && category !== "neutral") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      glow.start();
      return () => {
        pulse.stop();
        glow.stop();
      };
    }
  }, [isNeutral, isReframed, category, pulseAnim, glowAnim]);

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
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: isComplete
              ? Colors.successGlow
              : isSignificant
              ? CATEGORY_COLORS[category]
              : "transparent",
            opacity: isSignificant && !isComplete ? glowAnim : isComplete ? 0.5 : 0,
          },
        ]}
      />
      <Animated.View
        style={{ transform: [{ scale: isSignificant && !isComplete ? pulseAnim : 1 }] }}
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
      </Animated.View>
    </Animated.View>
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
