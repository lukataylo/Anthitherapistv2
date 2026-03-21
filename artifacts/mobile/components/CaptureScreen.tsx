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
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
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
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useStreak } from "@/context/StreakContext";
import { useJournalSession } from "@/context/JournalSessionContext";
import { matchPatterns } from "@/utils/patternMatcher";
import { getPatternQuestion } from "@/utils/patternQuestions";
import { cumulativeEmotionalScore, CHECKIN_THRESHOLD } from "@/utils/emotionalScoring";
import type { Turn, FeedbackPayload, HighlightItem, Session, Analysis } from "@/types/journal";

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

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function callAnalyseTurn(
  turnId: string,
  sessionId: string,
  rawText: string,
) {
  try {
    const res = await fetch(`${API_BASE}/api/analyse-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnId, sessionId, rawText }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function callSummariseSession(
  sessionId: string,
  turns: Turn[],
  dominantEmotions: string[],
) {
  try {
    const res = await fetch(`${API_BASE}/api/summarise-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        turns: turns.map((t) => ({
          rawText: t.rawText,
          flags: t.flags.map((f) => ({
            category: f.category,
            severity: f.severity,
            matchedText: f.matchedText,
          })),
        })),
        dominantEmotions,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const SEVERITY_COLORS: Record<string, string> = {
  high: "#FF5B5B",
  med: "#F97316",
  low: "#6B6B8A",
};

const MOOD_OPTIONS: Array<{ mood: Session["moodOnOpen"]; emoji: string; label: string }> = [
  { mood: "happy", emoji: "😊", label: "Good" },
  { mood: "okay", emoji: "😐", label: "Okay" },
  { mood: "sad", emoji: "😢", label: "Sad" },
  { mood: "stressed", emoji: "😰", label: "Stressed" },
  { mood: "angry", emoji: "😤", label: "Angry" },
];

const WRAP_UP_QUESTIONS = [
  "What feels different now compared to when you started?",
  "If you could name one thing you're carrying, what would it be?",
  "What do you want to remember from this?",
];

type ScreenMode = "mood-select" | "journaling" | "wrapping" | "loading-summary" | "summary";

type InsightCard = {
  id: string;
  title: string;
  body: string;
  category: string;
};

type SummaryData = {
  overallSummary: string;
  insights: InsightCard[];
};

export function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const { recordReflection } = useStreak();
  const {
    session,
    turns,
    analyses,
    startSession,
    addTurn,
    storeAnalysis,
    wrapSession,
    acknowledgeCheckIn,
    markCheckInShown,
    clearSession,
  } = useJournalSession();

  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<ScreenMode>(session ? "journaling" : "mood-select");
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (session && mode === "mood-select") {
      setMode("journaling");
    }
    if (!session && mode === "journaling") {
      setMode("mood-select");
    }
  }, [session]);
  const [feedbackPayload, setFeedbackPayload] = useState<FeedbackPayload | null>(null);
  const [summaryTurns, setSummaryTurns] = useState<Turn[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [insightResponses, setInsightResponses] = useState<Record<string, "agree" | "disagree">>({});
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null);
  const [questionKey, setQuestionKey] = useState(0);
  const [wrapQuestionIndex, setWrapQuestionIndex] = useState(0);
  const pendingAnalysesRef = useRef(new Set<string>());

  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const inputTextRef = useRef(inputText);
  useEffect(() => { inputTextRef.current = inputText; }, [inputText]);

  const sendScale = useSharedValue(1);
  const sendActive = useSharedValue(0);
  const micBg = useSharedValue(0);
  const micPulse = useSharedValue(1);

  useEffect(() => {
    if (!SpeechModule) return;
    const sub = SpeechModule.addListener("result", (event: any) => {
      if (event.isFinal) {
        const transcript = event.results[0]?.transcript ?? "";
        if (transcript) {
          const base = inputTextRef.current.trim();
          setInputText(base ? `${base} ${transcript}` : transcript);
        }
        setInterimText("");
      } else {
        setInterimText(event.results[0]?.transcript ?? "");
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!SpeechModule) return;
    const sub = SpeechModule.addListener("end", () => {
      setIsRecording(false);
      setInterimText("");
    });
    return () => sub.remove();
  }, []);

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

  useEffect(() => {
    if (streakJustIncremented) {
      const t = setTimeout(() => setStreakJustIncremented(false), 1500);
      return () => clearTimeout(t);
    }
  }, [streakJustIncremented]);

  const canSend = inputText.trim().length > 0;
  const checkInState = session?.checkInState ?? "none";
  const currentPhase = session?.sessionPhase ?? "descent";
  const ascentTurnCount = currentPhase === "ascent" && session?.ascentStartIndex != null
    ? Math.max(0, turns.length - session.ascentStartIndex)
    : 0;

  useEffect(() => {
    sendActive.value = withTiming(canSend ? 1 : 0, { duration: 200 });
  }, [canSend]);

  useEffect(() => {
    if (checkInState === "pending") {
      markCheckInShown();
    }
  }, [checkInState]);

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
    opacity: micBg.value * 0.35,
    transform: [{ scale: 1 + micBg.value * 0.25 + (micPulse.value - 1) * 1.4 }],
  }));

  const handleMoodSelect = (mood: Session["moodOnOpen"]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startSession(mood);
    setMode("journaling");
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleMicPress = async () => {
    if (!speechAvailable) {
      Alert.alert("Voice capture unavailable", "Requires a native build.");
      return;
    }
    if (isRecording) { SpeechModule!.stop(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { granted } = await SpeechModule!.requestPermissionsAsync();
    if (!granted) {
      Alert.alert("Microphone permission required", "Enable in Settings.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setIsRecording(true);
    SpeechModule!.start({ lang: "en-US", interimResults: true, continuous: false });
  };

  const handleSend = () => {
    if (!canSend) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.9, { damping: 6 }, () => {
      sendScale.value = withSpring(1, { damping: 8 });
    });

    const text = inputText.trim();
    setInputText("");

    let activeSession = session;
    let sessionOverride: typeof session = null;
    if (!activeSession) {
      activeSession = startSession("okay");
      sessionOverride = activeSession;
    }

    const flags = matchPatterns(text);
    const turn = addTurn(text, flags, sessionOverride ?? undefined);
    if (!turn) return;

    const question = getPatternQuestion(flags, turns.length);
    setSuggestedQuestion(question);
    setQuestionKey((k) => k + 1);

    if (activeSession) {
      pendingAnalysesRef.current.add(turn.id);
      callAnalyseTurn(turn.id, activeSession.id, text).then((analysis) => {
        pendingAnalysesRef.current.delete(turn.id);
        if (analysis) storeAnalysis(analysis);
      }).catch(() => {
        pendingAnalysesRef.current.delete(turn.id);
      });
    }

    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  const handleWrapSend = () => {
    if (!canSend) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const text = inputText.trim();
    setInputText("");

    const flags = matchPatterns(text);
    addTurn(text, flags);

    if (wrapQuestionIndex < WRAP_UP_QUESTIONS.length - 1) {
      setWrapQuestionIndex((i) => i + 1);
      setQuestionKey((k) => k + 1);
    } else {
      finishSession();
    }
  };

  const handleWrapUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setMode("wrapping");
    setWrapQuestionIndex(0);
    setQuestionKey((k) => k + 1);
    setSuggestedQuestion(null);
  };

  const finishSession = async () => {
    setMode("loading-summary");

    if (pendingAnalysesRef.current.size > 0) {
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
          if (pendingAnalysesRef.current.size === 0 || Date.now() - start > 3000) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    const savedTurns = [...turns];
    setSummaryTurns(savedTurns);
    recordReflection();
    setStreakJustIncremented(true);
    const payload = wrapSession();

    if (!payload) {
      setMode(session ? "journaling" : "mood-select");
      return;
    }

    setFeedbackPayload(payload);

    try {
      const summary = await callSummariseSession(
        payload.sessionId,
        savedTurns,
        payload.dominantEmotions,
      );

      if (summary?.overallSummary && Array.isArray(summary?.insights)) {
        setSummaryData(summary);
      } else {
        setSummaryData({
          overallSummary: payload.dominantEmotions.length > 0
            ? `You explored feelings of ${payload.dominantEmotions.slice(0, 3).join(", ")}.`
            : "You took time to reflect today.",
          insights: [],
        });
      }
    } catch {
      setSummaryData({
        overallSummary: "You took time to reflect today.",
        insights: [],
      });
    }
    setMode("summary");
  };

  const handleKeepGoing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    acknowledgeCheckIn("continuing");
  };

  const handleWindDown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    acknowledgeCheckIn("wrapping");
    handleWrapUp();
  };

  const handleStartFresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFeedbackPayload(null);
    setSummaryTurns([]);
    setSummaryData(null);
    setInsightResponses({});
    setMode("mood-select");
    setInputText("");
    setSuggestedQuestion(null);
    clearSession();
  };

  const handlePlayGame = (gameId: string) => {
    handleStartFresh();
    router.navigate("/history" as any);
    if (gameId) {
      setTimeout(() => {
        router.navigate({ pathname: "/history", params: { game: gameId } } as any);
      }, 300);
    }
  };

  const handleInsightResponse = (id: string, response: "agree" | "disagree") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInsightResponses((prev) => ({ ...prev, [id]: response }));
  };

  const isWrapping = mode === "wrapping";
  const showCheckin = (checkInState === "shown" || checkInState === "pending") && !isWrapping;
  const showAscentNudge = currentPhase === "ascent" && ascentTurnCount >= 3 && !isWrapping;
  const emotionalScore = cumulativeEmotionalScore(turns);
  const showEmotionalCheckin = emotionalScore >= CHECKIN_THRESHOLD && checkInState === "none" && turns.length >= 3 && !isWrapping;

  if (mode === "mood-select") {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 14,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.moodContainer}>
          <Text style={styles.moodTitle}>How are you feeling?</Text>
          <Text style={styles.moodSubtitle}>Tap to begin</Text>
          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((opt) => (
              <Pressable
                key={opt.mood}
                onPress={() => handleMoodSelect(opt.mood)}
                style={({ pressed }) => [
                  styles.moodBtn,
                  { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
                ]}
              >
                <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                <Text style={styles.moodLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (mode === "loading-summary") {
    return (
      <ReflectionLoadingScreen
        turns={summaryTurns}
        analyses={analyses}
        insets={insets}
      />
    );
  }

  if (mode === "summary" && summaryData) {
    return (
      <SummaryScreen
        summaryData={summaryData}
        payload={feedbackPayload}
        turns={summaryTurns}
        insightResponses={insightResponses}
        onInsightResponse={handleInsightResponse}
        onStartFresh={handleStartFresh}
        onPlayGame={handlePlayGame}
        insets={insets}
        showStreakAnimation={streakJustIncremented}
      />
    );
  }

  const currentWrapQuestion = isWrapping ? WRAP_UP_QUESTIONS[wrapQuestionIndex] : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
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
          {turns.length >= 2 && !isWrapping && (
            <Pressable
              onPress={handleWrapUp}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <View style={styles.endBtn}>
                <Text style={styles.endBtnText}>Wrap up</Text>
              </View>
            </Pressable>
          )}
          {isWrapping && (
            <Pressable
              onPress={finishSession}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <View style={styles.endBtn}>
                <Text style={styles.endBtnText}>Skip</Text>
              </View>
            </Pressable>
          )}
        </View>

        {(suggestedQuestion || currentWrapQuestion) && !showCheckin && (
          <Animated.View
            key={questionKey}
            entering={SlideInLeft.duration(400).springify()}
            exiting={SlideOutLeft.duration(250)}
            style={styles.questionRow}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>t</Text>
            </View>
            <Text style={styles.questionText}>
              {isWrapping ? currentWrapQuestion : suggestedQuestion}
            </Text>
          </Animated.View>
        )}

        {!suggestedQuestion && !currentWrapQuestion && !showCheckin && turns.length === 0 && (
          <View style={styles.questionRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>t</Text>
            </View>
            <Text style={styles.hintText}>
              Write whatever comes up. I'll listen.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.inputSection}>
            <TextInput
              ref={inputRef}
              style={styles.boldInput as any}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isWrapping ? "Reflect..." : (turns.length === 0 ? "What's on your mind?" : "Keep writing...")}
              placeholderTextColor="rgba(255,255,255,0.15)"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              selectionColor="rgba(255,255,255,0.5)"
              autoFocus={false}
              scrollEnabled={false}
              onSubmitEditing={isWrapping ? handleWrapSend : handleSend}
            />

            {interimText.length > 0 && (
              <Text style={styles.interimText} numberOfLines={2}>
                {interimText}
              </Text>
            )}

            <View style={styles.inputActions}>
              <Pressable onPress={handleMicPress} hitSlop={8}>
                <View style={styles.micWrap}>
                  <Animated.View style={[styles.micGlow, micGlowStyle]} />
                  <Animated.View style={[styles.actionBtn, micBtnStyle]}>
                    <Ionicons
                      name={isRecording ? "stop" : "mic"}
                      size={16}
                      color="#fff"
                    />
                  </Animated.View>
                </View>
              </Pressable>
              <Pressable
                onPress={isWrapping ? handleWrapSend : handleSend}
                disabled={!canSend}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <Animated.View style={[styles.actionBtn, sendBtnStyle]}>
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={canSend ? "#000" : "#fff"}
                  />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </View>

          <ScrollView
            ref={scrollRef}
            style={turns.length > 0 ? styles.turnsScroll : { display: "none" }}
            contentContainerStyle={styles.turnsContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollRef.current?.scrollTo({ y: 0, animated: true })
            }
          >
            {[...turns].reverse().map((turn, i) => (
              <TurnBubble
                key={turn.id}
                turn={turn}
                isLast={i === 0}
                fadeLevel={i}
              />
            ))}

            {(showCheckin || showEmotionalCheckin) && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.checkinCard}>
                <Text style={styles.checkinText}>
                  This feels heavy. Want to take a breath, or keep exploring?
                </Text>
                <View style={styles.checkinBtns}>
                  <Pressable
                    onPress={handleKeepGoing}
                    style={({ pressed }) => [
                      styles.checkinBtn,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={styles.checkinBtnText}>Keep going</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleWindDown}
                    style={({ pressed }) => [
                      styles.checkinBtnAlt,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={styles.checkinBtnAltText}>Enough for now</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {showAscentNudge && !showCheckin && !showEmotionalCheckin && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.ascentNudge}>
                <Text style={styles.ascentNudgeText}>
                  You've covered a lot of ground. Tap Wrap up when you're ready.
                </Text>
              </Animated.View>
            )}
          </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function TurnBubble({
  turn,
  isLast,
  fadeLevel,
}: {
  turn: Turn;
  isLast: boolean;
  fadeLevel: number;
}) {
  const opacity = Math.max(0.12, 1 - fadeLevel * 0.25);
  const uniqueLabels = Array.from(
    new Map(turn.flags.map((f) => [f.patternId, f])).values(),
  );
  return (
    <Animated.View
      entering={isLast ? FadeIn.duration(300) : undefined}
      style={[styles.turnBubble, { opacity }]}
    >
      <Text style={styles.turnText}>{turn.rawText}</Text>
      {isLast && uniqueLabels.length > 0 && (
        <View style={styles.chipRow}>
          {uniqueLabels.map((f) => (
            <View
              key={f.patternId}
              style={[styles.chip, { borderColor: SEVERITY_COLORS[f.severity] }]}
            >
              <Text
                style={[styles.chipText, { color: SEVERITY_COLORS[f.severity] }]}
              >
                {f.category.replace(/_/g, " ")}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  pattern: "🔄",
  belief: "💭",
  emotion: "❤️",
  strength: "✨",
};

type GameSuggestion = {
  id: string;
  name: string;
  icon: string;
  reason: string;
};

const GAME_SUGGESTIONS: Record<string, GameSuggestion> = {
  belief: {
    id: "reword",
    name: "Reword",
    icon: "swap-horizontal-outline",
    reason: "Practice reframing the beliefs that came up",
  },
  pattern: {
    id: "reality-check",
    name: "Reality Check",
    icon: "checkmark-circle-outline",
    reason: "Spot the patterns you noticed today",
  },
  emotion: {
    id: "mind-voyage",
    name: "Mind Voyage",
    icon: "boat-outline",
    reason: "Find the words behind the feelings",
  },
  strength: {
    id: "sort-tower",
    name: "Sort Tower",
    icon: "layers",
    reason: "Build on what you've learned",
  },
};

const DEFAULT_GAME: GameSuggestion = {
  id: "reality-check",
  name: "Reality Check",
  icon: "checkmark-circle-outline",
  reason: "Practice spotting distorted thoughts",
};

function pickGameForSession(insights: SummaryData["insights"]): GameSuggestion {
  for (const ins of insights) {
    const suggestion = GAME_SUGGESTIONS[ins.category];
    if (suggestion) return suggestion;
  }
  return DEFAULT_GAME;
}

function ReflectionLoadingScreen({
  turns,
  analyses,
  insets,
}: {
  turns: Turn[];
  analyses: Analysis[];
  insets: { top: number; bottom: number };
}) {
  const emotions = analyses
    .map((a) => a.dominantEmotion)
    .filter((e): e is string => !!e);
  const uniqueEmotions = Array.from(new Set(emotions));
  const beliefs = analyses
    .map((a) => a.beliefDetected)
    .filter((b): b is string => !!b);
  const uniqueBeliefs = Array.from(new Set(beliefs));

  const labels: string[] = [];
  uniqueEmotions.forEach((e) => labels.push(e));
  uniqueBeliefs.forEach((b) => labels.push(b));

  const displayTurns = turns.slice(-4);

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + 14,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <Text style={styles.reflectTitle}>Looking back at what you shared...</Text>
        </Animated.View>

        {displayTurns.map((turn, i) => (
          <Animated.View
            key={turn.id}
            entering={FadeIn.delay(400 + i * 600).duration(500)}
            style={styles.reflectTurn}
          >
            <Text style={styles.reflectTurnText}>"{turn.rawText}"</Text>
          </Animated.View>
        ))}

        {labels.length > 0 && (
          <Animated.View
            entering={FadeIn.delay(400 + displayTurns.length * 600).duration(500)}
            style={styles.reflectLabelsSection}
          >
            <Text style={styles.reflectLabelsTitle}>What we noticed</Text>
            <View style={styles.reflectLabelsRow}>
              {labels.slice(0, 6).map((label, i) => (
                <Animated.View
                  key={label}
                  entering={FadeIn.delay(400 + displayTurns.length * 600 + 200 + i * 200).duration(400)}
                >
                  <View style={styles.reflectLabel}>
                    <Text style={styles.reflectLabelText}>{label}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeIn.delay(400 + displayTurns.length * 600 + labels.length * 200 + 400).duration(400)}
          style={styles.reflectFooter}
        >
          <View style={styles.reflectDots}>
            <Animated.View
              entering={FadeIn.delay(0).duration(600)}
              style={styles.reflectDot}
            />
            <Animated.View
              entering={FadeIn.delay(300).duration(600)}
              style={styles.reflectDot}
            />
            <Animated.View
              entering={FadeIn.delay(600).duration(600)}
              style={styles.reflectDot}
            />
          </View>
          <Text style={styles.reflectFooterText}>Preparing your reflection</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SummaryScreen({
  summaryData,
  payload,
  turns,
  insightResponses,
  onInsightResponse,
  onStartFresh,
  onPlayGame,
  insets,
  showStreakAnimation,
}: {
  summaryData: SummaryData;
  payload: FeedbackPayload | null;
  turns: Turn[];
  insightResponses: Record<string, "agree" | "disagree">;
  onInsightResponse: (id: string, response: "agree" | "disagree") => void;
  onStartFresh: () => void;
  onPlayGame: (gameId: string) => void;
  insets: { top: number; bottom: number };
  showStreakAnimation: boolean;
}) {
  const suggestedGame = pickGameForSession(summaryData.insights);

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + 14,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: "#000",
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.feedbackScroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <Text style={styles.summaryTitle}>Session complete</Text>
          <Text style={styles.summaryOverall}>{summaryData.overallSummary}</Text>
        </Animated.View>

        {summaryData.insights.length > 0 && (
          <View style={styles.insightsBlock}>
            <Text style={styles.insightsLabel}>
              Do these resonate with you?
            </Text>
            {summaryData.insights.map((insight, idx) => {
              const responded = insightResponses[insight.id];
              return (
                <Animated.View
                  key={insight.id}
                  entering={FadeIn.delay(200 + idx * 150).duration(400)}
                  style={styles.insightCard}
                >
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightIcon}>
                      {CATEGORY_ICONS[insight.category] ?? "💡"}
                    </Text>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                  </View>
                  <Text style={styles.insightBody}>{insight.body}</Text>
                  <View style={styles.insightActions}>
                    <Pressable
                      onPress={() => onInsightResponse(insight.id, "agree")}
                      style={({ pressed }) => [
                        styles.insightBtn,
                        responded === "agree" && styles.insightBtnActive,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={responded === "agree" ? "#000" : "rgba(255,255,255,0.6)"}
                      />
                      <Text
                        style={[
                          styles.insightBtnText,
                          responded === "agree" && styles.insightBtnTextActive,
                        ]}
                      >
                        Yes, that's true
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onInsightResponse(insight.id, "disagree")}
                      style={({ pressed }) => [
                        styles.insightBtn,
                        responded === "disagree" && styles.insightBtnDisagree,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={responded === "disagree" ? "#fff" : "rgba(255,255,255,0.6)"}
                      />
                      <Text
                        style={[
                          styles.insightBtnText,
                          responded === "disagree" && { color: "#fff" },
                        ]}
                      >
                        Not quite
                      </Text>
                    </Pressable>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <Animated.View
          entering={FadeIn.delay(summaryData.insights.length * 150 + 400).duration(400)}
          style={styles.ctaSection}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onPlayGame(suggestedGame.id);
            }}
            style={({ pressed }) => [
              styles.gameCard,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.gameCardLeft}>
              <View style={styles.gameCardIcon}>
                <Ionicons name={suggestedGame.icon as any} size={22} color="#fff" />
              </View>
              <View style={styles.gameCardText}>
                <Text style={styles.gameCardName}>Play {suggestedGame.name}</Text>
                <Text style={styles.gameCardReason}>{suggestedGame.reason}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPlayGame("");
            }}
            style={({ pressed }) => [
              styles.ctaBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.ctaBtnText}>Browse all games</Text>
          </Pressable>

          <Pressable
            onPress={onStartFresh}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginTop: 8 })}
          >
            <Text style={styles.startFreshLink}>Start fresh</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    minHeight: 34,
  },
  endBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  endBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.2,
  },
  moodContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  moodTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  moodSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    marginTop: -16,
  },
  moodGrid: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  moodBtn: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flex: 1,
    maxWidth: 72,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  loadingText: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: -0.5,
  },
  questionText: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  hintText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.2)",
    lineHeight: 24,
  },
  inputSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  boldInput: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
    letterSpacing: -0.5,
    minHeight: 60,
    paddingTop: 0,
    paddingBottom: 0,
    ...(Platform.OS === "web" ? { outlineWidth: 0, outlineStyle: "none" } : {}),
  },
  interimText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 4,
  },
  inputActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
  },
  micWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  micGlow: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E03030",
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 20,
  },
  turnsScroll: {
    flex: 1,
  },
  turnsContent: {
    padding: 20,
    paddingTop: 16,
    gap: 16,
  },
  turnBubble: {
    gap: 6,
  },
  turnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    textTransform: "lowercase",
  },
  checkinCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  checkinText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    lineHeight: 22,
  },
  checkinBtns: {
    flexDirection: "row",
    gap: 10,
  },
  checkinBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  checkinBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  checkinBtnAlt: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  checkinBtnAltText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  ascentNudge: {
    paddingVertical: 8,
    alignItems: "center",
  },
  ascentNudgeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    lineHeight: 18,
  },
  feedbackScroll: {
    paddingBottom: 40,
    gap: 24,
  },
  summaryTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
    paddingTop: 8,
  },
  summaryOverall: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 26,
    marginTop: 8,
  },
  insightsBlock: {
    gap: 16,
  },
  insightsLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.2,
  },
  insightCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightIcon: {
    fontSize: 20,
  },
  insightTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.2,
    flex: 1,
  },
  insightBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 22,
  },
  insightActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  insightBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  insightBtnActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  insightBtnDisagree: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  insightBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  insightBtnTextActive: {
    color: "#000",
  },
  ctaSection: {
    gap: 14,
    marginTop: 24,
    alignItems: "center",
  },
  ctaBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  ctaBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.1,
  },
  startFreshLink: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    paddingVertical: 8,
  },
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    width: "100%",
  },
  gameCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  gameCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  gameCardText: {
    flex: 1,
    gap: 3,
  },
  gameCardName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    letterSpacing: -0.2,
  },
  gameCardReason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 18,
  },
  reflectTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  reflectTurn: {
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255,255,255,0.08)",
  },
  reflectTurnText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 24,
  },
  reflectLabelsSection: {
    gap: 12,
    marginTop: 8,
  },
  reflectLabelsTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  reflectLabelsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reflectLabel: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reflectLabelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  reflectFooter: {
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  reflectDots: {
    flexDirection: "row",
    gap: 6,
  },
  reflectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  reflectFooterText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.25)",
  },
});
