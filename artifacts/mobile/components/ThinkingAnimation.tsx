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
    angle.value = withRepeat(
      withTiming(angleOffset + 360, { duration: speed, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

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

function CyclingLabel() {
  const [idx, setIdx] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: 280 }),
        withTiming(1, { duration: 280 })
      );
      setTimeout(() => setIdx((i) => (i + 1) % MESSAGES.length), 280);
    }, 2200);
    return () => clearInterval(interval);
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
        <PulseRing phaseScale={0.38} phaseOpacity={0.55} color={Colors.fear} size={88} />
        <PulseRing phaseScale={0.82} phaseOpacity={0.35} color={Colors.absolute} size={88} />
        <PulseRing phaseScale={1.28} phaseOpacity={0.18} color={Colors.belief} size={88} />

        <OrbCore />

        <OrbitalDot radius={52} speed={2800} angleOffset={0} color={Colors.fear} size={8} />
        <OrbitalDot radius={38} speed={2000} angleOffset={120} color={Colors.absolute} size={6} />
        <OrbitalDot radius={62} speed={3800} angleOffset={240} color={Colors.belief} size={5} />
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
