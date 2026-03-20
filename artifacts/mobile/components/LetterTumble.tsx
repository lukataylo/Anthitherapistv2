import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
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
  "#FF9F0A",
  "#30D158",
];

const PARTICLE_COUNT = 18;

interface LetterState {
  randX: number;
  randY: number;
  randSize: number;
  randRot: number;
  targetX: number;
}

function Particle({
  color,
  angle,
  distance,
  size,
  delay,
}: {
  color: string;
  angle: number;
  distance: number;
  size: number;
  delay: number;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 280 })
    ));
    scale.value = withDelay(delay, withSequence(
      withSpring(1, { damping: 8, stiffness: 300 }),
      withTiming(0.3, { duration: 400 })
    ));
    x.value = withDelay(delay, withTiming(tx, { duration: 600, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(delay, withTiming(ty, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function AnimatedScatterLetter({
  letter,
  color,
  letterState,
  isLast,
  onDone,
}: {
  letter: string;
  color: string;
  letterState: LetterState;
  isLast: boolean;
  onDone: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 260 });
    x.value = withSpring(letterState.randX, { damping: 3, stiffness: 35 });
    y.value = withSpring(letterState.randY, { damping: 3, stiffness: 35 });
    scale.value = withSpring(letterState.randSize, { damping: 3, stiffness: 35 });
    rotate.value = withTiming(letterState.randRot, { duration: 600 });

    const CONVERGE = 900;

    x.value = withDelay(CONVERGE, withSpring(letterState.targetX, { damping: 16, stiffness: 140 }));
    y.value = withDelay(CONVERGE, withSpring(0, { damping: 16, stiffness: 140 }));
    scale.value = withDelay(CONVERGE, withSpring(1.6, { damping: 16, stiffness: 140 }));
    rotate.value = withDelay(CONVERGE, withTiming(0, { duration: 500 }, (finished) => {
      if (finished && isLast) runOnJS(onDone)();
    }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.scatterLetter, { color }, style]}>
      {letter}
    </Animated.Text>
  );
}

function FinalLetterReveal({
  letter,
  color,
  delay,
}: {
  letter: string;
  color: string;
  delay: number;
}) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-28);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 220 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 10, stiffness: 200 }));
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.finalLetter, { color }, style]}>
      {letter}
    </Animated.Text>
  );
}

export function LetterTumble({ word, onComplete }: LetterTumbleProps) {
  const letters = useMemo(() => word.toUpperCase().split(""), [word]);
  const [phase, setPhase] = useState<"scatter" | "burst" | "reveal">("scatter");

  const letterWidth = 34;
  const totalWidth = letters.length * letterWidth;
  const startX = -totalWidth / 2;

  const letterStates = useMemo<LetterState[]>(
    () =>
      letters.map((_, i) => ({
        randX: (Math.random() - 0.5) * SCREEN_W * 0.85,
        randY: (Math.random() - 0.5) * SCREEN_H * 0.65,
        randSize: 0.7 + Math.random() * 1.4,
        randRot: (Math.random() - 0.5) * 680,
        targetX: startX + i * letterWidth + letterWidth / 2,
      })),
    [word]
  );

  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      color: CELEBRATE_COLORS[i % CELEBRATE_COLORS.length],
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      distance: 55 + Math.random() * 80,
      size: 5 + Math.random() * 7,
    })),
    []
  );

  const handleConvergeDone = useCallback(() => {
    setPhase("burst");
    setTimeout(() => {
      setPhase("reveal");
      setTimeout(onComplete, letters.length * 70 + 600);
    }, 500);
  }, [onComplete, letters.length]);

  return (
    <View style={styles.container} pointerEvents="none">
      {phase === "scatter" &&
        letters.map((letter, i) => (
          <AnimatedScatterLetter
            key={i}
            letter={letter}
            color={CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]}
            letterState={letterStates[i]}
            isLast={i === letters.length - 1}
            onDone={handleConvergeDone}
          />
        ))}

      {(phase === "burst" || phase === "reveal") &&
        particles.map((p, i) => (
          <Particle
            key={i}
            color={p.color}
            angle={p.angle}
            distance={p.distance}
            size={p.size}
            delay={i * 12}
          />
        ))}

      {phase === "reveal" && (
        <View style={styles.finalRow}>
          {letters.map((letter, i) => (
            <FinalLetterReveal
              key={i}
              letter={letter}
              color={CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]}
              delay={i * 65}
            />
          ))}
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
    backgroundColor: "rgba(8,8,12,0.97)",
    zIndex: 100,
  },
  scatterLetter: {
    position: "absolute",
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  finalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  finalLetter: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
});
