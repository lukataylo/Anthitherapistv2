import React, { useEffect, useRef } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGame } from "@/context/GameContext";
import { useStreak } from "@/context/StreakContext";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";
import { StreakBadge } from "@/components/StreakBadge";

interface CaptureScreenProps {
  onSubmit: (thought: string) => void;
  isLoading: boolean;
  streakJustIncremented?: boolean;
}

const PLACEHOLDER = "What's on your mind?";

export function CaptureScreen({
  onSubmit,
  isLoading,
  streakJustIncremented = false,
}: CaptureScreenProps) {
  const { thought, setThought } = useGame();
  const { currentStreak, reflectedToday } = useStreak();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const sendScale = useSharedValue(1);
  const sendOpacity = useSharedValue(0.3);
  const nudgeOpacity = useSharedValue(0);

  const canSend = thought.trim().length > 0 && !isLoading;
  const showNudge = currentStreak > 0 && !reflectedToday;

  const nudgeMessages = [
    `${currentStreak} day streak — keep it going`,
    `${currentStreak} days strong — don't stop now`,
    `You're on a ${currentStreak} day run`,
  ];
  const nudgeText = nudgeMessages[currentStreak % nudgeMessages.length];

  useEffect(() => {
    sendOpacity.value = withTiming(canSend ? 1 : 0.28, { duration: 180 });
  }, [canSend]);

  useEffect(() => {
    nudgeOpacity.value = withTiming(showNudge ? 1 : 0, { duration: 300 });
  }, [showNudge]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendOpacity.value,
  }));

  const nudgeStyle = useAnimatedStyle(() => ({
    opacity: nudgeOpacity.value,
  }));

  const handleSubmit = () => {
    if (!canSend) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.9, { damping: 6 }, () => {
      sendScale.value = withSpring(1, { damping: 8 });
    });
    onSubmit(thought.trim());
  };

  const handleMicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ThinkingAnimation />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 14,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.topBar}>
          <StreakBadge animate={streakJustIncremented} />
        </View>

        <View style={styles.card}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={thought}
            onChangeText={setThought}
            placeholder={PLACEHOLDER}
            placeholderTextColor="rgba(255,255,255,0.18)"
            multiline
            maxLength={400}
            textAlignVertical="top"
            selectionColor="rgba(255,255,255,0.5)"
            autoFocus={false}
            scrollEnabled
          />

          <View style={styles.toolbar}>
            <Pressable
              onPress={handleMicPress}
              hitSlop={16}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Ionicons
                name="mic-outline"
                size={22}
                color="rgba(255,255,255,0.28)"
              />
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={!canSend}
              hitSlop={8}
            >
              <Animated.View style={[styles.sendBtn, sendBtnStyle]}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        {showNudge && (
          <Animated.View style={[styles.nudgeRow, nudgeStyle]}>
            <Text style={styles.nudgeText}>{nudgeText}</Text>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  screen: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "#171717",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    lineHeight: 42,
    paddingTop: 0,
    paddingBottom: 0,
    letterSpacing: -0.5,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
  },
  sendBtn: {
    backgroundColor: "#0A84FF",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  nudgeRow: {
    paddingTop: 12,
    alignItems: "center",
  },
  nudgeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,149,0,0.5)",
    letterSpacing: 0.2,
  },
});
