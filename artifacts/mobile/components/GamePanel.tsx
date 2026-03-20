import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useGame, WordAnalysis } from "@/context/GameContext";
import { LetterTumble } from "@/components/LetterTumble";

const TIMER_SECONDS = 45;

interface WrongAttempt {
  text: string;
  explainer: string;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

function isCloseEnoughToReframe(input: string, reframe: string): boolean {
  const a = input.toLowerCase().trim();
  const b = reframe.toLowerCase().trim();
  if (a === b) return true;
  const maxDist = Math.floor(Math.max(a.length, b.length) * 0.25);
  return levenshtein(a, b) <= maxDist;
}

export function GamePanel() {
  const {
    screen,
    words,
    activeWordIndex,
    closeGame,
    markReframed,
    skipWord,
  } = useGame();

  const isVisible = screen === "game" && activeWordIndex !== null;
  const activeWord: WordAnalysis | null =
    activeWordIndex !== null ? words[activeWordIndex] : null;

  const [reframeText, setReframeText] = useState("");
  const [showReframeInput, setShowReframeInput] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState<WrongAttempt[]>([]);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [fiftyFiftyOptions, setFiftyFiftyOptions] = useState<string[] | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationWord, setCelebrationWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);

  const timerProgress = useSharedValue(1);
  const slideAnim = useSharedValue(0);
  const wordAnim = useSharedValue(0);
  const actionsAnim = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isVisible) {
      setReframeText("");
      setShowReframeInput(false);
      setWrongAttempts([]);
      setHintRevealed(false);
      setFiftyFiftyOptions(null);
      setShowCelebration(false);
      setTimeLeft(TIMER_SECONDS);
      timerProgress.value = 1;

      wordAnim.value = 0;
      actionsAnim.value = 0;
      slideAnim.value = withSpring(1, { damping: 9, stiffness: 160 });
      wordAnim.value = withDelay(120, withSpring(1, { damping: 11, stiffness: 200 }));
      actionsAnim.value = withDelay(200, withSpring(1, { damping: 14, stiffness: 180 }));

      timerProgress.value = withTiming(0, {
        duration: TIMER_SECONDS * 1000,
      });

      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            handleSkip();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      slideAnim.value = 0;
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVisible, activeWordIndex]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(slideAnim.value, [0, 1], [110, 0]) },
      { scale: interpolate(slideAnim.value, [0, 1], [0.96, 1]) },
    ],
    opacity: interpolate(slideAnim.value, [0, 0.4], [0, 1]),
  }));

  const wordEnterStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(wordAnim.value, [0, 1], [0.45, 1]) },
      { translateY: interpolate(wordAnim.value, [0, 1], [20, 0]) },
    ],
    opacity: wordAnim.value,
  }));

  const actionsEnterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(actionsAnim.value, [0, 1], [22, 0]) }],
    opacity: actionsAnim.value,
  }));

  const timerFillStyle = useAnimatedStyle(() => ({
    flex: timerProgress.value,
    backgroundColor: interpolateColor(
      timerProgress.value,
      [0, 0.3, 1],
      [Colors.belief, Colors.absolute, Colors.fear]
    ) as string,
  }));

  const timerSpacerStyle = useAnimatedStyle(() => ({
    flex: 1 - timerProgress.value,
  }));

  const handleSkip = () => {
    if (activeWordIndex === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipWord(activeWordIndex);
  };

  const evaluateReframe = (input: string): boolean => {
    if (!activeWord) return false;
    const lower = input.toLowerCase().trim();
    const original = activeWord.word.toLowerCase();

    if (lower === original) return false;

    const ABSOLUTE_WORDS = new Set([
      "always", "never", "everyone", "nobody", "everything", "nothing",
      "completely", "totally", "forever", "impossible", "every", "all", "none",
      "must", "cant", "can't", "worthless", "useless", "failure",
    ]);
    if (ABSOLUTE_WORDS.has(lower)) return false;

    const goodReframes = activeWord.reframes.map((r) => r.toLowerCase().trim());
    return goodReframes.some((r) => isCloseEnoughToReframe(lower, r));
  };

  const handleReframeSubmit = () => {
    const trimmed = reframeText.trim();
    if (!trimmed) return;

    Keyboard.dismiss();
    const isCorrect = evaluateReframe(trimmed);

    if (isCorrect) {
      handleSuccess(trimmed);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setWrongAttempts((prev) => [
        ...prev,
        {
          text: trimmed,
          explainer:
            activeWord?.explainer ||
            "That's still a bit absolute — try softening the certainty.",
        },
      ]);
      setReframeText("");
    }
  };

  const handleFiftyFiftyPick = (option: string) => {
    if (!activeWord) return;
    const goodReframes = activeWord.reframes.map((r) => r.toLowerCase().trim());
    const optLower = option.toLowerCase().trim();
    const isCorrect = goodReframes.some((r) => isCloseEnoughToReframe(optLower, r));

    if (isCorrect) {
      handleSuccess(option);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setWrongAttempts((prev) => [
        ...prev,
        {
          text: option,
          explainer:
            activeWord?.explainer || "Not quite — try the other option.",
        },
      ]);
      setFiftyFiftyOptions(null);
    }
  };

  const handleSuccess = (reframedWord: string) => {
    if (activeWordIndex === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCelebrationWord(reframedWord);
    setShowCelebration(true);
  };

  const handleCelebrationDone = () => {
    if (activeWordIndex === null) return;
    markReframed(activeWordIndex, celebrationWord);
    setShowCelebration(false);
  };

  if (!isVisible || !activeWord) return null;

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      {showCelebration && (
        <LetterTumble
          word={celebrationWord}
          onComplete={handleCelebrationDone}
        />
      )}

      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <Animated.View style={[styles.panel, panelStyle]}>
              <View style={styles.timerBar}>
                <Animated.View style={[styles.timerFill, timerFillStyle]} />
                <Animated.View style={timerSpacerStyle} />
              </View>

              <View style={styles.header}>
                <Text style={styles.timerText}>{timeLeft}s</Text>
                <Pressable onPress={handleSkip} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Animated.View style={[styles.wordArea, wordEnterStyle]}>
                <Text style={styles.distortedWord}>
                  {activeWord.word.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor: (
                        Colors[`${activeWord.category}Dim` as keyof typeof Colors] ??
                        Colors.neutralText
                      ) as string,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color: (
                          Colors[activeWord.category as keyof typeof Colors] ??
                          Colors.textSecondary
                        ) as string,
                      },
                    ]}
                  >
                    {activeWord.category.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </Animated.View>

              {hintRevealed && activeWord.hint && (
                <View style={styles.hintBubble}>
                  <Text style={styles.hintLabel}>HINT</Text>
                  <Text style={styles.hintText}>
                    Try something like:{" "}
                    <Text style={styles.hintWord}>"{activeWord.hint}"</Text>
                  </Text>
                </View>
              )}

              <ScrollView
                style={styles.wrongArea}
                contentContainerStyle={{ gap: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {wrongAttempts.map((attempt, i) => (
                  <View key={i} style={styles.wrongItem}>
                    <Text style={styles.wrongText}>
                      <Text style={styles.strikethrough}>{attempt.text}</Text>
                    </Text>
                    <Text style={styles.explainerText}>{attempt.explainer}</Text>
                  </View>
                ))}
              </ScrollView>

              {fiftyFiftyOptions && (
                <View style={styles.fiftyArea}>
                  <Text style={styles.fiftyLabel}>Pick the better reframe:</Text>
                  <View style={styles.fiftyRow}>
                    {fiftyFiftyOptions.map((opt, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          styles.fiftyOption,
                          { opacity: pressed ? 0.8 : 1 },
                        ]}
                        onPress={() => handleFiftyFiftyPick(opt)}
                      >
                        <Text style={styles.fiftyOptionText}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {showReframeInput ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={reframeText}
                    onChangeText={setReframeText}
                    placeholder="Type your reframe..."
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                    onSubmitEditing={handleReframeSubmit}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendBtn,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={handleReframeSubmit}
                  >
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </Pressable>
                </View>
              ) : null}

              <Animated.View style={[styles.actionRow, actionsEnterStyle]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: Colors.reframeBtn, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowReframeInput((v) => !v);
                    setFiftyFiftyOptions(null);
                  }}
                >
                  <Text style={styles.actionBtnText}>REFRAME</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: Colors.hintBtn, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setHintRevealed(true);
                    setFiftyFiftyOptions(null);
                  }}
                >
                  <Text style={styles.actionBtnText}>HINT</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: Colors.fiftyBtn, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowReframeInput(false);
                    const opts =
                      activeWord.fiftyFifty?.length >= 2
                        ? [...activeWord.fiftyFifty].sort(() => Math.random() - 0.5)
                        : [activeWord.hint ?? "sometimes", activeWord.word];
                    setFiftyFiftyOptions(opts);
                  }}
                >
                  <Text style={styles.actionBtnText}>50/50</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: Colors.skipBtn, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={handleSkip}
                >
                  <Text style={styles.actionBtnText}>SKIP</Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,15,0.96)",
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 48,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timerBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    flexDirection: "row",
  },
  timerFill: {
    height: 3,
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  timerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  wordArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
  },
  distortedWord: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: 3,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  hintBubble: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.hintBtn,
    gap: 4,
  },
  hintLabel: {
    color: Colors.hintBtn,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  hintWord: {
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  wrongArea: {
    maxHeight: 140,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  wrongItem: {
    gap: 2,
  },
  wrongText: {
    color: Colors.belief,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  explainerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  fiftyArea: {
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 10,
  },
  fiftyLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  fiftyRow: {
    flexDirection: "row",
    gap: 12,
  },
  fiftyOption: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.fiftyBtn,
    alignItems: "center",
  },
  fiftyOptionText: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 16,
    gap: 10,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.reframeBtn,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    minWidth: 80,
    alignItems: "center",
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
});
