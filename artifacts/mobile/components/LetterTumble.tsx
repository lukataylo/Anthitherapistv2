/**
 * LetterTumble — full-screen celebration animation for a successful reframe.
 *
 * Plays a single unified animation when the user successfully reframes a word:
 * the reframed word scales in boldly from center with a spring (with a glow
 * pulse effect), while confetti particles burst outward radially — all
 * simultaneously, with zero delay. `onComplete` is called after ~1.2s total.
 *
 * ## Component API
 * Props: `word` (string), `onComplete` (() => void) — unchanged from prior version.
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

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

const PARTICLE_COUNT = 24;

/**
 * A single confetti particle that shoots outward radially from center on mount.
 * All particles fire simultaneously (no stagger) for a crisp radial burst.
 */
function Particle({
  color,
  angle,
  distance,
  size,
}: {
  color: string;
  angle: number;
  distance: number;
  size: number;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    opacity.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(1, { duration: 700 }),
      withTiming(0, { duration: 240 })
    );
    scale.value = withSequence(
      withSpring(1.2, { damping: 6, stiffness: 400 }),
      withTiming(0.4, { duration: 700 })
    );
    x.value = withTiming(tx, { duration: 900, easing: Easing.out(Easing.cubic) });
    y.value = withTiming(ty, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const isRect = size % 2 === 0;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: isRect ? size * 0.45 : size,
          borderRadius: isRect ? 2 : size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * The reframed word rendered as a row of colored letters.
 * Scales up boldly from center with a spring, then pulses gently to signal
 * arrival. `onDone` fires after ~1.2s, bridged back to the JS thread.
 */
function WordReveal({
  letters,
  onDone,
}: {
  letters: string[];
  onDone: () => void;
}) {
  const scale = useSharedValue(0.1);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 120 });

    scale.value = withSequence(
      withSpring(1.18, { damping: 9, stiffness: 260 }),
      withTiming(1.0, { duration: 250, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );

    glow.value = withDelay(
      150,
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.6, { duration: 300 }),
        withTiming(1, { duration: 250 })
      )
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.wordRow, containerStyle]}>
      {letters.map((letter, i) => (
        <GlowLetter
          key={i}
          letter={letter}
          color={CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]}
          glowShared={glow}
        />
      ))}
    </Animated.View>
  );
}

function GlowLetter({
  letter,
  color,
  glowShared,
}: {
  letter: string;
  color: string;
  glowShared: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    textShadowRadius: glowShared.value * 18,
    opacity: 0.85 + glowShared.value * 0.15,
  }));

  return (
    <Animated.Text style={[styles.wordLetter, { color, textShadowColor: color }, style]}>
      {letter}
    </Animated.Text>
  );
}

export function LetterTumble({ word, onComplete }: LetterTumbleProps) {
  const letters = useMemo(() => word.toUpperCase().split(""), [word]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const sizeVal = 6 + Math.floor(Math.random() * 9);
      return {
        color: CELEBRATE_COLORS[i % CELEBRATE_COLORS.length],
        angle,
        distance: 70 + Math.random() * 110,
        size: sizeVal % 2 === 0 ? sizeVal : sizeVal + 1,
      };
    }),
    []
  );

  const handleWordDone = useCallback(() => {
    timerRef.current = setTimeout(onComplete, 180);
  }, [onComplete]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle
          key={i}
          color={p.color}
          angle={p.angle}
          distance={p.distance}
          size={p.size}
        />
      ))}

      <WordReveal letters={letters} onDone={handleWordDone} />
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
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  wordLetter: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
});
