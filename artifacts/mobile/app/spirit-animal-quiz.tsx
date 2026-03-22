/**
 * Spirit Animal Quiz — full-screen modal route.
 *
 * Fetches 3 multiple-choice questions from the API on mount, presents them one
 * at a time, user taps a choice to answer, then calls the API with all answers
 * to identify the user's spirit animal. Shows a loading state, then reveals the
 * result with "This is me" / "Try again" actions.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { useSpiritAnimal } from "@/context/SpiritAnimalContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

type Phase = "loading-questions" | "quiz" | "generating" | "result" | "error-questions" | "error-evaluation";

interface QuizQuestion {
  question: string;
  choices: string[];
}

interface Answer {
  question: string;
  answer: string;
}

interface AnimalResult {
  animal: string;
  description: string;
  svg: string;
}

export default function SpiritAnimalQuizScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSpiritAnimal } = useSpiritAnimal();

  const [phase, setPhase] = useState<Phase>("loading-questions");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<AnimalResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Fetch questions on mount
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Fade in when question changes
  useEffect(() => {
    if (phase === "quiz") {
      fadeIn();
    }
  }, [phase, currentIndex]);

  // Fade in result
  useEffect(() => {
    if (phase === "result") {
      fadeIn();
    }
  }, [phase]);

  async function fetchQuestions() {
    setPhase("loading-questions");
    try {
      const res = await fetch(`${API_BASE}/api/spirit-animal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      if (!Array.isArray(data.questions) || data.questions.length < 3) {
        throw new Error("Invalid questions response");
      }
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers([]);
      setPhase("quiz");
    } catch {
      setErrorMsg("Couldn't load questions. Please try again.");
      setPhase("error-questions");
    }
  }

  async function evaluateAnswers(allAnswers: Answer[]) {
    setPhase("generating");
    try {
      const res = await fetch(`${API_BASE}/api/spirit-animal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: allAnswers }),
      });
      if (!res.ok) throw new Error("Failed to evaluate");
      const data = await res.json();
      if (!data.animal || !data.description || !data.svg) {
        throw new Error("Invalid result");
      }
      setResult(data);
      setPhase("result");
    } catch {
      setErrorMsg("Couldn't identify your guide. Try again?");
      setPhase("error-evaluation");
    }
  }

  function handleChoiceSelect(choice: string) {
    const newAnswer: Answer = {
      question: questions[currentIndex].question,
      answer: choice,
    };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      evaluateAnswers(newAnswers);
    }
  }

  function handleAccept() {
    if (!result) return;
    setSpiritAnimal(result);
    router.back();
  }

  function handleTryAgain() {
    setResult(null);
    evaluateAnswers(answers);
  }

  function handleClose() {
    router.back();
  }

  if (phase === "loading-questions") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <ActivityIndicator color="rgba(255,255,255,0.6)" size="large" />
          <Text style={styles.loadingText}>Preparing your journey...</Text>
        </View>
      </View>
    );
  }

  if (phase === "generating") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.centerContent}>
          <ActivityIndicator color="rgba(255,255,255,0.6)" size="large" />
          <Text style={styles.loadingText}>Discovering your guide...</Text>
          <Text style={styles.loadingSubtext}>Reading between the lines</Text>
        </View>
      </View>
    );
  }

  if (phase === "error-questions") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Pressable style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.primaryBtn} onPress={fetchQuestions}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "error-evaluation") {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Pressable style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => evaluateAnswers(answers)}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleClose}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "result" && result) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar style="light" />
        <Pressable style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <Animated.View style={[styles.resultContainer, { opacity: fadeAnim }]}>
          <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.animalAvatar}>
              <SvgXml xml={result.svg} width={80} height={80} />
            </View>
            <Text style={styles.animalLabel}>your guide</Text>
            <Text style={styles.animalName}>{result.animal}</Text>
            <Text style={styles.animalDescription}>{result.description}</Text>

            <View style={styles.resultActions}>
              <Pressable style={styles.primaryBtn} onPress={handleAccept}>
                <Text style={styles.primaryBtnText}>This is me</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={handleTryAgain}>
                <Text style={styles.secondaryBtnText}>Try again</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    );
  }

  // Quiz phase
  const progress = (currentIndex + 1) / questions.length;
  const currentQ = questions[currentIndex];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.quizHeader}>
        <Pressable onPress={handleClose} hitSlop={16}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{currentIndex + 1} / {questions.length}</Text>
      </View>

      <Animated.View style={[styles.quizContent, { opacity: fadeAnim }]}>
        <Text style={styles.quizQuestion}>{currentQ.question}</Text>
      </Animated.View>

      <View style={[styles.choicesArea, { paddingBottom: insets.bottom + 24 }]}>
        {currentQ.choices.map((choice, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [styles.choiceBtn, pressed && styles.choiceBtnPressed]}
            onPress={() => handleChoiceSelect(choice)}
          >
            <Text style={styles.choiceBtnText}>{choice}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.4)",
  },
  quizHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 1,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    minWidth: 32,
    textAlign: "right",
  },
  quizContent: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  quizQuestion: {
    fontSize: 26,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  choicesArea: {
    paddingHorizontal: 20,
    gap: 10,
  },
  choiceBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  choiceBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  choiceBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  resultContainer: {
    flex: 1,
  },
  resultScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 24,
    gap: 16,
  },
  animalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  animalLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  animalName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1,
    textTransform: "capitalize",
  },
  animalDescription: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 24,
    marginTop: 4,
  },
  resultActions: {
    width: "100%",
    gap: 10,
    marginTop: 24,
  },
  primaryBtn: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
    letterSpacing: -0.3,
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
});
