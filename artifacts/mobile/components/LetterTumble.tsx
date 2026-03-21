/**
 * LetterTumble — full-screen celebration animation for a successful reframe.
 *
 * Plays a three-phase animation sequence when the user successfully reframes
 * a distorted word:
 *
 *  Phase 1 — "scatter": each letter of the reframed word flies in from a random
 *    position on screen and then converges to a single line at the center.
 *    Letters bounce, rotate, and vary in size during the scatter phase, then
 *    snap together cleanly on convergence (after 900 ms).
 *
 *  Phase 2 — "burst": 18 colourful confetti particles explode outward from the
 *    center in a radial pattern. Particles use sine-based delays to stagger the
 *    burst effect. The burst lasts 500 ms.
 *
 *  Phase 3 — "reveal": each letter drops in individually from above, staggered
 *    by 65 ms per letter, in the app's celebration colour palette. After the last
 *    letter settles, `onComplete` is called to hand control back to GamePanel,
 *    which then records the reframed word in GameContext.
 *
 * ## Rendering strategy
 *
 * All three phases render absolute-positioned elements within a fullscreen
 * container (`pointerEvents="none"` so it doesn't block interaction). React's
 * conditional rendering switches between phases based on the `phase` state,
 * unmounting the previous phase's elements to keep the tree small.
 *
 * ## Letter positioning
 *
 * The `letterStates` memo computes each letter's scatter target and final
 * convergence X position once per `word` change. `startX` places the
 * converged word horizontally centered regardless of length.
 *
 * ## Why runOnJS?
 *
 * The `onDone` callback (triggered when the last letter finishes converging)
 * must run on the JS thread to call React state setters. `runOnJS` bridges
 * from the Reanimated worklet thread back to JS safely.
 */

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

/** Eight vivid celebration colours, cycled across letters and particles. */
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

/** Precomputed random values for a single letter's scatter/converge animation. */
interface LetterState {
  randX: number;     // Scatter target X offset from center
  randY: number;     // Scatter target Y offset from center
  randSize: number;  // Scale factor during scatter (0.7–2.1)
  randRot: number;   // Rotation in degrees during scatter
  targetX: number;   // Final X position in the converged word
}

/**
 * A single confetti particle that shoots outward from the center on mount.
 * Uses a radial trajectory computed from `angle` and `distance`, with a
 * staggered delay so particles don't all pop out simultaneously.
 */
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

    // Fade in quickly, stay visible during travel, then fade out
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 280 })
    ));
    // Pop in with spring, then shrink as it travels outward
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

/**
 * A single letter that scatters to a random position on screen, then
 * converges back to its final position in the word display.
 *
 * `isLast` + `onDone` trigger the phase transition when the last letter
 * completes its convergence animation.
 */
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
    // Scatter phase: spring to random position with low damping for bounciness
    x.value = withSpring(letterState.randX, { damping: 3, stiffness: 35 });
    y.value = withSpring(letterState.randY, { damping: 3, stiffness: 35 });
    scale.value = withSpring(letterState.randSize, { damping: 3, stiffness: 35 });
    rotate.value = withTiming(letterState.randRot, { duration: 600 });

    const CONVERGE = 900; // ms until convergence begins

    // Converge phase: snap to final position with higher damping for crispness
    x.value = withDelay(CONVERGE, withSpring(letterState.targetX, { damping: 16, stiffness: 140 }));
    y.value = withDelay(CONVERGE, withSpring(0, { damping: 16, stiffness: 140 }));
    scale.value = withDelay(CONVERGE, withSpring(1.6, { damping: 16, stiffness: 140 }));
    // Rotation callback fires onDone for the last letter only, bridging to JS thread
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

/**
 * A single letter in the final "reveal" phase — drops in from above
 * with a spring bounce, staggered by `delay` ms from the previous letter.
 */
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
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Fixed letter width used for computing convergence X positions
  const letterWidth = 34;
  const totalWidth = letters.length * letterWidth;
  // startX: offset for the first letter so the word is centered at x=0
  const startX = -totalWidth / 2;

  // Compute scatter/convergence params once per word
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

  // Compute particle positions once (not per word — particles are generic)
  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      color: CELEBRATE_COLORS[i % CELEBRATE_COLORS.length],
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      distance: 55 + Math.random() * 80,
      size: 5 + Math.random() * 7,
    })),
    []
  );

  /**
   * Triggered by the last letter completing convergence.
   * Transitions scatter → burst → reveal with timeouts, then calls onComplete.
   */
  const handleConvergeDone = useCallback(() => {
    setPhase("burst");
    const t1 = setTimeout(() => {
      setPhase("reveal");
      // Wait for all letters to drop in (stagger * count + settle time)
      const t2 = setTimeout(onComplete, letters.length * 70 + 600);
      timersRef.current.push(t2);
    }, 500);
    timersRef.current.push(t1);
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
