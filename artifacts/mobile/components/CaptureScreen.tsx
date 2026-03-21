/**
 * CaptureScreen — the primary interaction surface of the app.
 *
 * This component renders two full-screen layers stacked with `absoluteFill`:
 *
 * 1. **Input layer** — the thought capture UI (text input + mic/send buttons).
 *    Visible when `screen === "capture"`, pointer events disabled when reviewing.
 *
 * 2. **Review layer** — the annotated thought view with `AnnotatedThought` and
 *    the reframe progress indicator. Visible when `screen === "cloud" | "game"`,
 *    pointer events disabled when capturing.
 *
 * The layers cross-fade via `reviewProgress` (an animated 0→1 value) rather
 * than conditional mounting. This keeps the input layer alive while reviewing
 * (so it doesn't reset its scroll state) and makes the transition smooth.
 *
 * A third piece — `GamePanel` — is always rendered but only becomes visible
 * when `screen === "game"`. Because GamePanel is a modal it manages its own
 * visibility internally.
 *
 * ## Streak nudge
 *
 * When the user has a streak but hasn't reflected today, a subtle orange line
 * fades in below the text card reminding them. The message cycles through
 * three variants based on the streak length (using modulo) to avoid repetition.
 *
 * ## Send button state machine
 *
 * `sendActive` (0 or 1) drives two animated properties on the send button:
 *  - Opacity: 0.35 when disabled → 1.0 when enabled
 *  - Background colour: dark grey (#3A3A3A) → white (#FFFFFF)
 * The colour change makes it immediately obvious when a thought is ready to send.
 *
 * ## Mic button
 *
 * Uses expo-speech-recognition for real device speech-to-text. Tapping the mic
 * starts a recognition session; speech is appended to any existing thought text.
 * The button pulses red while listening. On web (where the API may be absent)
 * the button is gracefully hidden.
 *
 * ## Loading state
 *
 * When `isLoading` is true (the API request is in-flight), the component
 * renders only the `ThinkingAnimation` centred on screen, replacing the
 * layered UI entirely.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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

// expo-speech-recognition requires a custom Expo dev client — not available in
// standard Expo Go. Dynamic require lets the app load without the native module;
// all mic/speech features are silently disabled when it isn't present.
const _speechMod = (() => {
  try { return require("expo-speech-recognition"); } catch { return null; }
})();
const SpeechModule: null | {
  addListener: (event: string, handler: (e: any) => void) => { remove(): void };
  stop: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: object) => void;
} = _speechMod?.ExpoSpeechRecognitionModule ?? null;
const speechAvailable = SpeechModule !== null && typeof SpeechModule.start === "function";

interface CaptureScreenProps {
  onSubmit: (thought: string) => void;
  isLoading: boolean;
  /** True for 1.5 s immediately after a successful API response — triggers the StreakBadge animation. */
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

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  // Interim (in-progress) transcript shown while the user is speaking
  const [interimText, setInterimText] = useState("");
  // Ref so the speech event handler always reads the latest thought value
  const thoughtRef = useRef(thought);
  useEffect(() => { thoughtRef.current = thought; }, [thought]);

  // Animated values for various interactive elements
  const sendScale = useSharedValue(1);      // Bounce scale on send button press
  const sendActive = useSharedValue(0);     // 0 = disabled, 1 = enabled
  const nudgeOpacity = useSharedValue(0);   // Streak reminder visibility
  const reviewProgress = useSharedValue(0); // Cross-fade between input/review layers
  const micBg = useSharedValue(0);          // Mic background: 0=dark, 1=red
  const micPulse = useSharedValue(1);       // Mic pulse scale while recording

  // Speech recognition event listeners — only active when native module is present.
  // We use useEffect (same hook-call count as useSpeechRecognitionEvent internally)
  // so React's rules of hooks are satisfied regardless of speechAvailable.
  useEffect(() => {
    if (!SpeechModule) return;
    const sub = SpeechModule.addListener("result", (event: any) => {
      if (event.isFinal) {
        const transcript = event.results[0]?.transcript ?? "";
        if (transcript) {
          const base = thoughtRef.current.trim();
          setThought(base ? `${base} ${transcript}` : transcript);
        }
        setInterimText("");
      } else {
        setInterimText(event.results[0]?.transcript ?? "");
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!SpeechModule) return;
    const sub = SpeechModule.addListener("end", () => {
      setIsRecording(false);
      setInterimText("");
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate mic button whenever recording state changes
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

  const canSend = thought.trim().length > 0 && !isLoading;
  const showNudge = currentStreak > 0 && !reflectedToday;

  // Cycle through three streak nudge messages based on streak number
  const nudgeMessages = [
    `${currentStreak} day streak — keep it going`,
    `${currentStreak} days strong — don't stop now`,
    `You're on a ${currentStreak} day run`,
  ];
  const nudgeText = nudgeMessages[currentStreak % nudgeMessages.length];

  // Animate send button enabled state
  useEffect(() => {
    sendActive.value = withTiming(canSend ? 1 : 0, { duration: 200 });
  }, [canSend]);

  // Fade streak nudge in/out
  useEffect(() => {
    nudgeOpacity.value = withTiming(showNudge ? 1 : 0, { duration: 300 });
  }, [showNudge]);

  // Cross-fade between input and review layers using cubic easing for smoothness
  useEffect(() => {
    reviewProgress.value = withTiming(isReviewing ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [isReviewing]);

  // Send button: opacity and colour react to canSend
  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: 0.35 + sendActive.value * 0.65,
    backgroundColor: interpolateColor(
      sendActive.value,
      [0, 1],
      ["#3A3A3A", "#FFFFFF"]
    ),
  }));

  // Mic button: pulses and turns red while recording
  const micBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
    backgroundColor: interpolateColor(
      micBg.value,
      [0, 1],
      ["#2C2C2C", "#E03030"]
    ),
  }));

  // Soft glow halo that expands behind the mic when recording
  const micGlowStyle = useAnimatedStyle(() => ({
    opacity: micBg.value * 0.35,
    transform: [{ scale: 1 + micBg.value * 0.25 + (micPulse.value - 1) * 1.4 }],
  }));

  const nudgeStyle = useAnimatedStyle(() => ({
    opacity: nudgeOpacity.value,
  }));

  // Input layer fades out as reviewProgress increases
  const inputLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - reviewProgress.value,
  }));

  // Review layer fades in as reviewProgress increases
  const reviewLayerStyle = useAnimatedStyle(() => ({
    opacity: reviewProgress.value,
  }));

  const handleSubmit = () => {
    if (!canSend) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Bouncy scale feedback on send button tap
    sendScale.value = withSpring(0.9, { damping: 6 }, () => {
      sendScale.value = withSpring(1, { damping: 8 });
    });
    onSubmit(thought.trim());
  };

  /** Toggle the microphone: request permission, start/stop speech recognition. */
  const handleMicPress = async () => {
    if (!speechAvailable) {
      Alert.alert(
        "Voice capture unavailable",
        "Voice capture requires a native build. Please install the app via TestFlight or a custom dev client.",
      );
      return;
    }
    if (isRecording) {
      SpeechModule!.stop();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { granted } = await SpeechModule!.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Microphone permission required",
        "Please enable microphone access in Settings to use voice capture.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ],
      );
      return;
    }
    setIsRecording(true);
    SpeechModule!.start({
      lang: "en-US",
      interimResults: true,
      continuous: false,
    });
  };

  /** Return to the capture input and clear the current session. */
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToCapture();
  };

  /** Open the GamePanel for the tapped distorted word. */
  const handleWordPress = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openGame(idx);
  };

  // Full-screen loading state — replaces the entire layered UI
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ThinkingAnimation />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Input layer — pointer events disabled while reviewing so taps reach the review layer */}
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

              {/* Interim transcript preview while speaking */}
              {interimText.length > 0 && (
                <Text style={styles.interimText} numberOfLines={2}>
                  {interimText}
                </Text>
              )}

              <View style={styles.toolbar}>
                {/* Mic button — always visible on native (iOS/Android); hidden on web.
                    If the speech module failed to load, tapping shows an error message. */}
                {Platform.OS !== "web" && (
                <Pressable onPress={handleMicPress} hitSlop={8}>
                  <View style={styles.micWrap}>
                    {/* Glow halo behind the button */}
                    <Animated.View style={[styles.micGlow, micGlowStyle]} />
                    <Animated.View style={[styles.micBtn, micBtnStyle]}>
                      <Ionicons
                        name={isRecording ? "stop" : "mic"}
                        size={18}
                        color="#fff"
                      />
                    </Animated.View>
                  </View>
                </Pressable>
                )}

                {/* Send button — icon colour inverts with the background */}
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

      {/* Review layer — pointer events disabled while in capture mode */}
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
          {/* Review top bar: back button + progress counter */}
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

          {/* Annotated card: scrollable so long thoughts don't clip */}
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

              {/* "All reframed" banner appears once every significant word is done */}
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

      {/* GamePanel is always rendered so its modal can react to screen state changes
          without being unmounted during the review→game transition */}
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
  interimText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    fontStyle: "italic",
    paddingHorizontal: 2,
    paddingTop: 8,
    lineHeight: 20,
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
