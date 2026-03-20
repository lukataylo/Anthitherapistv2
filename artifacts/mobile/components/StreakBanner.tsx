import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useStreak } from "@/context/StreakContext";

export function StreakBanner() {
  const { currentStreak, reflectedToday } = useStreak();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-6);

  const show = currentStreak > 0 && !reflectedToday;

  useEffect(() => {
    if (show) {
      opacity.value = withTiming(1, { duration: 350 });
      translateY.value = withSpring(0, { damping: 14 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-6, { duration: 200 });
    }
  }, [show]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!show && opacity.value === 0) return null;

  const messages = [
    `${currentStreak} day streak — don't break it!`,
    `You're on a ${currentStreak} day run 🔥`,
    `Keep going — ${currentStreak} days strong!`,
  ];
  const msg = messages[currentStreak % messages.length];

  return (
    <Animated.View style={[styles.banner, style]}>
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "rgba(255,149,0,0.12)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,149,0,0.22)",
    marginBottom: 10,
  },
  text: {
    color: "#FF9500",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
