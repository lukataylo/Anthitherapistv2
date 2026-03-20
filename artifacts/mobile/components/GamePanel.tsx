import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useGame, WordAnalysis } from "@/context/GameContext";
import { LetterTumble } from "@/components/LetterTumble";

const TIMER_SECONDS = 45;

interface WrongAttempt {
  text: string;
  explainer: string;
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
  const [fiftyFiftyOptions, setFiftyFiftyOptions] = useState<string[] | null>(
    null
  );
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationWord, setCelebrationWord] = useState("");
  const [timerProgress] = useState(new Animated.Value(1));
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setReframeText("");
      setShowReframeInput(false);
      setWrongAttempts([]);
      setHintRevealed(false);
      setFiftyFiftyOptions(null);
      setShowCelebration(false);
      setTimeLeft(TIMER_SECONDS);
      timerProgress.setValue(1);

      Animated.spring(slideAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();

      timerAnimRef.current = Animated.timing(timerProgress, {
        toValue: 0,
        duration: TIMER_SECONDS * 1000,
        useNativeDriver: false,
      });
      timerAnimRef.current.start();

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
      slideAnim.setValue(0);
      timerAnimRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      timerAnimRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isVisible, activeWordIndex]);

  const handleSkip = () => {
    if (activeWordIndex === null) return;
    timerAnimRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipWord(activeWordIndex);
  };

  const evaluateReframe = (input: string): boolean => {
    if (!activeWord) return false;
    const lower = input.toLowerCase().trim();
    if (lower === activeWord.word.toLowerCase()) return false;
    if (activeWord.category === "absolute") {
      const absolutes = [
        "always","never","everyone","nobody","everything","nothing",
        "completely","totally","forever","impossible","every","all","none",
      ];
      if (absolutes.includes(lower)) return false;
    }
    const goodReframes = activeWord.reframes.map((r) => r.toLowerCase());
    if (goodReframes.some((r) => lower.includes(r) || r.includes(lower))) {
      return true;
    }
    if (lower.length >= 3 && lower !== activeWord.word.toLowerCase()) {
      return true;
    }
    return false;
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
    const isCorrect = evaluateReframe(option);
    if (isCorrect) {
      handleSuccess(option);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setWrongAttempts((prev) => [
        ...prev,
        {
          text: option,
          explainer:
            activeWord?.explainer ||
            "Not quite — try the other option.",
        },
      ]);
      setFiftyFiftyOptions(null);
    }
  };

  const handleSuccess = (reframedWord: string) => {
    if (activeWordIndex === null) return;
    timerAnimRef.current?.stop();
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
            <Animated.View
              style={[
                styles.panel,
                {
                  transform: [
                    {
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [80, 0],
                      }),
                    },
                  ],
                  opacity: slideAnim,
                },
              ]}
            >
              <View style={styles.timerBar}>
                <Animated.View
                  style={[
                    styles.timerFill,
                    {
                      width: timerProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                      backgroundColor: timerProgress.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [Colors.belief, Colors.absolute, Colors.fear],
                      }),
                    },
                  ]}
                />
              </View>

              <View style={styles.header}>
                <Text style={styles.timerText}>{timeLeft}s</Text>
                <Pressable onPress={handleSkip} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.wordArea}>
                <Text style={styles.distortedWord}>
                  {activeWord.word.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor:
                        Colors[
                          `${activeWord.category}Dim` as keyof typeof Colors
                        ] ?? Colors.neutralText,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color:
                          Colors[
                            activeWord.category as keyof typeof Colors
                          ] ?? Colors.textSecondary,
                      },
                    ]}
                  >
                    {activeWord.category.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>

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
                    <Text style={styles.sendBtnText}>→</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.actionRow}>
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
                    const opts = activeWord.fiftyFifty?.length >= 2
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
              </View>
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
  },
  timerFill: {
    height: "100%",
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
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 18,
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
  sendBtnText: {
    color: Colors.white,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
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
