/**
 * SortTowerGame — swipe-to-classify word sorting game.
 *
 * Players swipe a card LEFT (negative/distorted) or RIGHT (positive/reframe)
 * to classify words drawn from their history. Each correct classification adds
 * a colourful floor to a growing pixel-art tower. The game lasts 30 seconds.
 *
 * ## CBT rationale
 *
 * Sorting practises categorical recognition — the ability to quickly label a
 * word as either a cognitive distortion or a healthy alternative. This is the
 * same skill trained in CBT "thought records", where the therapist asks the
 * client to categorise automatic thoughts. The speed constraint prevents
 * overthinking and trains rapid pattern recognition.
 *
 * ## Deck building — `buildDeck`
 *
 * Both distorted words and their AI-provided reframes are extracted from
 * `HistoryEntry.words`. The deck is deduplicated (case-insensitive) to prevent
 * the same word appearing twice. Distorted words have `isNegative: true`;
 * reframes have `isNegative: false`. The deck is shuffled so categories don't
 * cluster together.
 *
 * ## Swipe gesture
 *
 * `WordCard` uses `react-native-gesture-handler`'s `Gesture.Pan()` on the
 * Reanimated worklet thread for 60 fps tracking:
 *  - While dragging: card rotates ±8° and a left/right label fades in
 *  - On release past `SWIPE_THRESHOLD` (27% of screen width): card flies off-screen
 *    and `onSwipe` is called via `runOnJS`
 *  - On release below threshold: card springs back to center
 *
 * ## Tower building
 *
 * `makeFloor` creates a new `Floor` object each time the user swipes correctly.
 * Each floor has a colour (cycling through `FLOOR_PALETTE`) and an arch window
 * count that increases as the tower grows. The tower tapers: each floor is
 * `TAPER_PX` narrower than the one below it, capped at `FLOOR_MIN_W`.
 * When the tower reaches 8 floors, an animated spire appears.
 *
 * ## Score and combo multiplier
 *
 * Base score per correct swipe: 100 pts.
 * Consecutive correct swipes (combo) increase the multiplier:
 *   ≥ 3 correct → 2×, ≥ 5 → 3×, ≥ 8 → 4×
 * A ComboFlash indicator pops in when the multiplier first activates.
 *
 * ## Timer pulse
 *
 * When 10 seconds remain, the timer text starts pulsing (scale 1 → 1.06)
 * via `withRepeat` to create urgency. This is a common game design pattern
 * for time pressure.
 */

import React, {
  useCallback,
  useEffect,
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
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HistoryEntry } from "@/context/HistoryContext";
import { QuitButton } from "@/components/QuitButton";

const { width: SW, height: SH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SW * 0.27;
const GAME_SECONDS = 30;

const BG = "#000";
const TEXT_DARK = "#fff";
const TEXT_MID = "rgba(255,255,255,0.38)";
const NEG_COLOR = "#FF5B5B";
const POS_COLOR = "#00E5A0";
const CARD_BG = "#1A1A1A";
const FOUNDATION_COLOR = "#DCDCDC";

const FLOOR_PALETTE = [
  "#FF6B6B",
  "#FF9F43",
  "#FECA57",
  "#48DBFB",
  "#FF9FF3",
  "#54A0FF",
  "#5F27CD",
  "#00D2D3",
  "#1DD1A1",
  "#C8D6E5",
];

const FLOOR_H = 28;
const FLOOR_BASE_W = Math.round(SW * 0.64);
const FLOOR_MIN_W = Math.round(FLOOR_BASE_W * 0.52);
const TAPER_PX = 4;
const MAX_VISIBLE_FLOORS = Math.floor((SH * 0.38) / (FLOOR_H + 2));

interface SortWord {
  text: string;
  isNegative: boolean;
}

interface Floor {
  id: number;
  color: string;
  windows: number;
}

function buildDeck(entries: HistoryEntry[]): SortWord[] {
  const seen = new Set<string>();
  const words: SortWord[] = [];
  for (const entry of entries) {
    for (const w of entry.words) {
      if (w.category === "neutral") continue;
      const k = w.word.toLowerCase().trim();
      if (!seen.has(k)) {
        seen.add(k);
        words.push({ text: w.word, isNegative: true });
      }
      for (const r of w.reframes) {
        const rk = r.toLowerCase().trim();
        if (!seen.has(rk)) {
          seen.add(rk);
          words.push({ text: r, isNegative: false });
        }
      }
    }
  }
  return words.sort(() => Math.random() - 0.5);
}

let floorIdCounter = 0;

function makeFloor(totalSoFar: number): Floor {
  floorIdCounter += 1;
  return {
    id: floorIdCounter,
    color: FLOOR_PALETTE[totalSoFar % FLOOR_PALETTE.length],
    windows: Math.min(2 + Math.floor(totalSoFar / 4), 5),
  };
}

function TowerFloor({
  floor,
  index,
  totalFloors,
}: {
  floor: Floor;
  index: number;
  totalFloors: number;
}) {
  const dropY = useSharedValue(-FLOOR_H - 10);
  const opacity = useSharedValue(0);

  useEffect(() => {
    dropY.value = withSpring(0, { damping: 13, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 80 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: dropY.value }],
    opacity: opacity.value,
  }));

  const isTop = index === totalFloors - 1;
  const floorWidth = Math.max(FLOOR_BASE_W - index * TAPER_PX, FLOOR_MIN_W);
  const borderR = isTop ? 4 : 2;

  return (
    <Animated.View style={[{ alignItems: "center" }, style]}>
      <View
        style={[
          styles.floor,
          {
            width: floorWidth,
            backgroundColor: floor.color,
            borderTopLeftRadius: borderR,
            borderTopRightRadius: borderR,
          },
        ]}
      >
        <View style={styles.windowRow}>
          {Array.from({ length: floor.windows }).map((_, i) => (
            <View key={i} style={styles.arch} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function Spire({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 400 });
      translateY.value = withSpring(0, { damping: 14, stiffness: 180 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.spireWrap, style]}>
      <View style={styles.spireCap} />
      <View style={styles.spireBody} />
    </Animated.View>
  );
}

const TARGET_BOTTOM = 8 + MAX_VISIBLE_FLOORS * (FLOOR_H + 2);

function TowerDisplay({ floors }: { floors: Floor[] }) {
  const visibleFloors = floors.slice(-MAX_VISIBLE_FLOORS);
  const hasSpire = floors.length >= 8;
  const floorWidth0 = Math.max(FLOOR_BASE_W - 0 * TAPER_PX, FLOOR_MIN_W);

  return (
    <View style={styles.towerArea}>
      {/* Target line */}
      <View style={[styles.targetLineWrap, { bottom: TARGET_BOTTOM }]}>
        <View style={styles.targetLine} />
        <Text style={styles.targetLabel}>GOAL</Text>
      </View>

      {floors.length === 0 && (
        <Text style={styles.emptyTowerHint}>Swipe correctly to build your tower</Text>
      )}

      <View style={styles.towerColumn}>
        <Spire visible={hasSpire} />
        {visibleFloors.map((floor, i) => (
          <TowerFloor
            key={floor.id}
            floor={floor}
            index={i}
            totalFloors={visibleFloors.length}
          />
        ))}
        {floors.length > 0 && (
          <View style={[styles.foundation, { width: floorWidth0 + 16 }]} />
        )}
      </View>
    </View>
  );
}

function ScorePop({ score }: { score: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.22, { duration: 100, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 9, stiffness: 240 })
    );
  }, [score]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.Text style={[styles.scoreText, style]}>{score}</Animated.Text>
  );
}

function ComboFlash({ combo }: { combo: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const prevCombo = useRef(0);

  useEffect(() => {
    if (combo >= 3 && combo !== prevCombo.current) {
      prevCombo.current = combo;
      scale.value = 0.6;
      opacity.value = 1;
      scale.value = withSpring(1, { damping: 9, stiffness: 260 });
      opacity.value = withDelay(700, withTiming(0, { duration: 250 }));
    }
  }, [combo]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (combo < 3) return null;
  const multiplier = combo >= 8 ? 4 : combo >= 5 ? 3 : 2;

  return (
    <Animated.View style={[styles.comboFlash, style]}>
      <Text style={styles.comboText}>{multiplier}× COMBO</Text>
    </Animated.View>
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
      cardRotate.value = interpolate(
        e.translationX,
        [-SW / 2, SW / 2],
        [-8, 8]
      );
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        cardX.value = withTiming(-SW * 1.5, { duration: 220 });
        cardRotate.value = withTiming(-18, { duration: 220 });
        runOnJS(swipeTo)(true);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        cardX.value = withTiming(SW * 1.5, { duration: 220 });
        cardRotate.value = withTiming(18, { duration: 220 });
        runOnJS(swipeTo)(false);
      } else {
        cardX.value = withSpring(0, { damping: 15 });
        cardRotate.value = withSpring(0, { damping: 15 });
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
      [NEG_COLOR + "BB", "rgba(0,0,0,0.06)", POS_COLOR + "BB"]
    ) as string,
  }));

  const negHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardX.value, [0, -SWIPE_THRESHOLD * 0.7], [0, 1]),
    transform: [
      {
        scale: interpolate(
          cardX.value,
          [0, -SWIPE_THRESHOLD],
          [0.9, 1.1]
        ),
      },
    ],
  }));

  const posHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardX.value, [0, SWIPE_THRESHOLD * 0.7], [0, 1]),
    transform: [
      {
        scale: interpolate(
          cardX.value,
          [0, SWIPE_THRESHOLD],
          [0.9, 1.1]
        ),
      },
    ],
  }));

  return (
    <View style={styles.cardRow}>
      <View style={styles.sideAffordanceLeft} pointerEvents="none">
        <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.22)" />
        <Text style={styles.affordanceLabel}>negative</Text>
      </View>

      <View style={styles.sideAffordanceRight} pointerEvents="none">
        <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.22)" />
        <Text style={styles.affordanceLabel}>positive</Text>
      </View>

      <Animated.View style={[styles.sideLabel, negHintStyle]}>
        <Ionicons name="arrow-back" size={16} color={NEG_COLOR} />
        <Text style={[styles.sideLabelText, { color: NEG_COLOR }]}>
          NEGATIVE
        </Text>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.wordText}>{word.text}</Text>
        </Animated.View>
      </GestureDetector>

      <Animated.View style={[styles.sideLabel, styles.sideLabelRight, posHintStyle]}>
        <Text style={[styles.sideLabelText, { color: POS_COLOR }]}>
          POSITIVE
        </Text>
        <Ionicons name="arrow-forward" size={16} color={POS_COLOR} />
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
  const [floors, setFloors] = useState<Floor[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [phase, setPhase] = useState<"playing" | "done" | "empty">("playing");
  const [streak, setStreak] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const feedbackOpacity = useSharedValue(0);
  const [feedbackCorrect, setFeedbackCorrect] = useState(true);
  const swipeHintOpacity = useSharedValue(1);
  const timerPulse = useSharedValue(1);

  const startGame = useCallback(() => {
    const d = buildDeck(entries);
    setDeck(d);
    setDeckIdx(0);
    setCardKey((k) => k + 1);
    setScore(0);
    setFloors([]);
    setTimeLeft(GAME_SECONDS);
    setStreak(0);
    swipeHintOpacity.value = 1;
    timerPulse.value = 1;
    if (timerRef.current) clearInterval(timerRef.current);
    if (d.length === 0) {
      setPhase("empty");
      return;
    }
    setPhase("playing");
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setPhase("done");
          return 0;
        }
        if (t === 10) {
          timerPulse.value = withRepeat(
            withSequence(
              withTiming(1.06, { duration: 400 }),
              withTiming(1, { duration: 400 })
            ),
            -1,
            true
          );
        }
        return t - 1;
      });
    }, 1000);
  }, [entries]);

  useEffect(() => {
    if (visible) startGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  const showFeedback = useCallback((correct: boolean) => {
    setFeedbackCorrect(correct);
    feedbackOpacity.value = withTiming(1, { duration: 80 }, () => {
      feedbackOpacity.value = withDelay(380, withTiming(0, { duration: 180 }));
    });
  }, []);

  const handleSwipe = useCallback(
    (swipedNegative: boolean) => {
      swipeHintOpacity.value = withTiming(0, { duration: 180 });
      const current = deck[deckIdx];
      if (!current) return;

      const correct = swipedNegative === current.isNegative;
      Haptics.impactAsync(
        correct
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy
      );

      if (correct) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        const multiplier =
          newStreak >= 8 ? 4 : newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1;
        setScore((s) => s + 100 * multiplier);
        setFloors((prev) => [...prev, makeFloor(prev.length)]);
      } else {
        setStreak(0);
      }
      showFeedback(correct);

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
      }, 280);
    },
    [deck, deckIdx, showFeedback, streak]
  );

  const timerPct = timeLeft / GAME_SECONDS;
  const timerColor =
    timeLeft <= 10 ? NEG_COLOR : timeLeft <= 20 ? "#C9935A" : "#2A8C7F";
  const currentWord = deck[deckIdx] ?? null;

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
  }));

  const swipeHintStyle = useAnimatedStyle(() => ({
    opacity: swipeHintOpacity.value,
  }));

  const timerPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* HUD */}
        <View style={styles.hud}>
          <QuitButton onQuit={onClose} isPlaying={phase === "playing"} />

          <ScorePop score={score} />

          <Animated.Text style={[styles.timerText, timerPulseStyle, { color: timerColor }]}>
            {String(timeLeft).padStart(2, "0")}
          </Animated.Text>
        </View>

        {/* Timer bar */}
        <View style={styles.timerTrack}>
          <View
            style={[
              styles.timerFill,
              {
                width: `${timerPct * 100}%` as any,
                backgroundColor: timerColor,
              },
            ]}
          />
        </View>

        {/* Tower */}
        <TowerDisplay floors={floors} />

        {/* Divider line */}
        <View style={styles.divider} />

        {/* Card area */}
        <View style={styles.midArea}>
          {phase === "empty" ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Not Enough Reflections</Text>
              <Text style={styles.emptyBody}>
                Complete a few more reflections first, then come back to play.
              </Text>
              <Pressable style={styles.emptyCloseBtn} onPress={onClose}>
                <Text style={styles.emptyCloseBtnText}>Got it</Text>
              </Pressable>
            </View>
          ) : phase === "playing" && currentWord ? (
            <>
              <ComboFlash combo={streak} />
              <WordCard key={cardKey} word={currentWord} onSwipe={handleSwipe} />
              <Animated.View style={[styles.swipeHintRow, swipeHintStyle]}>
                <Ionicons name="arrow-back" size={12} color={TEXT_MID} />
                <Text style={styles.swipeHintText}>swipe to sort</Text>
                <Ionicons name="arrow-forward" size={12} color={TEXT_MID} />
              </Animated.View>
            </>
          ) : phase === "done" ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneLabel}>TOWER BUILT</Text>
              <Text style={styles.doneScore}>{score}</Text>
              <View style={styles.doneFloorRow}>
                <Text style={styles.doneFloorNum}>{floors.length}</Text>
                <Text style={styles.doneFloorUnit}>
                  floor{floors.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={styles.doneBtnRow}>
                <Pressable style={styles.playAgainBtn} onPress={startGame}>
                  <Text style={styles.playAgainText}>Play Again</Text>
                </Pressable>
                <QuitButton onQuit={onClose} isPlaying={false} />
              </View>
            </View>
          ) : null}
        </View>

        {/* Feedback pill */}
        <Animated.View
          style={[
            styles.feedbackPill,
            { backgroundColor: feedbackCorrect ? "rgba(42,140,127,0.12)" : "rgba(194,77,58,0.12)" },
            feedbackStyle,
          ]}
        >
          <Ionicons
            name={feedbackCorrect ? "checkmark" : "close"}
            size={13}
            color={feedbackCorrect ? POS_COLOR : NEG_COLOR}
          />
        </Animated.View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(26,16,5,0.06)",
  },
  scoreText: {
    color: TEXT_DARK,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  timerText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    minWidth: 36,
    textAlign: "right",
  },
  timerTrack: {
    height: 2,
    backgroundColor: "rgba(26,16,5,0.08)",
    marginHorizontal: 20,
    borderRadius: 1,
    overflow: "hidden",
  },
  timerFill: {
    height: 2,
    borderRadius: 1,
  },
  towerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 0,
  },
  towerColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  spireWrap: {
    alignItems: "center",
    marginBottom: 1,
  },
  spireCap: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#E0E0E0",
  },
  spireBody: {
    width: 10,
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 1,
  },
  floor: {
    height: FLOOR_H,
    justifyContent: "flex-end",
    paddingBottom: 3,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  windowRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
  },
  arch: {
    width: 7,
    height: 11,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderTopLeftRadius: 3.5,
    borderTopRightRadius: 3.5,
  },
  foundation: {
    height: 8,
    backgroundColor: FOUNDATION_COLOR,
    borderRadius: 1,
  },
  targetLineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  targetLine: {
    flex: 1,
    height: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
    borderStyle: "dashed",
  },
  targetLabel: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    marginLeft: 6,
    marginRight: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(26,16,5,0.10)",
    marginHorizontal: 20,
    marginTop: 8,
  },
  midArea: {
    height: SH * 0.36,
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
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    minHeight: 96,
    marginHorizontal: 8,
  },
  wordText: {
    color: TEXT_DARK,
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sideLabel: {
    alignItems: "center",
    gap: 4,
    width: 64,
  },
  sideLabelRight: {
    alignItems: "center",
  },
  sideLabelText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  sideAffordanceLeft: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  sideAffordanceRight: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  affordanceLabel: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    textTransform: "lowercase",
  },
  swipeHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  swipeHintText: {
    color: TEXT_MID,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  feedbackPill: {
    position: "absolute",
    alignSelf: "center",
    top: SH * 0.56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  comboFlash: {
    position: "absolute",
    top: -32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 100,
    zIndex: 60,
  },
  comboText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  doneBox: {
    alignItems: "center",
    gap: 4,
  },
  doneLabel: {
    color: TEXT_MID,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
    marginBottom: 2,
  },
  doneScore: {
    color: TEXT_DARK,
    fontSize: 72,
    fontFamily: "Inter_700Bold",
    lineHeight: 78,
    letterSpacing: -3,
  },
  doneFloorRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginBottom: 4,
  },
  doneFloorNum: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  doneFloorUnit: {
    color: TEXT_MID,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  doneBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  playAgainBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 100,
  },
  playAgainText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  closeIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTowerHint: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.18)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  emptyBox: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  emptyBody: {
    color: TEXT_MID,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCloseBtn: {
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 100,
  },
  emptyCloseBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
});
