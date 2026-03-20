import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
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

  const pillBg = isComplete ? Colors.successDim : CATEGORY_BG[effectiveCategory];
  const pillBorder = isComplete
    ? Colors.success
    : isSignificant
    ? CATEGORY_COLORS[category]
    : "transparent";
  const textColor = isComplete ? Colors.success : CATEGORY_TEXT[effectiveCategory];

  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.35);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 220 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 14, stiffness: 200 })
    );
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 10, stiffness: 200 })
    );
  }, [delay]);

  useEffect(() => {
    if (isSignificant && !isComplete) {
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.45, { duration: 1100, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 0 })
        ),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 0 }),
          withTiming(0, { duration: 1100, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [isSignificant, isComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    if (!isSignificant) return;
    pressScale.value = withSpring(0.92, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {isSignificant && !isComplete && (
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: CATEGORY_COLORS[category] },
            glowStyle,
          ]}
        />
      )}
      {isComplete && (
        <Animated.View
          style={[styles.glow, { backgroundColor: Colors.successGlow, opacity: 0.4 }]}
        />
      )}

      <Animated.View style={pressStyle}>
        <Pressable
          onPress={isSignificant ? onPress : undefined}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.pill,
            isNeutral && styles.pillNeutral,
            {
              backgroundColor: pillBg,
              borderColor: pillBorder,
              borderWidth: isSignificant || isComplete ? 1 : 0,
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
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 26,
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
