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
  const sendOpacity = useSharedValue(0);
  const micOpacity = useSharedValue(1);
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
    sendOpacity.value = withTiming(canSend ? 1 : 0.3, { duration: 180 });
    micOpacity.value = withTiming(canSend ? 0 : 1, { duration: 180 });
  }, [canSend]);

  useEffect(() => {
    nudgeOpacity.value = withTiming(showNudge ? 1 : 0, { duration: 300 });
  }, [showNudge]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendOpacity.value,
  }));

  const micBtnStyle = useAnimatedStyle(() => ({
    opacity: micOpacity.value,
  }));

  const nudgeStyle = useAnimatedStyle(() => ({
    opacity: nudgeOpacity.value,
  }));

  const handleSubmit = () => {
    if (!canSend) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.88, { damping: 6 }, () => {
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
          styles.container,
          {
            paddingTop: insets.top + 14,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.topBar}>
          <StreakBadge animate={streakJustIncremented} />
        </View>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={thought}
          onChangeText={setThought}
          placeholder={PLACEHOLDER}
          placeholderTextColor="rgba(255,255,255,0.2)"
          multiline
          maxLength={400}
          textAlignVertical="top"
          selectionColor="#2196F3"
          autoFocus={false}
          scrollEnabled
        />

        <View style={styles.toolbar}>
          <Animated.View style={micBtnStyle}>
            <Pressable
              onPress={handleMicPress}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={12}
            >
              <Ionicons
                name="mic-outline"
                size={24}
                color="rgba(255,255,255,0.4)"
              />
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSend}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            hitSlop={8}
          >
            <Animated.View style={[styles.sendBtn, sendBtnStyle]}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </Animated.View>
          </Pressable>
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
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    lineHeight: 44,
    paddingTop: 0,
    paddingBottom: 12,
    letterSpacing: -0.5,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2196F3",
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeRow: {
    paddingTop: 10,
    paddingBottom: 2,
    alignItems: "center",
  },
  nudgeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,149,0,0.55)",
    letterSpacing: 0.2,
  },
});
