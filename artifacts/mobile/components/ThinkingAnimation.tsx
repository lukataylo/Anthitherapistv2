/**
 * ThinkingAnimation — orbital loading state during AI analysis.
 *
 * Displayed while the POST /api/reframe request is in-flight (typically
 * 2–5 seconds for Claude to process the thought and stream a response).
 *
 * ## Visual composition
 *
 * Three layers work together to suggest "the app is thinking":
 *
 *  1. **PulseRings** — three concentric rings that expand outward from the
 *     center and fade out simultaneously. Each ring begins at a different
 *     scale offset (`phaseScale`) so they appear to emanate in succession
 *     even though they loop simultaneously. This mimics a sonar/ripple effect.
 *
 *  2. **OrbCore** — a small glowing white sphere at the center that breathes
 *     (scales up/down on a 1.6 s cycle). A larger, softer glow disc behind it
 *     expands at 2.2× the core's scale to create a volumetric glow feel.
 *
 *  3. **OrbitalDots** — three coloured dots orbiting at different radii and
 *     speeds. They never share the same angular velocity, so the composition
 *     never repeats within a reasonable time window, keeping the animation
 *     feeling alive rather than mechanical.
 *
 * ## CyclingLabel
 *
 * The text below cycles through four messages every 2.2 seconds with a
 * 280 ms cross-fade (opacity 1→0→1). This is achieved with:
 *  - A `setInterval` that triggers the fade animation and schedules the text
 *    state change for 280 ms in (mid-fade), so the text swaps while it's
 *    invisible — the classic cross-fade trick.
 *  - Reanimated shared values for the opacity animation (runs off the JS
 *    thread for smooth results even when the JS thread is busy with the
 *    API request).
 *
 * ## Distortion category colours
 *
 * The three orbital dots and pulse rings use the four distortion category
 * colours (`Colors.fear`, `Colors.absolute`, `Colors.belief`). This is a
 * subtle thematic choice — the swirling categories represent the patterns
 * the AI is searching for in the user's thought.
 *
 * ## Why not a spinner?
 *
 * A spinner has an implied meaning of "making measurable progress toward a
 * known end". The AI response time is non-deterministic, so a spinner creates
 * false expectations. The orbital/pulse motif is perceived as "processing" or
 * "thinking" without implying a known duration.
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";

const MESSAGES = [
  "Reading your thought...",
  "Identifying patterns...",
  "Mapping the language...",
  "Almost there...",
];

/**
 * A concentric ring that expands outward and fades out repeatedly.
 * `phaseScale` staggers the starting scale so multiple rings appear to
 * emanate in sequence even when their loops are synchronised.
 */
function PulseRing({
  phaseScale,
  phaseOpacity,
  color,
  size,
}: {
  phaseScale: number;
  phaseOpacity: number;
  color: string;
  size: number;
}) {
  const scale = useSharedValue(phaseScale);
  const opacity = useSharedValue(phaseOpacity);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(2.0, { duration: 2400, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );
    // Opacity: snap back to `phaseOpacity` at start of each loop then fade out
    opacity.value = withRepeat(
      withSequence(
        withTiming(phaseOpacity, { duration: 0 }),
        withTiming(0, { duration: 2400, easing: Easing.out(Easing.cubic) })
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  );
}

/**
 * A dot orbiting the center at a fixed `radius` and `speed`.
 * The animation converts an ever-increasing angle value to X/Y coordinates
 * on the worklet thread (no JS involvement per frame), so the orbit runs
 * smoothly even when the JS thread is handling API callbacks.
 */
function OrbitalDot({
  radius,
  speed,
  angleOffset,
  color,
  size = 7,
}: {
  radius: number;
  speed: number;
  angleOffset: number;
  color: string;
  size?: number;
}) {
  const angle = useSharedValue(angleOffset);

  useEffect(() => {
    // Increment angle by 360° (one full revolution) per `speed` ms, looping forever
    angle.value = withRepeat(
      withTiming(angleOffset + 360, { duration: speed, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // Convert degrees to radians on the worklet thread to compute X/Y translation
  const style = useAnimatedStyle(() => {
    const rad = (angle.value * Math.PI) / 180;
    return {
      transform: [
        { translateX: Math.cos(rad) * radius },
        { translateY: Math.sin(rad) * radius },
      ],
    };
  });

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
 * The central breathing orb. Breathes on a 1.6 s cycle (scale 1 → 1.18 → 0.92).
 * A separate glow disc scales at 2.2× the core scale and stays behind it,
 * creating a soft volumetric halo without requiring a shadow or blur effect.
 */
function OrbCore() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.92, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * 2.2 }],
    opacity: 0.18,
  }));

  return (
    <View style={styles.orbWrap}>
      <Animated.View style={[styles.orbGlow, glowStyle]} />
      <Animated.View style={[styles.orbCore, coreStyle]} />
    </View>
  );
}

/**
 * Text below the orb that cycles through MESSAGES every 2.2 s.
 * The swap happens during a 280 ms fade-out so the text change is invisible.
 */
function CyclingLabel() {
  const [idx, setIdx] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    let pendingTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      // Start the fade-out, swap text at the midpoint, then fade back in
      opacity.value = withSequence(
        withTiming(0, { duration: 280 }),
        withTiming(1, { duration: 280 })
      );
      pendingTimeout = setTimeout(() => setIdx((i) => (i + 1) % MESSAGES.length), 280);
    }, 2200);
    return () => {
      clearInterval(interval);
      clearTimeout(pendingTimeout);
    };
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[styles.label, style]}>{MESSAGES[idx]}</Animated.Text>
  );
}

export function ThinkingAnimation() {
  return (
    <View style={styles.container}>
      <View style={styles.orbitArea}>
        {/* Three phase-staggered rings that expand outward from the center */}
        <PulseRing phaseScale={0.38} phaseOpacity={0.55} color={Colors.fear} size={88} />
        <PulseRing phaseScale={0.82} phaseOpacity={0.35} color={Colors.absolute} size={88} />
        <PulseRing phaseScale={1.28} phaseOpacity={0.18} color={Colors.belief} size={88} />

        <OrbCore />

        {/* Three dots at different radii and speeds — composition never repeats exactly */}
        <OrbitalDot radius={52} speed={2800} angleOffset={0}   color={Colors.fear}     size={8} />
        <OrbitalDot radius={38} speed={2000} angleOffset={120} color={Colors.absolute} size={6} />
        <OrbitalDot radius={62} speed={3800} angleOffset={240} color={Colors.belief}   size={5} />
      </View>

      <CyclingLabel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 44,
  },
  orbitArea: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  orbWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  orbGlow: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.fear,
  },
  orbCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  label: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
});
