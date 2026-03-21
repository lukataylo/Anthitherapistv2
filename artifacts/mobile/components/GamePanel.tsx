/**
 * GamePanel — the core reframing interaction, presented as a bottom-sheet modal.
 *
 * Displayed when `screen === "game"` in GameContext. The panel focuses the user
 * on a single distorted word and offers four actions to work through it:
 *
 *  - **REFRAME** — free-text input where the user types their own alternative
 *  - **HINT**    — reveals the AI-generated hint (e.g. "Try something like: 'sometimes'")
 *  - **50/50**   — reveals two options (one correct, one decoy) to choose from
 *  - **SKIP**    — moves past the word without reframing (it still counts toward
 *                  completion so the session can finish)
 *
 * ## Evaluation logic
 *
 * `evaluateReframe()` checks the user's free-text input against the AI-provided
 * `reframes` array using fuzzy matching (Levenshtein distance ≤ 25% of word
 * length). This allows for minor typos without being so loose that nonsense
 * passes. Additionally, the original distorted word itself and a curated list
 * of absolute words are blocked even if they happen to match by edit distance.
 *
 * ## Timer
 *
 * A 45-second countdown timer is displayed as:
 *  1. A colour-animated progress bar at the top of the panel (green → amber →
 *     red as time runs out)
 *  2. A numeric countdown in the header
 *
 * If the timer reaches zero, `handleSkip()` is called automatically. The timer
 * is stored in a React ref (`timerRef`) rather than state to avoid excessive
 * re-renders from the setInterval callback.
 *
 * ## Animation choreography
 *
 * When the panel becomes visible, three staggered enter animations play:
 *  - `slideAnim`   — the whole panel slides up 20px and fades in (240 ms)
 *  - `wordAnim`    — the distorted word enters 80 ms after the panel
 *  - `actionsAnim` — the action buttons enter 60 ms after the word
 *
 * ## Wrong attempts
 *
 * Each failed reframe attempt is appended to `wrongAttempts` with the user's
 * text and the AI's explainer for why that word is a distortion. This list
 * is displayed inside the panel with strikethrough styling, building up a
 * visual record of what didn't work and why — reinforcing learning.
 */

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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useGame, WordAnalysis } from "@/context/GameContext";
import { LetterTumble } from "@/components/LetterTumble";
import { QuitButton } from "@/components/QuitButton";

/** Seconds the user has to reframe a word before it is auto-skipped. */
const TIMER_SECONDS = 45;

interface WrongAttempt {
  text: string;
  explainer: string;
}

/**
 * Classic dynamic-programming Levenshtein distance between two strings.
 * Used by `isCloseEnoughToReframe` to accept minor typos.
 */
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

/**
 * Returns true if `input` is close enough to `reframe` to be accepted.
 * Exact match always passes. Otherwise allows edit distance up to 25% of the
 * longer string (e.g. a 12-character word tolerates up to 3 edits).
 */
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showReframeInput, setShowReframeInput] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState<WrongAttempt[]>([]);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [fiftyFiftyOptions, setFiftyFiftyOptions] = useState<string[] | null>(null);
  const fiftyFiftyCorrectRef = useRef<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationWord, setCelebrationWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);

  // Animated timer progress: 1.0 (full) → 0.0 (empty), driven by withTiming
  const timerProgress = useSharedValue(1);
  // Panel enter animations
  const slideAnim = useSharedValue(0);
  const wordAnim = useSharedValue(0);
  const actionsAnim = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isVisible) {
      // Reset all per-word state when a new word is opened
      setReframeText("");
      setSuggestions([]);
      setShowReframeInput(false);
      setWrongAttempts([]);
      setHintRevealed(false);
      setFiftyFiftyOptions(null);
      fiftyFiftyCorrectRef.current = null;
      setShowCelebration(false);
      setTimeLeft(TIMER_SECONDS);
      timerProgress.value = 1;

      // Staggered entry animations for panel, word, and action buttons
      wordAnim.value = 0;
      actionsAnim.value = 0;
      slideAnim.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      wordAnim.value = withDelay(80, withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
      actionsAnim.value = withDelay(140, withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));

      // Animate the timer bar from full to empty over exactly TIMER_SECONDS
      timerProgress.value = withTiming(0, {
        duration: TIMER_SECONDS * 1000,
      });

      // Countdown interval that auto-skips when it reaches zero
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
      // Panel closed — reset slide position and clear the interval
      slideAnim.value = 0;
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVisible, activeWordIndex]);

  // Compute live suggestions from activeWord.reframes as the user types
  useEffect(() => {
    const trimmed = reframeText.trim().toLowerCase();
    if (!trimmed || !activeWord) {
      setSuggestions([]);
      return;
    }
    const matched = activeWord.reframes.filter((r) =>
      r.toLowerCase().includes(trimmed)
    );
    setSuggestions(matched);
  }, [reframeText, activeWord]);

  // Panel slides up from 20px below and fades in
  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(slideAnim.value, [0, 1], [20, 0]) },
    ],
    opacity: slideAnim.value,
  }));

  const wordEnterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wordAnim.value, [0, 1], [10, 0]) },
    ],
    opacity: wordAnim.value,
  }));

  const actionsEnterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(actionsAnim.value, [0, 1], [10, 0]) }],
    opacity: actionsAnim.value,
  }));

  /**
   * Timer progress bar: colour transitions through three stages as time runs out.
   * The interpolateColor call maps progress 0→0.3→1 to red→amber→green,
   * so the bar starts green (time remaining) and ends red (time up).
   */
  const timerFillStyle = useAnimatedStyle(() => ({
    flex: timerProgress.value,
    backgroundColor: interpolateColor(
      timerProgress.value,
      [0, 0.3, 1],
      [Colors.belief, Colors.absolute, Colors.fear]
    ) as string,
  }));

  // The "empty" portion of the timer bar grows as the fill shrinks
  const timerSpacerStyle = useAnimatedStyle(() => ({
    flex: 1 - timerProgress.value,
  }));

  const handleSkip = () => {
    if (activeWordIndex === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipWord(activeWordIndex);
  };

  /**
   * Evaluates the user's free-text reframe against the AI-provided reframes.
   *
   * Rejects:
   *  - The original distorted word itself
   *  - Any word from the curated absolute/belief blocklist
   *
   * Accepts:
   *  - Any string within edit distance 25% of a valid reframe
   */
  const evaluateReframe = (input: string): boolean => {
    if (!activeWord) return false;
    const lower = input.toLowerCase().trim();
    const original = activeWord.word.toLowerCase();

    if (lower === original) return false;

    // Block common absolute/belief words that are themselves distorted
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
      // Record the failed attempt with the AI's explainer so the user learns why
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
    const optLower = option.toLowerCase().trim();
    const correctLower = (fiftyFiftyCorrectRef.current ?? "").toLowerCase().trim();
    const isCorrect = optLower === correctLower;

    if (isCorrect) {
      handleSuccess(option);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Wrong 50/50 pick — clear the options and record the attempt
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

  /**
   * Called when the user successfully identifies a reframe.
   * Stops the timer, stores the word for the celebration animation, then
   * waits for LetterTumble to finish before calling markReframed().
   */
  const handleSuccess = (reframedWord: string) => {
    if (activeWordIndex === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReframeText("");
    setSuggestions([]);
    setCelebrationWord(reframedWord);
    setShowCelebration(true);
  };

  /** Called by LetterTumble when its animation sequence completes. */
  const handleCelebrationDone = () => {
    if (activeWordIndex === null) return;
    markReframed(activeWordIndex, celebrationWord);
    setShowCelebration(false);
  };

  if (!isVisible || !activeWord) return null;

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      {/* LetterTumble celebration overlay — rendered inside the modal so it
          sits above the panel content but within the modal's z-stack */}
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
              {/* Timer progress bar at the very top of the panel */}
              <View style={styles.timerBar}>
                <Animated.View style={[styles.timerFill, timerFillStyle]} />
                <Animated.View style={timerSpacerStyle} />
              </View>

              <View style={styles.header}>
                <QuitButton
                  onQuit={closeGame}
                  isPlaying={!showCelebration && timeLeft > 0}
                  tintColor={Colors.textSecondary}
                />
                <Text style={styles.timerText}>{timeLeft}s</Text>
              </View>

              {/* Word display: shown large in uppercase with the distortion category badge */}
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

              {/* Scrollable area for wrong attempt history */}
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

              {/* 50/50 option buttons — rendered when the user activates this power-up */}
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
                        accessibilityLabel={opt}
                        accessibilityRole="button"
                        accessibilityHint={`Select "${opt}" as your reframe`}
                      >
                        <Text style={styles.fiftyOptionText}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Live suggestion chips — shown above the input when text matches reframes */}
              {showReframeInput && suggestions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.suggestionsScroll}
                  contentContainerStyle={styles.suggestionsContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {suggestions.map((suggestion, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [
                        styles.suggestionChip,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReframeText(suggestion);
                      }}
                      accessibilityLabel={`Suggestion: ${suggestion}`}
                      accessibilityRole="button"
                      accessibilityHint={`Fill in "${suggestion}" as your reframe`}
                    >
                      <Text style={styles.suggestionChipText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Free-text reframe input — toggled by the REFRAME button */}
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
                    accessibilityLabel="Submit reframe"
                    accessibilityRole="button"
                  >
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </Pressable>
                </View>
              ) : null}

              {/* Action buttons */}
              <Animated.View style={[styles.actionRow, actionsEnterStyle]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: Colors.reframeBtn, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowReframeInput((v) => !v);
                    // Opening REFRAME dismisses 50/50 and vice versa — mutually exclusive
                    setFiftyFiftyOptions(null);
                  }}
                  accessibilityLabel="Reframe"
                  accessibilityRole="button"
                  accessibilityHint="Type your own reframe for the distorted word"
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
                  accessibilityLabel="Hint"
                  accessibilityRole="button"
                  accessibilityHint="Reveal a hint word to help you reframe"
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
                    // Use the AI-provided 50/50 pair if available; otherwise construct
                    // a fallback from the hint and the original word
                    const ff = activeWord.fiftyFifty;
                    const correctAnswer =
                      Array.isArray(ff) && ff.length >= 2
                        ? ff[0]
                        : (activeWord.hint ?? "sometimes");
                    fiftyFiftyCorrectRef.current = correctAnswer;
                    const opts =
                      Array.isArray(ff) && ff.length >= 2
                        ? [...ff].sort(() => Math.random() - 0.5)
                        : [correctAnswer, activeWord.word];
                    setFiftyFiftyOptions(opts);
                  }}
                  accessibilityLabel="50 50"
                  accessibilityRole="button"
                  accessibilityHint="Show two options and pick the better reframe"
                >
                  <Text style={styles.actionBtnText}>50/50</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: Colors.skipBtn, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={handleSkip}
                  accessibilityLabel="Skip"
                  accessibilityRole="button"
                  accessibilityHint="Skip this word and move to the next one"
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
  suggestionsScroll: {
    maxHeight: 44,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  suggestionsContent: {
    gap: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  suggestionChip: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  suggestionChipText: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
