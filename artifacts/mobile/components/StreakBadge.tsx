import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(reflectedToday ? 1 : 0.5, { duration: 350 });
  }, [reflectedToday]);

  useEffect(() => {
    if (animate && currentStreak > 0) {
      scale.value = withSequence(
        withSpring(1.4, { damping: 4, stiffness: 280 }),
        withSpring(1, { damping: 10 })
      );
    }
  }, [animate, currentStreak]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const streakLabel =
    currentStreak === 0
      ? "No streak yet"
      : `${currentStreak}-day streak${reflectedToday ? ", reflected today" : ", not yet reflected today"}`;

  return (
    <Animated.View
      style={[styles.pill, pillStyle]}
      accessible
      accessibilityLabel={streakLabel}
      accessibilityRole="text"
    >
      <Ionicons
        name="flame"
        size={13}
        color={reflectedToday ? "#FF9500" : "rgba(255,255,255,0.35)"}
        importantForAccessibility="no"
      />
      <Text
        style={[
          styles.count,
          { color: reflectedToday ? "#FF9500" : "rgba(255,255,255,0.5)" },
        ]}
        importantForAccessibility="no"
      >
        {currentStreak}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  count: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
});
