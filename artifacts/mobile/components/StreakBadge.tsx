import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useStreak } from "@/context/StreakContext";

interface StreakBadgeProps {
  animate?: boolean;
}

export function StreakBadge({ animate = false }: StreakBadgeProps) {
  const { currentStreak, reflectedToday } = useStreak();
  const scale = useSharedValue(1);
  const fireOpacity = useSharedValue(reflectedToday ? 1 : 0.45);

  useEffect(() => {
    fireOpacity.value = withTiming(reflectedToday ? 1 : 0.45, {
      duration: 400,
    });
  }, [reflectedToday]);

  useEffect(() => {
    if (animate && currentStreak > 0) {
      scale.value = withSequence(
        withSpring(1.35, { damping: 4, stiffness: 300 }),
        withSpring(1, { damping: 8 })
      );
    }
  }, [animate, currentStreak]);

  const fireStyle = useAnimatedStyle(() => ({
    opacity: fireOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (currentStreak === 0 && !reflectedToday) {
    return (
      <View style={styles.container}>
        <Animated.Text style={[styles.fireIcon, fireStyle]}>🔥</Animated.Text>
        <Text style={[styles.count, { color: "rgba(255,255,255,0.25)" }]}>
          0
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.fireIcon, fireStyle]}>🔥</Animated.Text>
      <Text
        style={[
          styles.count,
          { color: reflectedToday ? "#FF9500" : "rgba(255,255,255,0.6)" },
        ]}
      >
        {currentStreak}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fireIcon: {
    fontSize: 20,
  },
  count: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
});
