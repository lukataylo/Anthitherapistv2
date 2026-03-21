/**
 * SailGame (Mind Voyage) — word-level distortion classification game.
 *
 * Players see a thought with one word highlighted and must decide whether that
 * specific word represents distorted thinking (× ERROR) or is valid (✓ VALID).
 * Each correct answer advances a sailboat across a moonlit sea. The game ends
 * when the boat reaches the far shore, all rounds are exhausted, or time runs out.
 *
 * ## CBT rationale
 *
 * Unlike ThoughtCheckGame (whole-thought awareness), SailGame targets
 * word-level precision — training users to pinpoint exactly which word in a
 * thought is distorted, not just whether the overall thought is problematic.
 * This mirrors the CBT technique of "thought deconstruction", where the
 * therapist helps the client identify the precise distorted language rather
 * than dismissing the thought wholesale.
 *
 * ## Round generation — `buildRounds`
 *
 * Each round highlights a single word from a thought. Rounds are sourced from:
 *  1. The user's history — for each entry, EVERY significant (non-neutral) word
 *     creates its own separate round. A thought with 3 distorted words produces
 *     3 rounds. Each round carries an `allWords` array with all distorted words
 *     from that entry (used by the annotation overlay). Capped at 8 history rounds
 *     after expansion.
 *  2. `DISTORTED_FALLBACK` — curated fallback rounds when history is sparse.
 *     These do not carry `allWords` (no annotation overlay shown).
 *  3. `HEALTHY` — 4 healthy thoughts where the highlighted word is deliberately
 *     not distorted (testing false-positive avoidance). No `allWords`.
 *
 * Final deck: up to 12 rounds, shuffled.
 *
 * ## Full-context annotation overlay
 *
 * After a correct answer on a history-derived round (one with `allWords`), a
 * 2-second overlay shows the FULL thought with every distorted word colored by
 * its cognitive distortion category. This teaches users to see the complete
 * distortion landscape of a thought, not just the word being tested. The overlay
 * auto-dismisses and advances to the next round. Answer buttons and the quit
 * button are hidden during this window to prevent accidental taps.
 *
 * ## Sailboat progress mechanic
 *
 * The boat's X position (`boatX`) starts at `BOAT_START` (16 px from left) and
 * advances `STEP` pixels per correct answer, targeting `BOAT_END`. `STEP` is
 * computed so 11 correct answers sail the full width. When `boatX` reaches
 * `BOAT_END`, the game transitions to "done" 500 ms later.
 *
 * A `ProgressTrack` bar below the scene interpolates `boatX` to a percentage
 * fill, giving a secondary progress indicator for players looking down at
 * the answer buttons.
 *
 * ## Explanation flow
 *
 * When a player answers incorrectly, `explanation` state is set (the text of
 * why the highlighted word is or isn't distorted). The thought card is replaced
 * by an explanation card. The player taps to dismiss and advance to the next
 * round. This ensures wrong answers teach rather than just penalise.
 *
 * ## CrescentMoon rendering
 *
 * The crescent shape is achieved by compositing two circles: a full `MOON`-
 * coloured circle and a slightly smaller `SKY`-coloured circle offset to the
 * upper-right. CSS/SVG would use `clip-path` or `border-radius` tricks, but
 * React Native View composition is the equivalent here without requiring an
 * SVG library.
 *
 * ## Timer
 *
 * A 90-second countdown (displayed as "1:30", "1:29", etc.) drives urgency.
 * The timer is managed via `setInterval` in a ref to avoid stale closure bugs
 * that would occur if it captured `timeLeft` state directly. `timeLeftRef`
 * holds the mutable countdown value; `setTimeLeft` syncs it to React state for
 * display.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { HistoryEntry } from "@/context/HistoryContext";
import { QuitButton } from "@/components/QuitButton";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Colors ──────────────────────────────────────────────────────────────────

const SKY = "#47C4BC";
const SKY_TOP = "#5DD4CC";
const WATER = "#36B5AD";
const WATER_DEEP = "#2BA39C";
const MOON = "#8FD9D3";
const BOAT_COL = "#2A8882";
const STAR_COL = "#C0ECEC";
const HORIZON = "rgba(255,255,255,0.22)";
const HIGHLIGHT_BG = "#00E5CC";
const HIGHLIGHT_TXT = "#002E2A";

// ─── Layout ───────────────────────────────────────────────────────────────────

const HORIZON_Y = SH * 0.44;
const BOAT_Y = HORIZON_Y - 16;
const BOAT_START = 16;
const BOAT_END = SW - 52;
const TOTAL_STEPS = 11;
const STEP = (BOAT_END - BOAT_START) / TOTAL_STEPS;
const GAME_SEC = 90;

// ─── Star positions (fixed) ───────────────────────────────────────────────────

const STARS = [
  { x: 0.10, y: 0.06 },
  { x: 0.35, y: 0.04 },
  { x: 0.62, y: 0.08 },
  { x: 0.84, y: 0.05 },
  { x: 0.17, y: 0.20 },
  { x: 0.78, y: 0.17 },
  { x: 0.91, y: 0.28 },
  { x: 0.05, y: 0.32 },
  { x: 0.93, y: 0.36 },
  { x: 0.48, y: 0.02 },
];

// ─── Category explanations ────────────────────────────────────────────────────

const EXPLAIN: Record<string, string> = {
  overgeneralization: "uses absolute language that turns one event into a universal rule.",
  catastrophizing: "exaggerates how bad the outcome might be.",
  black_white: "ignores the space between extremes — all-or-nothing thinking.",
  mind_reading: "assumes what others think without real evidence.",
  labeling: "defines the whole self based on a single moment.",
  emotional_reasoning: "treats a feeling as a proven fact.",
  magnification: "blows the situation out of proportion.",
  personalization: "assigns excessive blame without fair evidence.",
  should_statements: "creates a rigid rule that generates guilt.",
  fortune_telling: "predicts a negative outcome as if it were certain.",
};

// ─── Category → highlight color map ─────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  overgeneralization: "#FF9F40",
  catastrophizing:    "#FF6B6B",
  black_white:        "#C77DFF",
  mind_reading:       "#4CC9F0",
  labeling:           "#F72585",
  emotional_reasoning:"#FFD166",
  magnification:      "#06D6A0",
  personalization:    "#FF9A3C",
  should_statements:  "#A8DADC",
  fortune_telling:    "#B5E48C",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Round = {
  thought: string;
  highlight: string;
  isError: boolean;
  explanation: string;
  allWords?: Array<{ word: string; category: string }>;
};

type Phase = "idle" | "playing" | "done";

// ─── Built-in rounds ─────────────────────────────────────────────────────────

const HEALTHY: Round[] = [
  {
    thought: "I made a mistake and I can learn from it.",
    highlight: "learn",
    isError: false,
    explanation: "",
  },
  {
    thought: "This is difficult but I can handle it step by step.",
    highlight: "handle",
    isError: false,
    explanation: "",
  },
  {
    thought: "Not everything went as planned but that is manageable.",
    highlight: "manageable",
    isError: false,
    explanation: "",
  },
  {
    thought: "I did my best given the circumstances.",
    highlight: "best",
    isError: false,
    explanation: "",
  },
  {
    thought: "Some things are outside my control and that is okay.",
    highlight: "control",
    isError: false,
    explanation: "",
  },
];

const DISTORTED_FALLBACK: Round[] = [
  {
    thought: "I always fail at everything I try.",
    highlight: "always",
    isError: true,
    explanation:
      '"Always" overgeneralizes — one setback does not define every future attempt.',
  },
  {
    thought: "Nobody ever listens to what I say.",
    highlight: "Nobody",
    isError: true,
    explanation:
      '"Nobody" is an absolute that rarely reflects reality.',
  },
  {
    thought: "This is the worst thing that could have happened.",
    highlight: "worst",
    isError: true,
    explanation:
      '"Worst" catastrophizes — difficult events are rarely the absolute worst possibility.',
  },
  {
    thought: "I am completely worthless and useless.",
    highlight: "worthless",
    isError: true,
    explanation:
      'Labeling yourself this way based on a single moment is not accurate.',
  },
  {
    thought: "Everyone must think I am stupid after that.",
    highlight: "Everyone",
    isError: true,
    explanation:
      '"Everyone" overgeneralizes — we cannot know what all people think.',
  },
  {
    thought: "I will never get any better at this.",
    highlight: "never",
    isError: true,
    explanation:
      '"Never" is fortune-telling — skills and circumstances change with time.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRounds(entries: HistoryEntry[]): Round[] {
  const fromHistory: Round[] = [];
  for (const e of entries) {
    const dw = e.words.filter((w) => w.category !== "neutral");
    if (!dw.length) continue;
    const allWords = dw.map((w) => ({ word: w.word, category: w.category }));
    for (const w of dw) {
      const desc = EXPLAIN[w.category] ?? "reflects distorted thinking.";
      fromHistory.push({
        thought: e.thought,
        highlight: w.word,
        isError: true,
        explanation: `"${w.word}" ${desc}`,
        allWords,
      });
    }
  }

  const historySlice = fromHistory.slice(0, 8);
  const distorted = shuffle([
    ...historySlice,
    ...DISTORTED_FALLBACK.slice(0, Math.max(0, 5 - historySlice.length)),
  ]);

  return shuffle([...distorted.slice(0, 8), ...shuffle(HEALTHY).slice(0, 4)]).slice(0, 12);
}

// ─── Scene components ─────────────────────────────────────────────────────────

function SceneBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sky */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: HORIZON_Y + 2,
          backgroundColor: SKY,
        }}
      />
      {/* Sky top glow (lighter) */}
      <View
        style={{
          position: "absolute",
          top: -SH * 0.18,
          left: -SW * 0.2,
          width: SW * 1.4,
          height: HORIZON_Y * 0.75,
          borderRadius: SW,
          backgroundColor: SKY_TOP,
          opacity: 0.45,
        }}
      />

      {/* Diamond stars */}
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: s.x * SW,
            top: s.y * HORIZON_Y,
            width: 5,
            height: 5,
            backgroundColor: STAR_COL,
            opacity: 0.65,
            transform: [{ rotate: "45deg" }],
            borderRadius: 1,
          }}
        />
      ))}

      {/* Crescent moon */}
      <CrescentMoon />

      {/* Horizon line */}
      <View
        style={{
          position: "absolute",
          top: HORIZON_Y,
          left: 0,
          right: 0,
          height: 1.5,
          backgroundColor: HORIZON,
        }}
      />

      {/* Water */}
      <View
        style={{
          position: "absolute",
          top: HORIZON_Y + 1,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: WATER,
        }}
      />
      {/* Water darkens toward bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SH * 0.28,
          backgroundColor: WATER_DEEP,
          opacity: 0.42,
        }}
      />

      {/* Moon glow reflection in water */}
      <View
        style={{
          position: "absolute",
          top: HORIZON_Y + 6,
          left: SW / 2 - 44,
          width: 88,
          height: 44,
          borderRadius: 44,
          backgroundColor: MOON,
          opacity: 0.14,
        }}
      />
    </View>
  );
}

function CrescentMoon() {
  const SIZE = Math.min(SW * 0.44, 168);
  const CUT = SIZE * 0.87;
  return (
    <View
      style={{
        position: "absolute",
        top: HORIZON_Y * 0.16,
        left: SW / 2 - SIZE / 2,
        width: SIZE,
        height: SIZE,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: MOON,
        }}
      />
      {/* Sky-colored circle to carve out the crescent */}
      <View
        style={{
          position: "absolute",
          left: SIZE * 0.19,
          top: SIZE * -0.09,
          width: CUT,
          height: CUT,
          borderRadius: CUT / 2,
          backgroundColor: SKY,
        }}
      />
    </View>
  );
}

function Sailboat({ xAnim }: { xAnim: Animated.Value }) {
  const SailsAndHull = () => (
    <View style={{ alignItems: "flex-start", flexDirection: "column" }}>
      {/* Two sails side by side */}
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {/* Left sail — tall */}
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 9,
            borderRightWidth: 9,
            borderBottomWidth: 28,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: BOAT_COL,
            marginRight: 2,
          }}
        />
        {/* Right sail — shorter */}
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderBottomWidth: 18,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: BOAT_COL,
          }}
        />
      </View>
      {/* Hull — flat bar spanning full width of both sails */}
      <View
        style={{
          width: 36,
          height: 6,
          backgroundColor: BOAT_COL,
          marginTop: -1,
        }}
      />
    </View>
  );

  return (
    <>
      {/* Boat */}
      <Animated.View
        style={{
          position: "absolute",
          top: BOAT_Y,
          transform: [{ translateX: xAnim }],
        }}
      >
        <SailsAndHull />
      </Animated.View>
      {/* Reflection */}
      <Animated.View
        style={{
          position: "absolute",
          top: HORIZON_Y + 6,
          transform: [{ translateX: xAnim }],
          opacity: 0.22,
        }}
      >
        <View style={{ transform: [{ scaleY: -0.45 }] }}>
          <SailsAndHull />
        </View>
      </Animated.View>
    </>
  );
}

// ─── Thought with highlighted word ───────────────────────────────────────────

function ThoughtLine({ thought, highlight }: { thought: string; highlight: string }) {
  const words = thought.split(" ");
  const hlKey = highlight.toLowerCase().replace(/[^a-z]/g, "");

  return (
    <View style={styles.thoughtLine}>
      {words.map((word, i) => {
        const key = word.toLowerCase().replace(/[^a-z]/g, "");
        const isHL = key === hlKey;
        return (
          <View
            key={i}
            style={[
              styles.wordWrap,
              isHL && styles.wordWrapHL,
            ]}
          >
            <Text style={[styles.wordTxt, isHL && styles.wordTxtHL]}>
              {word}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Full-context annotation thought line ─────────────────────────────────────

function AnnotationThoughtLine({
  thought,
  allWords,
}: {
  thought: string;
  allWords: Array<{ word: string; category: string }>;
}) {
  const wordMap: Record<string, string> = {};
  for (const aw of allWords) {
    const key = aw.word.toLowerCase().replace(/[^a-z]/g, "");
    wordMap[key] = aw.category;
  }

  const words = thought.split(" ");
  return (
    <View style={styles.thoughtLine}>
      {words.map((word, i) => {
        const key = word.toLowerCase().replace(/[^a-z]/g, "");
        const category = wordMap[key];
        const color = category ? (CATEGORY_COLORS[category] ?? HIGHLIGHT_BG) : undefined;
        return (
          <View
            key={i}
            style={[
              styles.wordWrap,
              color ? { backgroundColor: color, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 } : undefined,
            ]}
          >
            <Text
              style={[
                styles.wordTxt,
                color ? { color: "#002E2A" } : undefined,
              ]}
            >
              {word}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Progress bar (boat advancement) ─────────────────────────────────────────

function ProgressTrack({ xAnim }: { xAnim: Animated.Value }) {
  const pct = xAnim.interpolate({
    inputRange: [BOAT_START, BOAT_END],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width: pct }]} />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SailGame({
  visible,
  entries,
  onClose,
}: {
  visible: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("idle");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [rIdx, setRIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SEC);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [feedbackColor, setFeedbackColor] = useState("#00E5CC");
  const [annotating, setAnnotating] = useState(false);

  const boatX = useRef(new Animated.Value(BOAT_START)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const boatXVal = useRef(BOAT_START);

  const phaseRef = useRef<Phase>("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef(GAME_SEC);
  const annotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotatingRef = useRef(false);

  useEffect(() => {
    const id = boatX.addListener(({ value }) => {
      boatXVal.current = value;
    });
    return () => boatX.removeListener(id);
  }, [boatX]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timeLeftRef.current = GAME_SEC;
    setTimeLeft(GAME_SEC);
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        stopTimer();
        if (phaseRef.current === "playing") {
          phaseRef.current = "done";
          setPhase("done");
        }
      }
    }, 1000);
  }, [stopTimer]);

  const advanceBoat = useCallback(() => {
    const next = Math.min(BOAT_END, boatXVal.current + STEP);
    Animated.timing(boatX, {
      toValue: next,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (next >= BOAT_END) {
      stopTimer();
      setTimeout(() => {
        if (phaseRef.current === "playing" && !annotatingRef.current) {
          phaseRef.current = "done";
          setPhase("done");
        }
      }, 500);
    }
  }, [boatX, stopTimer]);

  const flashFeedback = useCallback(
    (correct: boolean) => {
      setFeedbackColor(correct ? "#00E5CC" : "#FF4060");
      Animated.sequence([
        Animated.timing(feedbackOpacity, {
          toValue: 0.22,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [feedbackOpacity]
  );

  const handleAnswer = useCallback(
    (answerError: boolean) => {
      if (phaseRef.current !== "playing") return;
      const round = rounds[rIdx];
      if (!round) return;

      const correct = answerError === round.isError;
      flashFeedback(correct);

      if (correct) {
        const ns = streak + 1;
        setStreak(ns);
        const multi = ns >= 3 ? 3 : ns >= 2 ? 2 : 1;
        setScore((s) => s + 100 * multi);
        advanceBoat();

        const next = rIdx + 1;
        if (round.allWords && round.allWords.length > 0) {
          annotatingRef.current = true;
          setAnnotating(true);
          if (annotationTimerRef.current) clearTimeout(annotationTimerRef.current);
          annotationTimerRef.current = setTimeout(() => {
            annotatingRef.current = false;
            setAnnotating(false);
            if (next >= rounds.length || boatXVal.current >= BOAT_END) {
              phaseRef.current = "done";
              setPhase("done");
              stopTimer();
            } else {
              setRIdx(next);
              setExplanation(null);
            }
          }, 2000);
        } else {
          if (next >= rounds.length) {
            phaseRef.current = "done";
            setPhase("done");
            stopTimer();
          } else {
            setRIdx(next);
            setExplanation(null);
          }
        }
      } else {
        setStreak(0);
        setExplanation(
          round.isError && round.explanation
            ? round.explanation
            : "This thought is actually healthy — no distorted thinking here."
        );
      }
    },
    [rounds, rIdx, streak, flashFeedback, advanceBoat, stopTimer]
  );

  const dismissExplanation = useCallback(() => {
    setExplanation(null);
    const next = rIdx + 1;
    if (next >= rounds.length) {
      phaseRef.current = "done";
      setPhase("done");
      stopTimer();
    } else {
      setRIdx(next);
    }
  }, [rIdx, rounds, stopTimer]);

  const startGame = useCallback(() => {
    if (annotationTimerRef.current) {
      clearTimeout(annotationTimerRef.current);
      annotationTimerRef.current = null;
    }
    annotatingRef.current = false;
    setAnnotating(false);
    const rs = buildRounds(entries);
    setRounds(rs);
    setRIdx(0);
    setScore(0);
    setStreak(0);
    setExplanation(null);
    boatX.setValue(BOAT_START);
    boatXVal.current = BOAT_START;
    phaseRef.current = "playing";
    setPhase("playing");
    startTimer();
  }, [entries, boatX, startTimer]);

  useEffect(() => {
    if (!visible) {
      stopTimer();
      if (annotationTimerRef.current) {
        clearTimeout(annotationTimerRef.current);
        annotationTimerRef.current = null;
      }
      annotatingRef.current = false;
      setAnnotating(false);
      phaseRef.current = "idle";
      setPhase("idle");
    }
  }, [visible, stopTimer]);

  useEffect(() => {
    return () => {
      if (annotationTimerRef.current) clearTimeout(annotationTimerRef.current);
    };
  }, []);

  const currentRound = rounds[rIdx];
  const multi = streak >= 3 ? 3 : streak >= 2 ? 2 : 1;
  const timerStr =
    timeLeft >= 60
      ? `1:${String(timeLeft - 60).padStart(2, "0")}`
      : `:${String(timeLeft).padStart(2, "0")}`;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.root}>
        {/* ── Illustrated scene ── */}
        <SceneBackground />
        <Sailboat xAnim={boatX} />

        {/* ── Feedback flash ── */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: feedbackColor,
              opacity: feedbackOpacity,
              zIndex: 50,
            },
          ]}
        />

        {/* ── HUD ── */}
        <View style={[styles.hud, { paddingTop: insets.top + 10 }]}>
          {!annotating && <QuitButton onQuit={onClose} isPlaying={phase === "playing"} />}
          <View>
            <View style={styles.scoreRow}>
              <Ionicons
                name="pause"
                size={11}
                color="rgba(255,255,255,0.75)"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.scoreNum}>{score}</Text>
            </View>
            {streak >= 2 && (
              <Text style={styles.streakLabel}>STREAK x{multi}</Text>
            )}
          </View>
          <Text style={styles.timerTxt}>{timerStr}</Text>
        </View>

        {/* ── Progress track ── */}
        {phase === "playing" && (
          <ProgressTrack xAnim={boatX} />
        )}

        {/* ── Playing UI ── */}
        {phase === "playing" && currentRound && (
          <View
            style={[
              styles.bottom,
              { paddingBottom: Math.max(insets.bottom + 12, 20) },
            ]}
          >
            {annotating && currentRound.allWords ? (
              <>
                <AnnotationThoughtLine
                  thought={currentRound.thought}
                  allWords={currentRound.allWords}
                />
                <Text style={styles.annotationLbl}>
                  ALL DISTORTIONS IN THIS THOUGHT
                </Text>
              </>
            ) : explanation ? (
              <Pressable
                style={styles.explainCard}
                onPress={dismissExplanation}
              >
                <Text style={styles.explainTxt}>{explanation}</Text>
                <Text style={styles.tapContinue}>TAP TO CONTINUE</Text>
              </Pressable>
            ) : (
              <>
                <ThoughtLine
                  thought={currentRound.thought}
                  highlight={currentRound.highlight}
                />
                <Text style={styles.questionLbl}>
                  IS THE HIGHLIGHTED WORD DISTORTED THINKING?
                </Text>
                <View style={styles.btnRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btn,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => handleAnswer(true)}
                  >
                    <Text style={styles.btnErrorTxt}>× ERROR</Text>
                  </Pressable>
                  <View style={styles.btnDivider} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.btn,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => handleAnswer(false)}
                  >
                    <Text style={styles.btnValidTxt}>✓ VALID</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Idle overlay ── */}
        {phase === "idle" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayEmoji}>⛵</Text>
              <Text style={styles.overlayTitle}>Mind Voyage</Text>
              <Text style={styles.overlayDesc}>
                Your own thoughts appear with a highlighted word. Identify
                distorted thinking to push the ship across the sea — before
                the clock runs out.
              </Text>
              <Pressable style={[styles.startBtn, { marginTop: 12 }]} onPress={startGame}>
                <Text style={styles.startBtnTxt}>Set Sail</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Done overlay ── */}
        {phase === "done" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.doneLabel}>
                {boatXVal.current >= BOAT_END
                  ? "VOYAGE COMPLETE"
                  : "VOYAGE ENDED"}
              </Text>
              <Text style={styles.doneScore}>{score}</Text>
              <Text style={styles.donePts}>points</Text>
              <View style={styles.doneBtns}>
                <Pressable style={styles.startBtn} onPress={startGame}>
                  <Text style={styles.startBtnTxt}>Sail Again</Text>
                </Pressable>
                <QuitButton onQuit={onClose} isPlaying={false} />
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SKY,
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 22,
    zIndex: 10,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreNum: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  streakLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  timerTxt: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  progressTrack: {
    position: "absolute",
    top: HORIZON_Y - 3,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    zIndex: 8,
  },
  progressFill: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    gap: 14,
  },
  thoughtLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
  },
  wordWrap: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  wordWrapHL: {
    backgroundColor: HIGHLIGHT_BG,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  wordTxt: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  wordTxtHL: {
    color: HIGHLIGHT_TXT,
  },
  questionLbl: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.8,
    textAlign: "center",
  },
  annotationLbl: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.8,
    textAlign: "center",
    marginTop: 4,
  },
  btnRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.93)",
    borderRadius: 14,
    overflow: "hidden",
    height: 64,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  btnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: 14,
  },
  btnErrorTxt: {
    color: "#E03A3A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  btnValidTxt: {
    color: "#1A4A48",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  explainCard: {
    backgroundColor: "rgba(0,50,44,0.78)",
    borderRadius: 14,
    padding: 20,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  explainTxt: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  tapContinue: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,70,64,0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  overlayCard: {
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 10,
  },
  overlayEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  overlayTitle: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  overlayDesc: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  startBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 100,
  },
  startBtnTxt: {
    color: "#1A4A48",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  closeLinkTxt: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  doneLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  doneScore: {
    color: "#fff",
    fontSize: 72,
    fontFamily: "Inter_700Bold",
    letterSpacing: -3,
    lineHeight: 80,
  },
  donePts: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  doneBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  closeRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
});
