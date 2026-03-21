import React, {
  useCallback,
  useEffect,
  useMemo,
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

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Colours ─────────────────────────────────────────────────────────────────

const C = {
  bg: "#001A14",
  glow: "#007A62",
  wrongBg: "#1A0010",
  wrongGlow: "#8B0030",
  accent: "#00E5CC",
  distortHighlight: "#FF4D7A",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.45)",
  btnBorder: "rgba(255,255,255,0.28)",
};

// ─── Category explanations ────────────────────────────────────────────────────

const CAT: Record<string, string> = {
  overgeneralization: "uses absolute thinking that isn't always true",
  catastrophizing: "exaggerates how bad things might get",
  black_white: "sees things as all-or-nothing, ignoring nuance",
  mind_reading: "assumes what others think without evidence",
  labeling: "defines a whole person by a single event",
  emotional_reasoning: "treats feelings as facts",
  magnification: "blows the issue out of proportion",
  personalization: "takes excessive blame or responsibility",
  should_statements: "creates rigid rules that generate guilt",
  fortune_telling: "predicts a negative future as certain",
  minimization: "shrinks positive aspects unfairly",
  filtering: "focuses only on the negatives",
};

// ─── Built-in rounds ─────────────────────────────────────────────────────────

type Round = {
  thought: string;
  isDistorted: boolean;
  highlight: string[];
  explanation: string;
};

const HEALTHY_THOUGHTS: Round[] = [
  {
    thought: "I made a mistake and I can learn from it.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
  {
    thought: "This is difficult, but I can handle it step by step.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
  {
    thought: "Not everything went as planned, but that's manageable.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
  {
    thought: "I did my best given the situation.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
  {
    thought: "Some things are outside my control and that's okay.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
  {
    thought: "I struggled with this, but struggle is part of growth.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
  {
    thought: "I had a hard day, but tomorrow can be different.",
    isDistorted: false,
    highlight: [],
    explanation: "",
  },
];

const DISTORTED_FALLBACK: Round[] = [
  {
    thought: "I always fail at everything I try.",
    isDistorted: true,
    highlight: ["always", "everything"],
    explanation:
      ""Always" and "everything" are overgeneralizations — one setback doesn't define every outcome.",
  },
  {
    thought: "Nobody ever cares about what I think.",
    isDistorted: true,
    highlight: ["Nobody", "ever"],
    explanation:
      ""Nobody" and "ever" are absolute words that rarely reflect reality.",
  },
  {
    thought: "This is the worst thing that could have happened to me.",
    isDistorted: true,
    highlight: ["worst"],
    explanation:
      ""Worst" catastrophizes — difficult events rarely represent the absolute worst possibility.",
  },
  {
    thought: "I'm completely worthless and useless.",
    isDistorted: true,
    highlight: ["completely", "worthless", "useless"],
    explanation:
      "These labels define your whole self by a moment of struggle, which isn't accurate.",
  },
  {
    thought: "Everyone must think I'm stupid after that.",
    isDistorted: true,
    highlight: ["Everyone", "stupid"],
    explanation:
      ""Everyone" overgeneralizes and "stupid" is a label — we can't know what others think.",
  },
  {
    thought: "It's all my fault. I ruin everything.",
    isDistorted: true,
    highlight: ["all my fault", "everything"],
    explanation:
      "Taking total blame ignores other factors. "Everything" is an overgeneralization.",
  },
  {
    thought: "I'll never get any better at this.",
    isDistorted: true,
    highlight: ["never"],
    explanation:
      ""Never" is fortune-telling — skills and situations change with time and effort.",
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
  const distorted: Round[] = [];

  for (const e of entries) {
    const dWords = e.words
      .filter((w) => w.category !== "neutral")
      .map((w) => w.text);
    if (dWords.length === 0) continue;

    const categories = e.words
      .filter((w) => w.category !== "neutral")
      .map((w) => w.category);
    const uniqueCats = [...new Set(categories)];

    const catDesc = uniqueCats
      .slice(0, 2)
      .map((c) => CAT[c] ?? "represents distorted thinking")
      .join("; and ");

    const wordList = dWords.slice(0, 3).map((w) => `"${w}"`).join(", ");

    distorted.push({
      thought: e.thought,
      isDistorted: true,
      highlight: dWords,
      explanation: `${wordList} ${uniqueCats.length > 1 ? "are" : "is"} a sign of distorted thinking — ${catDesc}.`,
    });
  }

  const allDistorted = shuffle([
    ...distorted.slice(0, 6),
    ...DISTORTED_FALLBACK.slice(0, Math.max(0, 4 - distorted.length)),
  ]);
  const allHealthy = shuffle(HEALTHY_THOUGHTS).slice(0, 4);

  return shuffle([...allDistorted, ...allHealthy]).slice(0, 10);
}

// ─── Background ───────────────────────────────────────────────────────────────

function Background({ wrong }: { wrong: boolean }) {
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: wrong ? 1 : 0,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [wrong, bgAnim]);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.bg, C.wrongBg],
  });
  const glowColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.glow, C.wrongGlow],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          position: "absolute",
          top: -SH * 0.25,
          left: SW * 0.5 - SH * 0.55,
          width: SH * 1.1,
          height: SH * 1.1,
          borderRadius: SH * 0.55,
          backgroundColor: glowColor,
          opacity: 0.28,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -SH * 0.25,
          right: -SW * 0.3,
          width: SH * 0.7,
          height: SH * 0.7,
          borderRadius: SH * 0.35,
          backgroundColor: "#000",
          opacity: 0.45,
        }}
      />
    </Animated.View>
  );
}

// ─── Animated word text ───────────────────────────────────────────────────────

function DroppingText({
  text,
  triggerKey,
}: {
  text: string;
  triggerKey: number;
}) {
  const words = useMemo(() => text.split(" "), [text]);

  const anims = useRef<Array<{ y: Animated.Value; op: Animated.Value }>>([]);

  // Re-initialise whenever word count changes
  if (anims.current.length !== words.length) {
    anims.current = words.map(() => ({
      y: new Animated.Value(-28),
      op: new Animated.Value(0),
    }));
  }

  useEffect(() => {
    anims.current.forEach((a) => {
      a.y.setValue(-28);
      a.op.setValue(0);
    });
    const animations = anims.current.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.y, {
          toValue: 0,
          duration: 260,
          delay: i * 38,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(a.op, {
          toValue: 1,
          duration: 200,
          delay: i * 38,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, [triggerKey]);

  return (
    <View style={styles.droppingWrap}>
      {words.map((word, i) => (
        <Animated.View
          key={`${triggerKey}-${i}`}
          style={{
            transform: [{ translateY: anims.current[i]?.y ?? 0 }],
            opacity: anims.current[i]?.op ?? 0,
          }}
        >
          <Text style={styles.droppingWord}>{word} </Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Highlighted thought (for explanation) ────────────────────────────────────

function HighlightedThought({
  text,
  highlight,
}: {
  text: string;
  highlight: string[];
}) {
  const words = text.split(" ");
  return (
    <Text style={styles.explainThought}>
      {words.map((word, i) => {
        const isHL = highlight.some((h) =>
          word.toLowerCase().replace(/[^a-z]/g, "").includes(h.toLowerCase().replace(/[^a-z]/g, ""))
        );
        return (
          <Text
            key={i}
            style={isHL ? styles.explainHighlight : styles.explainWord}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </Text>
        );
      })}
    </Text>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < current
              ? styles.dotDone
              : i === current
              ? styles.dotActive
              : styles.dotFuture,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main game ────────────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "explain" | "done";

export function ThoughtCheckGame({
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
  const [lives, setLives] = useState(4);
  const [showWrong, setShowWrong] = useState(false);
  const [triggerKey, setTriggerKey] = useState(0);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  const currentRound = rounds[rIdx];

  // ── Start ──
  const startGame = useCallback(() => {
    const rs = buildRounds(entries);
    setRounds(rs);
    setRIdx(0);
    setScore(0);
    setLives(4);
    setShowWrong(false);
    setPhase("playing");
    setTriggerKey((k) => k + 1);
  }, [entries]);

  // ── Answer ──
  const handleAnswer = useCallback(
    (answerDistorted: boolean) => {
      if (phase !== "playing" || !currentRound) return;

      const isCorrect = answerDistorted === currentRound.isDistorted;

      // Flash feedback
      Animated.sequence([
        Animated.timing(feedbackOpacity, {
          toValue: 0.2,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();

      if (isCorrect) {
        setScore((s) => s + 200);
        const next = rIdx + 1;
        if (next >= rounds.length) {
          setPhase("done");
        } else {
          setRIdx(next);
          setTriggerKey((k) => k + 1);
        }
      } else {
        const newLives = lives - 1;
        setLives(newLives);

        if (currentRound.isDistorted) {
          // Show explanation only for distorted thoughts user missed
          setPhase("explain");
          setShowWrong(true);
        } else {
          // User said "distorted" but it was healthy — brief pause then continue
          if (newLives <= 0) {
            setPhase("done");
            return;
          }
          const next = rIdx + 1;
          if (next >= rounds.length) {
            setPhase("done");
          } else {
            setRIdx(next);
            setTriggerKey((k) => k + 1);
          }
        }
      }
    },
    [phase, currentRound, rIdx, rounds, lives, feedbackOpacity]
  );

  // ── Continue after explanation ──
  const handleContinue = useCallback(() => {
    setShowWrong(false);
    if (lives <= 0) {
      setPhase("done");
      return;
    }
    const next = rIdx + 1;
    if (next >= rounds.length) {
      setPhase("done");
    } else {
      setRIdx(next);
      setPhase("playing");
      setTriggerKey((k) => k + 1);
    }
  }, [lives, rIdx, rounds]);

  // ── Reset on hide ──
  useEffect(() => {
    if (!visible) {
      setPhase("idle");
      setShowWrong(false);
    }
  }, [visible]);

  const feedbackColor = showWrong ? "#FF4D7A" : "#00E5CC";

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.root}>
        <Background wrong={showWrong} />

        {/* Feedback flash */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: feedbackColor, opacity: feedbackOpacity, zIndex: 50 },
          ]}
        />

        {/* ── HUD ── */}
        <View style={[styles.hud, { paddingTop: insets.top + 10 }]}>
          <View style={styles.scoreRow}>
            <Ionicons
              name="pause"
              size={12}
              color="rgba(255,255,255,0.5)"
              style={{ marginRight: 2 }}
            />
            <Text style={styles.scoreNum}>{score}</Text>
          </View>
          <View style={styles.heartsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < lives ? "heart" : "heart-outline"}
                size={14}
                color={i < lives ? "#fff" : "rgba(255,255,255,0.2)"}
              />
            ))}
          </View>
        </View>

        {/* ── PLAYING phase ── */}
        {phase === "playing" && currentRound && (
          <>
            <View
              style={[
                styles.thoughtArea,
                { paddingTop: insets.top + 54, paddingBottom: SH * 0.32 },
              ]}
            >
              <DroppingText
                text={currentRound.thought}
                triggerKey={triggerKey}
              />
            </View>

            <View
              style={[
                styles.bottomArea,
                { paddingBottom: Math.max(insets.bottom + 14, 24) },
              ]}
            >
              <ProgressDots total={rounds.length} current={rIdx} />
              <Text style={styles.questionLabel}>
                IS THIS THOUGHT DISTORTED?
              </Text>
              <View style={styles.btnRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => handleAnswer(true)}
                >
                  <Ionicons
                    name="close"
                    size={14}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.btnTxt}>DISTORTED</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => handleAnswer(false)}
                >
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.btnTxt}>HEALTHY</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ── EXPLAIN phase ── */}
        {phase === "explain" && currentRound && (
          <Pressable
            style={[
              styles.explainArea,
              { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom + 24, 32) },
            ]}
            onPress={handleContinue}
          >
            <HighlightedThought
              text={currentRound.thought}
              highlight={currentRound.highlight}
            />
            {currentRound.explanation ? (
              <Text style={styles.explainBody}>{currentRound.explanation}</Text>
            ) : null}
            <Text style={styles.tapToContinue}>TAP TO CONTINUE</Text>
          </Pressable>
        )}

        {/* ── IDLE overlay ── */}
        {phase === "idle" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={44}
                color={C.accent}
                style={{ marginBottom: 14 }}
              />
              <Text style={styles.overlayTitle}>Thought Check</Text>
              <Text style={styles.overlayDesc}>
                Your own thoughts will appear word by word. Decide if they
                contain distorted thinking or healthy thinking — and learn
                where you went wrong.
              </Text>
              <Pressable style={styles.startBtn} onPress={startGame}>
                <Text style={styles.startBtnTxt}>Begin</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── DONE overlay ── */}
        {phase === "done" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.doneLabel}>SESSION COMPLETE</Text>
              <Text style={styles.doneScore}>{score}</Text>
              <Text style={styles.donePts}>points</Text>
              <View style={styles.doneBtns}>
                <Pressable style={styles.startBtn} onPress={startGame}>
                  <Text style={styles.startBtnTxt}>Play Again</Text>
                </Pressable>
                <Pressable style={styles.closeRound} onPress={onClose}>
                  <Ionicons
                    name="close"
                    size={17}
                    color="rgba(255,255,255,0.45)"
                  />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Close button (always visible except explain/overlays) */}
        {phase === "playing" && (
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[styles.closeBtn, { top: insets.top + 10 }]}
          >
            <Ionicons name="close" size={17} color="rgba(255,255,255,0.35)" />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    zIndex: 10,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  scoreNum: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  heartsRow: {
    flexDirection: "row",
    gap: 5,
  },
  thoughtArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  droppingWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  droppingWord: {
    color: "#fff",
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    gap: 12,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: C.accent,
  },
  dotActive: {
    backgroundColor: C.accent,
    transform: [{ scale: 1.25 }],
  },
  dotFuture: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  questionLabel: {
    color: C.accent,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textAlign: "center",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: C.btnBorder,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  btnPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  btnTxt: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  explainArea: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 22,
  },
  explainThought: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  explainWord: {
    color: "#fff",
  },
  explainHighlight: {
    color: C.distortHighlight,
  },
  explainBody: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  tapToContinue: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,26,20,0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  overlayCard: {
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 10,
  },
  overlayTitle: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  overlayDesc: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  startBtn: {
    marginTop: 16,
    backgroundColor: C.accent,
    paddingHorizontal: 38,
    paddingVertical: 15,
    borderRadius: 100,
  },
  startBtnTxt: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  doneLabel: {
    color: C.textDim,
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
    color: C.textDim,
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
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
});
