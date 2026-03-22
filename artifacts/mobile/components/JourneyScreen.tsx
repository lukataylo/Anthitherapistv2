/**
 * JourneyScreen — full-screen modal for journey-based question interactions.
 *
 * Presents a guided sequence of reflective questions with an improved UX over
 * the freeform capture screen. Key UX improvements:
 *
 * - **Step progress bar** — horizontal segmented bar shows how far through
 *   the journey the user is, filling with the journey's accent colour
 * - **One question at a time** — reduces cognitive load; each step is focused
 * - **Response history** — previously answered steps are visible as a scrollable
 *   thread above the current question, providing context and continuity
 * - **Hint system** — a collapsible hint per question, gently nudging without
 *   prescribing an answer
 * - **Completion celebration** — when all steps are done, a summary card with
 *   the option to restart or close
 * - **Auto-resume** — progress is persisted via JourneyContext so the user can
 *   leave and come back to the same step
 *
 * ## Props
 *
 * - `visible`  — controls Modal visibility
 * - `journey`  — the JourneyDef to render
 * - `onClose`  — called when the user dismisses the screen
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { type JourneyDef } from "@/data/journeys";
import { useJourney } from "@/context/JourneyContext";

/** Renders the segmented step progress bar at the top. */
function StepProgress({
  total,
  current,
  accentColor,
}: {
  total: number;
  current: number;
  accentColor: string;
}) {
  return (
    <View style={progressStyles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            progressStyles.segment,
            {
              backgroundColor:
                i < current
                  ? accentColor
                  : i === current
                    ? accentColor + "55"
                    : "rgba(255,255,255,0.08)",
            },
          ]}
        />
      ))}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
});

/** A single past response shown in the thread. */
function PastResponse({
  stepIndex,
  prompt,
  response,
  accentColor,
}: {
  stepIndex: number;
  prompt: string;
  response: string;
  accentColor: string;
}) {
  return (
    <View style={threadStyles.item}>
      <View style={threadStyles.promptRow}>
        <View
          style={[threadStyles.stepDot, { backgroundColor: accentColor }]}
        />
        <Text style={threadStyles.promptText}>{prompt}</Text>
      </View>
      <View style={threadStyles.responseBox}>
        <Text style={threadStyles.responseText}>{response}</Text>
      </View>
    </View>
  );
}

const threadStyles = StyleSheet.create({
  item: {
    marginBottom: 20,
    gap: 8,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingRight: 12,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  promptText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
  },
  responseBox: {
    marginLeft: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  responseText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 21,
  },
});

/** Completion card shown when all steps are answered. */
function CompletionCard({
  journey,
  onRestart,
  onClose,
}: {
  journey: JourneyDef;
  onRestart: () => void;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        completionStyles.card,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View
        style={[
          completionStyles.iconCircle,
          { backgroundColor: journey.accentColor + "22" },
        ]}
      >
        <Ionicons name="checkmark-done" size={32} color={journey.accentColor} />
      </View>
      <Text style={completionStyles.title}>Journey Complete</Text>
      <Text style={completionStyles.subtitle}>
        You've reflected on every question in {journey.name}. These reflections
        are saved — you can revisit them anytime.
      </Text>
      <View style={completionStyles.actions}>
        <Pressable
          onPress={onRestart}
          style={({ pressed }) => [
            completionStyles.restartBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="refresh"
            size={16}
            color="rgba(255,255,255,0.6)"
          />
          <Text style={completionStyles.restartText}>Start Again</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            completionStyles.doneBtn,
            { backgroundColor: journey.accentColor },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={completionStyles.doneText}>Done</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const completionStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    alignSelf: "stretch",
  },
  restartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  restartText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
  },
  doneBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
  },
  doneText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
});

export function JourneyScreen({
  visible,
  journey,
  onClose,
}: {
  visible: boolean;
  journey: JourneyDef | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { getProgress, submitResponse, resetJourney } = useJourney();
  const [inputText, setInputText] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Animation refs
  const questionFade = useRef(new Animated.Value(0)).current;
  const questionSlide = useRef(new Animated.Value(20)).current;

  const progress = journey ? getProgress(journey.id) : undefined;
  const currentStep = progress?.currentStep ?? 0;
  const isComplete = journey ? currentStep >= journey.steps.length : false;

  // Animate new question in when step changes
  useEffect(() => {
    if (!visible || !journey || isComplete) return;
    questionFade.setValue(0);
    questionSlide.setValue(20);
    Animated.parallel([
      Animated.timing(questionFade, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(questionSlide, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep, visible, journey, isComplete, questionFade, questionSlide]);

  // Reset hint when step changes
  useEffect(() => {
    setHintVisible(false);
    setInputText("");
  }, [currentStep]);

  // Scroll to bottom when new response is added
  useEffect(() => {
    if (currentStep > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(() => {
    if (!journey || !inputText.trim()) return;
    Keyboard.dismiss();
    submitResponse(journey.id, currentStep, inputText.trim());
    setInputText("");
  }, [journey, inputText, currentStep, submitResponse]);

  const handleRestart = useCallback(() => {
    if (!journey) return;
    resetJourney(journey.id);
  }, [journey, resetJourney]);

  if (!journey) return null;

  const step = journey.steps[currentStep];

  // Build list of past responses for the thread
  const pastResponses = [];
  for (let i = 0; i < currentStep; i++) {
    const resp = progress?.responses[i];
    if (resp) {
      pastResponses.push({
        stepIndex: i,
        prompt: journey.steps[i].prompt,
        response: resp.text,
      });
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: journey.bg }]}>
        {/* Background glow */}
        <View
          style={[styles.glowCircle, { backgroundColor: journey.accentColor }]}
          pointerEvents="none"
        />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityLabel="Close journey"
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Ionicons
              name={journey.icon}
              size={16}
              color={journey.accentColor}
            />
            <Text style={styles.headerTitle}>{journey.name}</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Step progress */}
        <StepProgress
          total={journey.steps.length}
          current={currentStep}
          accentColor={journey.accentColor}
        />

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          {isComplete ? (
            /* Completion state */
            <View style={styles.completionWrap}>
              {/* Show response thread */}
              <FlatList
                ref={flatListRef}
                data={pastResponses}
                keyExtractor={(item) => `past-${item.stepIndex}`}
                style={styles.thread}
                contentContainerStyle={[
                  styles.threadContent,
                  { paddingBottom: 20 },
                ]}
                renderItem={({ item }) => (
                  <PastResponse
                    {...item}
                    accentColor={journey.accentColor}
                  />
                )}
                ListFooterComponent={
                  <CompletionCard
                    journey={journey}
                    onRestart={handleRestart}
                    onClose={onClose}
                  />
                }
              />
            </View>
          ) : (
            /* Active question state */
            <>
              {/* Response thread */}
              <FlatList
                ref={flatListRef}
                data={pastResponses}
                keyExtractor={(item) => `past-${item.stepIndex}`}
                style={styles.thread}
                contentContainerStyle={styles.threadContent}
                ListFooterComponent={
                  /* Current question */
                  <Animated.View
                    style={[
                      styles.currentQuestion,
                      {
                        opacity: questionFade,
                        transform: [{ translateY: questionSlide }],
                      },
                    ]}
                  >
                    <View style={styles.stepLabel}>
                      <Text
                        style={[
                          styles.stepLabelText,
                          { color: journey.accentColor },
                        ]}
                      >
                        STEP {currentStep + 1} OF {journey.steps.length}
                      </Text>
                    </View>

                    <Text style={styles.questionText}>{step.prompt}</Text>

                    {/* Hint toggle */}
                    <Pressable
                      onPress={() => setHintVisible((v) => !v)}
                      style={styles.hintToggle}
                    >
                      <Ionicons
                        name={hintVisible ? "bulb" : "bulb-outline"}
                        size={14}
                        color={
                          hintVisible
                            ? journey.accentColor
                            : "rgba(255,255,255,0.3)"
                        }
                      />
                      <Text
                        style={[
                          styles.hintToggleText,
                          hintVisible && { color: journey.accentColor },
                        ]}
                      >
                        {hintVisible ? "Hide hint" : "Show hint"}
                      </Text>
                    </Pressable>

                    {hintVisible && (
                      <View
                        style={[
                          styles.hintBox,
                          {
                            borderColor: journey.accentColor + "33",
                            backgroundColor: journey.accentColor + "0A",
                          },
                        ]}
                      >
                        <Text style={styles.hintText}>{step.hint}</Text>
                      </View>
                    )}
                  </Animated.View>
                }
              />

              {/* Input area */}
              <View
                style={[
                  styles.inputArea,
                  { paddingBottom: Math.max(insets.bottom, 12) + 4 },
                ]}
              >
                <View style={styles.inputRow}>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Write your reflection..."
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={2000}
                    textAlignVertical="top"
                    returnKeyType="default"
                  />
                  <Pressable
                    onPress={handleSubmit}
                    disabled={!inputText.trim()}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      {
                        backgroundColor: inputText.trim()
                          ? journey.accentColor
                          : "rgba(255,255,255,0.06)",
                      },
                      pressed && inputText.trim() && { opacity: 0.8 },
                    ]}
                    accessibilityLabel="Submit response"
                  >
                    <Ionicons
                      name="arrow-up"
                      size={20}
                      color={inputText.trim() ? "#000" : "rgba(255,255,255,0.2)"}
                    />
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glowCircle: {
    position: "absolute",
    top: -160,
    alignSelf: "center",
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.06,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: -0.2,
  },
  body: {
    flex: 1,
  },
  completionWrap: {
    flex: 1,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  currentQuestion: {
    marginTop: 8,
    gap: 12,
  },
  stepLabel: {
    marginBottom: 4,
  },
  stepLabelText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  questionText: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  hintToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  hintToggleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.3)",
  },
  hintBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  hintText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 21,
    fontStyle: "italic",
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    lineHeight: 21,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
