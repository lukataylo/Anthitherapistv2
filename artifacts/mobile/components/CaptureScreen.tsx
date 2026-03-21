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
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
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

const PLACEHOLDER = "Capture a thought, a belief, or a prediction...";

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

  const [isRecording, setIsRecording] = React.useState(false);

  const sendScale = useSharedValue(1);
  const sendActive = useSharedValue(0);
  const nudgeOpacity = useSharedValue(0);
  const reviewProgress = useSharedValue(0);
  const micBg = useSharedValue(0);
  const micPulse = useSharedValue(1);

  const canSend = thought.trim().length > 0 && !isLoading;
  const showNudge = currentStreak > 0 && !reflectedToday;

  const nudgeMessages = [
    `${currentStreak} day streak — keep it going`,
    `${currentStreak} days strong — don't stop now`,
    `You're on a ${currentStreak} day run`,
  ];
  const nudgeText = nudgeMessages[currentStreak % nudgeMessages.length];

  useEffect(() => {
    sendActive.value = withTiming(canSend ? 1 : 0, { duration: 200 });
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

  useEffect(() => {
    if (isRecording) {
      micBg.value = withTiming(1, { duration: 200 });
      micPulse.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 480 }),
          withTiming(1.0, { duration: 480 })
        ),
        -1
      );
    } else {
      micBg.value = withTiming(0, { duration: 180 });
      micPulse.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: 0.35 + sendActive.value * 0.65,
    backgroundColor: interpolateColor(
      sendActive.value,
      [0, 1],
      ["#3A3A3A", "#FFFFFF"]
    ),
  }));

  const micBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
    backgroundColor: interpolateColor(
      micBg.value,
      [0, 1],
      ["#2C2C2C", "#E03030"]
    ),
  }));

  const micGlowStyle = useAnimatedStyle(() => ({
    opacity: micBg.value * 0.3,
    transform: [{ scale: 1 + micBg.value * 0.25 + (micPulse.value - 1) * 1.4 }],
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording((r) => !r);
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
                {/* Mic button */}
                <View style={styles.micWrap}>
                  <Animated.View style={[styles.micGlow, micGlowStyle]} />
                  <Pressable
                    onPress={handleMicPress}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                  >
                    <Animated.View style={[styles.micBtn, micBtnStyle]}>
                      <Ionicons name="mic" size={21} color="#fff" />
                    </Animated.View>
                  </Pressable>
                </View>

                {/* Send button — paper plane */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSend}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <Animated.View style={[styles.sendBtn, sendBtnStyle]}>
                    <Ionicons
                      name="send"
                      size={18}
                      color={canSend ? "#000" : "#fff"}
                      style={{ marginLeft: 2 }}
                    />
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
    // @ts-ignore — web only: remove browser focus ring
    outlineWidth: 0,
    outlineStyle: "none",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 14,
    gap: 10,
  },
  micWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  micGlow: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E03030",
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
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
