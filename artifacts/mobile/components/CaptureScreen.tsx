import React, { useEffect, useRef } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { useStreak } from "@/context/StreakContext";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";
import { StreakBadge } from "@/components/StreakBadge";
import { AnnotatedThought } from "@/components/AnnotatedThought";
import { GamePanel } from "@/components/GamePanel";

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
  const {
    screen,
    thought,
    setThought,
    words,
    reframedWords,
    openGame,
    goToCapture,
    reframedCount,
    totalSignificant,
    allDone,
  } = useGame();
  const { currentStreak, reflectedToday } = useStreak();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const isReviewing = screen === "cloud" || screen === "game";

  const sendScale = useSharedValue(1);
  const sendOpacity = useSharedValue(0.3);
  const nudgeOpacity = useSharedValue(0);
  const reviewProgress = useSharedValue(0);

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

  useEffect(() => {
    reviewProgress.value = withTiming(isReviewing ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [isReviewing]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendOpacity.value,
  }));

  const nudgeStyle = useAnimatedStyle(() => ({
    opacity: nudgeOpacity.value,
  }));

  const inputLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - reviewProgress.value,
  }));

  const reviewLayerStyle = useAnimatedStyle(() => ({
    opacity: reviewProgress.value,
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

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToCapture();
  };

  const handleWordPress = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openGame(idx);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ThinkingAnimation />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Capture input layer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          inputLayerStyle,
          { pointerEvents: isReviewing ? "none" : "auto" },
        ]}
      >
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
      </Animated.View>

      {/* Review annotation layer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          reviewLayerStyle,
          { pointerEvents: isReviewing ? "auto" : "none" },
        ]}
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
          {/* Review top bar */}
          <View style={styles.reviewTopBar}>
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={12}
            >
              <Ionicons
                name="pencil-outline"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.backBtnText}>New thought</Text>
            </Pressable>

            {totalSignificant > 0 && (
              <Text style={styles.progressText}>
                {reframedCount} of {totalSignificant} reframed
              </Text>
            )}
          </View>

          {/* Annotated card */}
          <View style={styles.card}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.annotatedContent}
            >
              <AnnotatedThought
                thought={thought}
                words={words}
                reframedWords={reframedWords}
                onWordPress={handleWordPress}
              />

              {allDone && totalSignificant > 0 && (
                <View style={styles.doneBanner}>
                  <Ionicons name="sparkles" size={13} color={Colors.success} />
                  <Text style={styles.doneText}>All reframed</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Animated.View>

      {/* Game panel modal — always rendered so it can respond to screen === "game" */}
      <GamePanel />
    </View>
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
  reviewTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    minHeight: 34,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  backBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.3,
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
  annotatedContent: {
    paddingBottom: 16,
    gap: 20,
  },
  doneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingTop: 4,
  },
  doneText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.success,
    letterSpacing: 0.2,
  },
});
