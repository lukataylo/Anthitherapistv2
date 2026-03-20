import React, { useCallback, useEffect, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface LetterTumbleProps {
  word: string;
  onComplete: () => void;
}

const CELEBRATE_COLORS = [
  "#00FFFF",
  "#FF00FF",
  "#9B5CF6",
  "#FFE500",
  "#00E5A0",
  "#FF5B5B",
];

interface LetterState {
  randX: number;
  randY: number;
  randSize: number;
  randRot: number;
  targetX: number;
}

function AnimatedLetter({
  letter,
  color,
  letterState,
  index,
  onDone,
  isLast,
}: {
  letter: string;
  color: string;
  letterState: LetterState;
  index: number;
  onDone: () => void;
  isLast: boolean;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    x.value = withSpring(letterState.randX, { damping: 4, stiffness: 40 });
    y.value = withSpring(letterState.randY, { damping: 4, stiffness: 40 });
    scale.value = withSpring(letterState.randSize, { damping: 4, stiffness: 40 });
    rotate.value = withTiming(letterState.randRot, { duration: 600 });

    const convergeDelay = 900;

    x.value = withDelay(
      convergeDelay,
      withSpring(letterState.targetX, { damping: 14, stiffness: 120 })
    );
    y.value = withDelay(
      convergeDelay,
      withSpring(0, { damping: 14, stiffness: 120 })
    );
    scale.value = withDelay(
      convergeDelay,
      withSpring(1.8, { damping: 14, stiffness: 120 })
    );
    rotate.value = withDelay(
      convergeDelay,
      withTiming(0, { duration: 500 }, (finished) => {
        if (finished && isLast) {
          runOnJS(onDone)();
        }
      })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.letter, { color }, animStyle]}>
      {letter}
    </Animated.Text>
  );
}

export function LetterTumble({ word, onComplete }: LetterTumbleProps) {
  const letters = word.toUpperCase().split("");
  const [showFinalWord, setShowFinalWord] = useState(false);

  const letterWidth = 32;
  const totalWidth = letters.length * letterWidth;
  const startX = -totalWidth / 2;

  const letterStates: LetterState[] = letters.map((_, i) => ({
    randX: (Math.random() - 0.5) * SCREEN_W * 0.9,
    randY: (Math.random() - 0.5) * SCREEN_H * 0.7,
    randSize: 0.8 + Math.random() * 1.5,
    randRot: (Math.random() - 0.5) * 720,
    targetX: startX + i * letterWidth + letterWidth / 2,
  }));

  const handleConvergeDone = useCallback(() => {
    setShowFinalWord(true);
    setTimeout(onComplete, 800);
  }, [onComplete]);

  return (
    <View style={styles.container} pointerEvents="none">
      {letters.map((letter, i) => (
        <AnimatedLetter
          key={i}
          letter={letter}
          color={CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]}
          letterState={letterStates[i]}
          index={i}
          isLast={i === letters.length - 1}
          onDone={handleConvergeDone}
        />
      ))}
      {showFinalWord && (
        <View style={styles.glowWord}>
          <Text style={styles.finalWord}>{word.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,15,0.95)",
    zIndex: 100,
  },
  letter: {
    position: "absolute",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  glowWord: {
    alignItems: "center",
  },
  finalWord: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.success,
    letterSpacing: 4,
  },
});
