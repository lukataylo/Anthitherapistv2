import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { Colors } from "@/constants/colors";

function PulsingRing({
  delay,
  color,
  size,
}: {
  delay: number;
  color: string;
  size: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0.6, scale: 0.6 }}
      animate={{ opacity: 0, scale: 1.6 }}
      transition={{
        type: "timing",
        duration: 1600,
        delay,
        loop: true,
        repeatReverse: false,
      }}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          position: "absolute",
        },
      ]}
    />
  );
}

function BounceDot({ delay, color }: { delay: number; color: string }) {
  return (
    <MotiView
      from={{ translateY: 0, opacity: 0.3 }}
      animate={{ translateY: -6, opacity: 1 }}
      transition={{
        type: "timing",
        duration: 400,
        delay,
        loop: true,
        repeatReverse: true,
      }}
      style={[styles.dot, { backgroundColor: color }]}
    />
  );
}

export function ThinkingAnimation() {
  return (
    <View style={styles.container}>
      <View style={styles.ringContainer}>
        <PulsingRing delay={0} color={Colors.fear} size={80} />
        <PulsingRing delay={800} color={Colors.absolute} size={80} />
        <View style={styles.innerDot} />
      </View>

      <View style={styles.dotsRow}>
        <BounceDot delay={0} color={Colors.fear} />
        <BounceDot delay={200} color={Colors.fear} />
        <BounceDot delay={400} color={Colors.fear} />
      </View>

      <Text style={styles.text}>Analysing your thought...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 28,
  },
  ringContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    borderWidth: 2,
  },
  innerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.belief,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
  },
});
