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

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  bg: "#160A1C",
  glowA: "rgba(185, 40, 90, 0.45)",
  glowB: "rgba(120, 20, 60, 0.25)",
  line: "rgba(200, 70, 120, 0.55)",
  lineActive: "rgba(255, 130, 175, 0.9)",
  lineWrong: "rgba(255, 80, 100, 0.5)",
  node: "#5A1A40",
  nodeBorder: "rgba(220, 80, 140, 0.7)",
  nodeActive: "#E04090",
  nodeGlow: "rgba(230, 60, 140, 0.55)",
  nodeCorrect: "rgba(74, 222, 128, 0.85)",
  nodeWrong: "rgba(255, 60, 80, 0.85)",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.38)",
  timer: "#FF6B8A",
  correct: "#4ADE80",
};

// ─── Tree geometry ────────────────────────────────────────────────────────────

const DOT_X = SW / 2;
const DOT_Y = SH * 0.40;
const BAR_Y = DOT_Y + 22;
const NODE_Y = SH * 0.595;
const NODE_R = 16;
const NODE_XS = [SW * 0.16, SW * 0.5, SW * 0.84];
const LINE_W = 1.5;
const GAME_SEC = 90;

// ─── Data ─────────────────────────────────────────────────────────────────────

type Round = {
  distorted: string;
  correct: string;
  wrong: [string, string];
  explanation: string;
};

const ROUNDS: Round[] = [
  {
    distorted: "always",
    correct: "sometimes",
    wrong: ["never", "constantly"],
    explanation: '"Always" is absolute thinking. "Sometimes" is usually more accurate.',
  },
  {
    distorted: "never",
    correct: "rarely",
    wrong: ["seldom", "always"],
    explanation: '"Never" predicts the worst. "Rarely" reflects reality better.',
  },
  {
    distorted: "worthless",
    correct: "struggling",
    wrong: ["hopeless", "useless"],
    explanation: '"Struggling" is honest and temporary. "Worthless" is a label, not a fact.',
  },
  {
    distorted: "horrible",
    correct: "difficult",
    wrong: ["terrible", "awful"],
    explanation: '"Difficult" describes the situation without catastrophizing it.',
  },
  {
    distorted: "ruined",
    correct: "challenged",
    wrong: ["destroyed", "lost"],
    explanation: '"Challenged" leaves room for recovery. "Ruined" closes the door.',
  },
  {
    distorted: "stupid",
    correct: "learning",
    wrong: ["foolish", "naive"],
    explanation: '"Learning" replaces a fixed label with an open growth mindset.',
  },
  {
    distorted: "hate",
    correct: "dislike",
    wrong: ["despise", "loathe"],
    explanation: '"Dislike" is accurate without amplifying the emotional intensity.',
  },
  {
    distorted: "must",
    correct: "could",
    wrong: ["should", "have to"],
    explanation: '"Could" gives you choice. "Must" creates unnecessary pressure.',
  },
  {
    distorted: "terrible",
    correct: "unpleasant",
    wrong: ["dreadful", "awful"],
    explanation: '"Unpleasant" is specific. "Terrible" exaggerates the situation.',
  },
  {
    distorted: "useless",
    correct: "unhelpful",
    wrong: ["pointless", "broken"],
    explanation: '"Unhelpful" describes the action — not your worth as a person.',
  },
  {
    distorted: "failure",
    correct: "setback",
    wrong: ["defeat", "mistake"],
    explanation: '"Setback" implies that recovery is still possible.',
  },
  {
    distorted: "broken",
    correct: "healing",
    wrong: ["damaged", "empty"],
    explanation: '"Healing" acknowledges that change and growth are in progress.',
  },
  {
    distorted: "impossible",
    correct: "difficult",
    wrong: ["pointless", "hopeless"],
    explanation: '"Difficult" keeps effort meaningful. "Impossible" stops you trying.',
  },
  {
    distorted: "catastrophe",
    correct: "setback",
    wrong: ["disaster", "failure"],
    explanation: 'Labelling events as catastrophes amplifies distress unnecessarily.',
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type ActiveRound = {
  distorted: string;
  options: string[]; // length 3, shuffled, includes correct
  correctIdx: number;
  explanation: string;
};

function buildRounds(entries: HistoryEntry[]): ActiveRound[] {
  // Pull from user's own distorted entries first
  const historyRounds: Round[] = [];
  for (const e of entries) {
    const dw = e.words.filter((w) => w.category !== "neutral");
    if (!dw.length) continue;
    const word = dw[0].text.toLowerCase();
    const base = ROUNDS.find(
      (r) => r.distorted.toLowerCase() === word.toLowerCase()
    );
    if (base) historyRounds.push(base);
  }

  const pool = shuffle([...historyRounds, ...shuffle(ROUNDS)]).slice(
    0,
    10
  );

  return pool.map((r) => {
    const options = shuffle([r.correct, ...r.wrong]);
    return {
      distorted: r.distorted,
      options,
      correctIdx: options.indexOf(r.correct),
      explanation: r.explanation,
    };
  });
}

// ─── Letter-by-letter word reveal ────────────────────────────────────────────

function AnimatedWord({ word }: { word: string }) {
  const [revealed, setRevealed] = useState(word.length);
  const prev = useRef(word);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (prev.current === word) return;
    prev.current = word;

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRevealed(0);

    word.split("").forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setRevealed(i + 1), (i + 1) * 52)
      );
    });

    return () => timers.current.forEach(clearTimeout);
  }, [word]);

  return (
    <View style={styles.wordRow}>
      {word.split("").map((ch, i) => (
        <Text key={`${word}-${i}`} style={[styles.wordChar, { opacity: i < revealed ? 1 : 0 }]}>
          {ch}
        </Text>
      ))}
    </View>
  );
}

// ─── Background ───────────────────────────────────────────────────────────────

function SceneBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Deep outer glow ring */}
      <View
        style={{
          position: "absolute",
          top: SH * 0.14,
          left: SW * 0.5 - SH * 0.38,
          width: SH * 0.76,
          height: SH * 0.76,
          borderRadius: SH * 0.38,
          backgroundColor: C.glowB,
        }}
      />
      {/* Inner brighter glow */}
      <View
        style={{
          position: "absolute",
          top: SH * 0.24,
          left: SW * 0.5 - SH * 0.24,
          width: SH * 0.48,
          height: SH * 0.48,
          borderRadius: SH * 0.24,
          backgroundColor: C.glowA,
        }}
      />
      {/* Hot center */}
      <View
        style={{
          position: "absolute",
          top: SH * 0.33,
          left: SW * 0.5 - SH * 0.09,
          width: SH * 0.18,
          height: SH * 0.18,
          borderRadius: SH * 0.09,
          backgroundColor: "rgba(220, 60, 110, 0.35)",
        }}
      />
    </View>
  );
}

// ─── Tree diagram ─────────────────────────────────────────────────────────────

type NodeState = "idle" | "selected-correct" | "selected-wrong" | "unselected";

function TreeDiagram({
  options,
  nodeStates,
  onNodePress,
  selectedIdx,
}: {
  options: string[];
  nodeStates: NodeState[];
  onNodePress: (i: number) => void;
  selectedIdx: number | null;
}) {
  const nodeScales = useRef(NODE_XS.map(() => new Animated.Value(1))).current;
  const nodeGlows = useRef(NODE_XS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    nodeStates.forEach((state, i) => {
      const targetGlow = state === "selected-correct" ? 1 : state === "selected-wrong" ? 0.7 : 0;
      const targetScale = state === "selected-correct" ? 1.25 : state === "selected-wrong" ? 0.9 : 1;

      Animated.parallel([
        Animated.spring(nodeScales[i], {
          toValue: targetScale,
          tension: 180,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(nodeGlows[i], {
          toValue: targetGlow,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [nodeStates]);

  const getLineColor = (i: number): string => {
    if (selectedIdx === null) return C.line;
    if (i === selectedIdx) {
      const st = nodeStates[i];
      return st === "selected-correct" ? C.nodeCorrect : C.lineWrong;
    }
    return "rgba(200,70,120,0.2)";
  };

  const topVertLen = BAR_Y - DOT_Y - 8;
  const sideVertLen = NODE_Y - BAR_Y - NODE_R;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Central dot */}
      <View
        style={{
          position: "absolute",
          left: DOT_X - 5,
          top: DOT_Y - 5,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: "#fff",
        }}
      />

      {/* Top vertical (dot → bar) */}
      <View
        style={{
          position: "absolute",
          left: DOT_X - LINE_W / 2,
          top: DOT_Y + 5,
          width: LINE_W,
          height: topVertLen,
          backgroundColor: selectedIdx === null ? C.line : "rgba(200,70,120,0.25)",
        }}
      />

      {/* Horizontal bar */}
      <View
        style={{
          position: "absolute",
          left: NODE_XS[0],
          top: BAR_Y,
          width: NODE_XS[2] - NODE_XS[0],
          height: LINE_W,
          backgroundColor: selectedIdx === null ? C.line : "rgba(200,70,120,0.25)",
        }}
      />

      {/* Vertical legs to each node */}
      {NODE_XS.map((x, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: x - LINE_W / 2,
            top: BAR_Y + LINE_W,
            width: LINE_W,
            height: sideVertLen,
            backgroundColor: getLineColor(i),
          }}
        />
      ))}

      {/* Node circles + labels */}
      {NODE_XS.map((x, i) => {
        const state = nodeStates[i];
        const isDimmed = selectedIdx !== null && i !== selectedIdx;
        const isCorrect = state === "selected-correct";
        const isWrong = state === "selected-wrong";

        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x - 50,
              top: NODE_Y - NODE_R - 10,
              width: 100,
              alignItems: "center",
            }}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => onNodePress(i)}
              disabled={selectedIdx !== null}
              style={{ alignItems: "center" }}
            >
              {/* Glow ring */}
              <Animated.View
                style={{
                  position: "absolute",
                  top: -NODE_R * 0.7,
                  left: 50 - NODE_R * 1.7,
                  width: NODE_R * 3.4,
                  height: NODE_R * 3.4,
                  borderRadius: NODE_R * 1.7,
                  backgroundColor: isCorrect ? C.nodeCorrect : C.nodeGlow,
                  opacity: nodeGlows[i],
                }}
              />

              {/* Node circle */}
              <Animated.View
                style={[
                  styles.node,
                  {
                    transform: [{ scale: nodeScales[i] }],
                    opacity: isDimmed ? 0.3 : 1,
                    backgroundColor: isCorrect
                      ? C.nodeCorrect
                      : isWrong
                      ? C.nodeWrong
                      : C.node,
                    borderColor: isCorrect
                      ? C.correct
                      : isWrong
                      ? C.nodeWrong
                      : C.nodeBorder,
                  },
                ]}
              >
                {isWrong && (
                  <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>×</Text>
                )}
              </Animated.View>

              {/* Label */}
              <Text
                style={[
                  styles.nodeLabel,
                  {
                    opacity: isDimmed ? 0.3 : 1,
                    color: isCorrect ? C.correct : "#fff",
                    fontFamily: isCorrect || isWrong ? "Inter_700Bold" : "Inter_400Regular",
                  },
                ]}
              >
                {options[i]}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "done";

export function RewordGame({
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
  const [rounds, setRounds] = useState<ActiveRound[]>([]);
  const [rIdx, setRIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SEC);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [nodeStates, setNodeStates] = useState<NodeState[]>(["idle", "idle", "idle"]);
  const [explanation, setExplanation] = useState<string>("");

  const phaseRef = useRef<Phase>("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(GAME_SEC);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timeRef.current = GAME_SEC;
    setTimeLeft(GAME_SEC);
    timerRef.current = setInterval(() => {
      timeRef.current -= 1;
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) {
        stopTimer();
        if (phaseRef.current === "playing") {
          phaseRef.current = "done";
          setPhase("done");
        }
      }
    }, 1000);
  }, [stopTimer]);

  const resetNodes = useCallback(() => {
    setSelectedIdx(null);
    setNodeStates(["idle", "idle", "idle"]);
    setExplanation("");
  }, []);

  const nextRound = useCallback(
    (idx: number) => {
      const next = idx + 1;
      if (next >= rounds.length) {
        phaseRef.current = "done";
        setPhase("done");
        stopTimer();
      } else {
        setRIdx(next);
        resetNodes();
      }
    },
    [rounds, stopTimer, resetNodes]
  );

  const handleNodePress = useCallback(
    (i: number) => {
      if (phaseRef.current !== "playing" || selectedIdx !== null) return;
      const round = rounds[rIdx];
      if (!round) return;

      setSelectedIdx(i);
      const correct = i === round.correctIdx;

      const states: NodeState[] = round.options.map((_, idx) => {
        if (idx === i) return correct ? "selected-correct" : "selected-wrong";
        return "unselected";
      });
      setNodeStates(states);

      if (correct) {
        const ns = streak + 1;
        setStreak(ns);
        const multi = ns >= 3 ? 3 : ns >= 2 ? 2 : 1;
        setScore((s) => s + 200 * multi);
        setTimeout(() => nextRound(rIdx), 900);
      } else {
        setStreak(0);
        setExplanation(round.explanation);
      }
    },
    [rounds, rIdx, streak, selectedIdx, nextRound]
  );

  const handleExplanationTap = useCallback(() => {
    if (selectedIdx !== null && nodeStates[selectedIdx] === "selected-wrong") {
      nextRound(rIdx);
    }
  }, [selectedIdx, nodeStates, rIdx, nextRound]);

  const startGame = useCallback(() => {
    const rs = buildRounds(entries);
    setRounds(rs);
    setRIdx(0);
    setScore(0);
    setStreak(0);
    resetNodes();
    phaseRef.current = "playing";
    setPhase("playing");
    startTimer();
  }, [entries, resetNodes, startTimer]);

  useEffect(() => {
    if (!visible) {
      stopTimer();
      phaseRef.current = "idle";
      setPhase("idle");
      resetNodes();
    }
  }, [visible, stopTimer, resetNodes]);

  const currentRound = rounds[rIdx];
  const multi = streak >= 3 ? 3 : streak >= 2 ? 2 : 1;
  const timerStr =
    timeLeft >= 60
      ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
      : `0:${String(timeLeft).padStart(2, "0")}`;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.root}>
        <SceneBg />

        {/* HUD */}
        <View style={[styles.hud, { paddingTop: insets.top + 10 }]}>
          <View style={styles.scoreRow}>
            <Ionicons name="pause" size={11} color="rgba(255,255,255,0.55)" />
            <Text style={styles.scoreTxt}>{score}</Text>
          </View>
          <Text style={styles.timerTxt}>{timerStr}</Text>
        </View>

        {/* Streak */}
        {streak >= 2 && phase === "playing" && (
          <Text style={[styles.streakLbl, { top: insets.top + 36 }]}>
            STREAK ×{multi}
          </Text>
        )}

        {/* Playing field */}
        {phase === "playing" && currentRound && (
          <>
            {/* Distorted word */}
            <View style={styles.wordArea}>
              <Text style={styles.wordHint}>REPLACE THE DISTORTED WORD</Text>
              <AnimatedWord word={currentRound.distorted} />
            </View>

            {/* Tree + nodes */}
            <TreeDiagram
              options={currentRound.options}
              nodeStates={nodeStates}
              onNodePress={handleNodePress}
              selectedIdx={selectedIdx}
            />

            {/* Instruction / explanation */}
            <View style={styles.bottomArea}>
              {explanation ? (
                <Pressable onPress={handleExplanationTap} style={styles.explanationWrap}>
                  <Text style={styles.explanationTxt}>{explanation}</Text>
                  <Text style={styles.tapContinue}>TAP TO CONTINUE</Text>
                </Pressable>
              ) : (
                <Text style={styles.instructTxt}>TAP THE HEALTHY ALTERNATIVE</Text>
              )}
            </View>
          </>
        )}

        {/* Idle overlay */}
        {phase === "idle" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayEmoji}>🔄</Text>
              <Text style={styles.overlayTitle}>Reword</Text>
              <Text style={styles.overlayDesc}>
                Each distorted word has a healthier alternative. Tap the one that
                reframes the thought — before time runs out.
              </Text>
              <Pressable style={[styles.actionBtn, { marginTop: 16 }]} onPress={startGame}>
                <Text style={styles.actionBtnTxt}>Play</Text>
              </Pressable>
              <Pressable onPress={onClose} style={{ padding: 10 }}>
                <Text style={styles.closeLinkTxt}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Done overlay */}
        {phase === "done" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.doneLabel}>SESSION COMPLETE</Text>
              <Text style={styles.doneScore}>{score}</Text>
              <Text style={styles.donePts}>points</Text>
              <View style={styles.doneBtns}>
                <Pressable style={styles.actionBtn} onPress={startGame}>
                  <Text style={styles.actionBtnTxt}>Play Again</Text>
                </Pressable>
                <Pressable style={styles.closeRound} onPress={onClose}>
                  <Ionicons name="close" size={17} color="rgba(255,255,255,0.55)" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
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
    gap: 5,
  },
  scoreTxt: {
    color: C.timer,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  streakLbl: {
    position: "absolute",
    left: 22,
    color: C.timer,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    opacity: 0.8,
  },
  timerTxt: {
    color: C.timer,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  wordArea: {
    position: "absolute",
    top: DOT_Y - 100,
    left: 20,
    right: 20,
    alignItems: "center",
    gap: 8,
  },
  wordHint: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  wordRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  wordChar: {
    color: C.text,
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    lineHeight: 54,
  },
  node: {
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: NODE_R,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLabel: {
    marginTop: 8,
    fontSize: 16,
    letterSpacing: -0.2,
    color: C.text,
  },
  bottomArea: {
    position: "absolute",
    bottom: SH * 0.09,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  instructTxt: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  explanationWrap: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  explanationTxt: {
    color: C.timer,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  tapContinue: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22, 10, 28, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  overlayCard: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  overlayEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  overlayTitle: {
    color: C.text,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  overlayDesc: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  actionBtn: {
    backgroundColor: C.nodeActive,
    paddingHorizontal: 44,
    paddingVertical: 15,
    borderRadius: 100,
  },
  actionBtnTxt: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  closeLinkTxt: {
    color: "rgba(255,255,255,0.32)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  doneLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  doneScore: {
    color: C.text,
    fontSize: 76,
    fontFamily: "Inter_700Bold",
    letterSpacing: -3,
    lineHeight: 84,
  },
  donePts: {
    color: "rgba(255,255,255,0.45)",
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
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});
