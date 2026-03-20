import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HistoryEntry } from "@/context/HistoryContext";
import { Colors } from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");
const NUM_COLS = 5;
const BLOCK_H = 22;
const TOWER_AREA_H = Math.floor(SH * 0.36);
const MAX_ROWS = Math.floor(TOWER_AREA_H / (BLOCK_H + 2));
const SWIPE_THRESHOLD = SW * 0.27;
const GAME_SECONDS = 30;

const BLOCK_PALETTE = [
  "#7B3F3F", "#3F6B7B", "#7B6B3F", "#3F5E3F",
  "#5E3F7B", "#7B503F", "#3F7B6B", "#6B3F5E",
  "#4A7A6A", "#7A5A4A",
];

interface SortWord {
  text: string;
  isNegative: boolean;
}

function buildDeck(entries: HistoryEntry[]): SortWord[] {
  const seen = new Set<string>();
  const words: SortWord[] = [];
  for (const entry of entries) {
    for (const w of entry.words) {
      if (w.category === "neutral") continue;
      const k = w.word.toLowerCase().trim();
      if (!seen.has(k)) { seen.add(k); words.push({ text: w.word, isNegative: true }); }
      for (const r of w.reframes) {
        const rk = r.toLowerCase().trim();
        if (!seen.has(rk)) { seen.add(rk); words.push({ text: r, isNegative: false }); }
      }
    }
  }
  return words.sort(() => Math.random() - 0.5);
}

type Tower = string[][];
const emptyTower = (): Tower => Array.from({ length: NUM_COLS }, () => []);

function addBlock(tower: Tower): Tower {
  const next = tower.map((col) => [...col]);
  if (next.every((c) => c.length >= MAX_ROWS)) return next;
  const minH = Math.min(...next.map((c) => c.length));
  const candidates = next.map((c, i) => c.length <= minH + 1 ? i : -1).filter((i) => i >= 0);
  const col = candidates[Math.floor(Math.random() * candidates.length)];
  next[col].push(BLOCK_PALETTE[Math.floor(Math.random() * BLOCK_PALETTE.length)]);
  return next;
}

function TowerDisplay({ columns }: { columns: Tower }) {
  return (
    <View style={styles.towerArea}>
      {columns.map((col, ci) => (
        <View key={ci} style={styles.towerCol}>
          {col.map((color, bi) => (
            <View key={bi} style={[styles.block, { backgroundColor: color }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SideBurst({ side, trigger }: { side: "left" | "right"; trigger: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    scale.value = 0;
    opacity.value = 0;
    scale.value = withSpring(1.5, { damping: 5, stiffness: 180 });
    opacity.value = withTiming(0.7, { duration: 60 }, () => {
      opacity.value = withTiming(0, { duration: 500 });
    });
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const color = side === "left" ? Colors.belief : Colors.success;
  const positionStyle = side === "left"
    ? { left: 16 }
    : { right: 16 };

  return (
    <Animated.View
      style={[styles.burst, { backgroundColor: color }, positionStyle, style]}
    />
  );
}

interface WordCardProps {
  word: SortWord;
  onSwipe: (swipedNegative: boolean) => void;
}

function WordCard({ word, onSwipe }: WordCardProps) {
  const cardX = useSharedValue(0);
  const cardRotate = useSharedValue(0);

  const swipeTo = useCallback(
    (isNeg: boolean) => onSwipe(isNeg),
    [onSwipe]
  );

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      cardX.value = e.translationX;
      cardRotate.value = interpolate(e.translationX, [-SW / 2, SW / 2], [-10, 10]);
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        cardX.value = withTiming(-SW * 1.6, { duration: 240 });
        cardRotate.value = withTiming(-22, { duration: 240 });
        runOnJS(swipeTo)(true);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        cardX.value = withTiming(SW * 1.6, { duration: 240 });
        cardRotate.value = withTiming(22, { duration: 240 });
        runOnJS(swipeTo)(false);
      } else {
        cardX.value = withSpring(0, { damping: 14 });
        cardRotate.value = withSpring(0, { damping: 14 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardX.value },
      { rotate: `${cardRotate.value}deg` },
    ],
    borderColor: interpolateColor(
      cardX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      ["rgba(255,91,91,0.7)", "rgba(255,255,255,0.07)", "rgba(0,229,160,0.7)"]
    ) as string,
  }));

  const negHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardX.value, [0, -SWIPE_THRESHOLD * 0.6], [0.2, 1]),
    transform: [{ scale: interpolate(cardX.value, [0, -SWIPE_THRESHOLD], [1, 1.18]) }],
  }));

  const posHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardX.value, [0, SWIPE_THRESHOLD * 0.6], [0.2, 1]),
    transform: [{ scale: interpolate(cardX.value, [0, SWIPE_THRESHOLD], [1, 1.18]) }],
  }));

  return (
    <View style={styles.cardRow}>
      <Animated.View style={[styles.sideLabel, negHintStyle]}>
        <Ionicons name="arrow-back" size={18} color={Colors.belief} />
        <Text style={[styles.sideLabelText, { color: Colors.belief }]}>NEGATIVE</Text>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.wordText}>{word.text}</Text>
        </Animated.View>
      </GestureDetector>

      <Animated.View style={[styles.sideLabel, styles.sideLabelRight, posHintStyle]}>
        <Text style={[styles.sideLabelText, { color: Colors.success }]}>POSITIVE</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.success} />
      </Animated.View>
    </View>
  );
}

interface SortTowerGameProps {
  visible: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
}

export function SortTowerGame({ visible, entries, onClose }: SortTowerGameProps) {
  const insets = useSafeAreaInsets();

  const [deck, setDeck] = useState<SortWord[]>([]);
  const [deckIdx, setDeckIdx] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [score, setScore] = useState(0);
  const [tower, setTower] = useState<Tower>(emptyTower);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [leftBurst, setLeftBurst] = useState(0);
  const [rightBurst, setRightBurst] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const feedbackOpacity = useSharedValue(0);
  const [feedbackMsg, setFeedbackMsg] = useState<"correct" | "wrong">("correct");
  const swipeHintOpacity = useSharedValue(1);

  const startGame = useCallback(() => {
    const d = buildDeck(entries);
    setDeck(d);
    setDeckIdx(0);
    setCardKey((k) => k + 1);
    setScore(0);
    setTower(emptyTower());
    setTimeLeft(GAME_SECONDS);
    setPhase("playing");
    swipeHintOpacity.value = 1;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [entries]);

  useEffect(() => {
    if (visible) startGame();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible]);

  const showFeedback = useCallback((type: "correct" | "wrong") => {
    setFeedbackMsg(type);
    feedbackOpacity.value = withTiming(1, { duration: 100 }, () => {
      feedbackOpacity.value = withDelay(340, withTiming(0, { duration: 200 }));
    });
  }, []);

  const handleSwipe = useCallback(
    (swipedNegative: boolean) => {
      swipeHintOpacity.value = withTiming(0, { duration: 180 });
      const current = deck[deckIdx];
      if (!current) return;

      const correct = swipedNegative === current.isNegative;
      Haptics.impactAsync(correct
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy
      );

      if (correct) {
        if (swipedNegative) setLeftBurst((n) => n + 1);
        else setRightBurst((n) => n + 1);
        setScore((s) => s + 100);
        setTower((t) => addBlock(t));
      }
      showFeedback(correct ? "correct" : "wrong");

      setTimeout(() => {
        setDeckIdx((i) => {
          const next = i + 1;
          if (next >= deck.length) {
            setPhase("done");
            if (timerRef.current) clearInterval(timerRef.current!);
          }
          return next;
        });
        setCardKey((k) => k + 1);
      }, 300);
    },
    [deck, deckIdx, showFeedback]
  );

  const timerPct = timeLeft / GAME_SECONDS;
  const timerColor = timerPct > 0.5 ? Colors.success : timerPct > 0.25 ? Colors.absolute : Colors.belief;
  const currentWord = deck[deckIdx] ?? null;

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
  }));

  const swipeHintStyle = useAnimatedStyle(() => ({
    opacity: swipeHintOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* HUD */}
        <View style={styles.hud}>
          <View style={styles.scoreBox}>
            <Ionicons name="grid-outline" size={13} color="rgba(255,255,255,0.3)" />
            <Text style={styles.scoreText}>{score}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={16}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.3)" />
          </Pressable>
          <Text style={styles.timerText}>:{String(timeLeft).padStart(2, "0")}</Text>
        </View>

        {/* Timer bar */}
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerColor }]} />
        </View>

        {/* Dashed goal line */}
        <View style={styles.goalLine} />

        {/* Mid area */}
        <View style={styles.midArea}>
          {phase === "playing" && currentWord ? (
            <>
              <WordCard key={cardKey} word={currentWord} onSwipe={handleSwipe} />
              <Animated.View style={[styles.swipeHintRow, swipeHintStyle]}>
                <Ionicons name="arrow-back" size={13} color="rgba(255,255,255,0.2)" />
                <Text style={styles.swipeHintText}>swipe</Text>
                <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.2)" />
              </Animated.View>
            </>
          ) : phase === "done" ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneLabel}>Done!</Text>
              <Text style={styles.doneScore}>{score}</Text>
              <Text style={styles.donePts}>points</Text>
              <Pressable style={styles.playAgainBtn} onPress={startGame}>
                <Text style={styles.playAgainText}>Play Again</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeTextBtn}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Feedback pill */}
        <Animated.View style={[styles.feedbackPill, feedbackStyle]}>
          <Text style={{
            fontSize: 13,
            fontFamily: "Inter_600SemiBold",
            color: feedbackMsg.current === "correct" ? Colors.success : Colors.belief,
          }}>
            {feedbackMsg.current === "correct" ? "✓ Correct" : "✗ Wrong"}
          </Text>
        </Animated.View>

        {/* Side burst effects */}
        <SideBurst side="left" trigger={leftBurst} />
        <SideBurst side="right" trigger={rightBurst} />

        {/* Tower */}
        <TowerDisplay columns={tower} />

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  timerText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  timerTrack: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 20,
    borderRadius: 1,
    overflow: "hidden",
  },
  timerFill: {
    height: 2,
    borderRadius: 1,
  },
  goalLine: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.14)",
    borderStyle: "dashed",
    marginHorizontal: 20,
  },
  midArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "#1C1C24",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    minHeight: 100,
    marginHorizontal: 4,
  },
  wordText: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  sideLabel: {
    alignItems: "center",
    gap: 5,
    width: 68,
  },
  sideLabelRight: {
    alignItems: "center",
  },
  sideLabelText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
  },
  swipeHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 26,
  },
  swipeHintText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  feedbackPill: {
    position: "absolute",
    alignSelf: "center",
    top: SH * 0.46,
    backgroundColor: "#16161E",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    zIndex: 50,
  },
  burst: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    top: SH * 0.48,
    zIndex: 30,
    opacity: 0,
  },
  towerArea: {
    height: TOWER_AREA_H,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 3,
  },
  towerCol: {
    flex: 1,
    justifyContent: "flex-end",
    gap: 2,
  },
  block: {
    width: "100%",
    height: BLOCK_H,
    borderRadius: 3,
  },
  doneBox: {
    alignItems: "center",
    gap: 8,
  },
  doneLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  doneScore: {
    color: Colors.success,
    fontSize: 72,
    fontFamily: "Inter_700Bold",
    lineHeight: 80,
  },
  donePts: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
  },
  playAgainBtn: {
    marginTop: 24,
    backgroundColor: Colors.reframeBtn,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 100,
  },
  playAgainText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  closeTextBtn: {
    marginTop: 10,
    padding: 8,
  },
  closeText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
