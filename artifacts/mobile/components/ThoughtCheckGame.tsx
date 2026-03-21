/**
 * ThoughtCheckGame — "is this thought distorted?" binary awareness game.
 *
 * Players are shown thoughts one at a time and must decide whether each one
 * contains distorted thinking (DISTORTED button) or not (HEALTHY button).
 * Missed answers reveal an explanation of the distortion so the user learns.
 *
 * ## CBT rationale
 *
 * This game trains the recognition phase of Cognitive Behavioural Therapy —
 * a critical first step before any reframing can occur. A patient who cannot
 * notice cognitive distortions in the wild cannot apply reframes. By replaying
 * their own historical thoughts alongside curated examples, users practise
 * spotting the same patterns they produce themselves.
 *
 * ## Round generation — `buildRounds`
 *
 * Each game session creates a 10-round deck mixing:
 *  - Up to 6 distorted rounds from the user's own history (words whose
 *    category is not neutral are extracted and their category is used to
 *    generate a contextual explanation)
 *  - Fallback distorted rounds (from `DISTORTED_FALLBACK`) if the user has
 *    fewer than 6 history entries with significant words
 *  - 4 healthy rounds drawn from `HEALTHY_THOUGHTS` (the user must not mark
 *    these as distorted — a false-positive is still a wrong answer)
 *
 * The deck is shuffled so patterns aren't memorised by position.
 *
 * ## Phase state machine
 *
 *   idle → playing → explain → playing (loop)
 *                  → bonus → playing (loop)
 *                  → false_positive → playing (loop)
 *                  ↘ done (all rounds exhausted or lives = 0)
 *
 * - `"explain"` is entered when the user wrongly marks a distorted thought
 *   as healthy — they see the highlighted distorted words and an explanation.
 * - `"bonus"` is entered after correctly identifying a distorted thought —
 *   the user taps individual distorted words for +50 bonus points each.
 *   Auto-advances after 4 seconds or when all words are found.
 * - `"false_positive"` is entered when the user incorrectly marks a healthy
 *   thought as distorted — a teach screen explains why it's actually healthy.
 *
 * ## DroppingText animation
 *
 * Each new round re-animates the thought words dropping in from above,
 * staggered by 38 ms per word. This is triggered by incrementing `triggerKey`,
 * which is passed to `DroppingText` and used as a `useEffect` dependency to
 * restart the animation fresh — without unmounting and remounting the component.
 *
 * ## Feedback flash
 *
 * A 60 ms teal/red full-screen flash provides immediate right/wrong feedback
 * before the explanation appears. The colour also changes the Background glow
 * from green to crimson on a wrong answer, sustaining the negative-feedback
 * signal while the explanation is shown.
 *
 * ## Lives
 *
 * Players start with 4 lives (hearts). Each wrong answer costs one. At zero
 * the game ends. This prevents grinding through distorted thoughts by guessing.
 */

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
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import type { HistoryEntry } from "@/context/HistoryContext";
import { QuitButton } from "@/components/QuitButton";

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

// ─── Healthy-thought explanations (for false-positive teach screen) ──────────

const HEALTHY_EXPLANATIONS: Record<string, string> = {
  "I made a mistake and I can learn from it.":
    "Acknowledging mistakes while focusing on growth is balanced, realistic thinking.",
  "This is difficult, but I can handle it step by step.":
    "Recognizing difficulty without catastrophizing shows healthy coping.",
  "Not everything went as planned, but that's manageable.":
    "Accepting imperfect outcomes without all-or-nothing thinking is balanced.",
  "I did my best given the situation.":
    "Giving yourself fair credit rather than harsh self-judgment is healthy.",
  "Some things are outside my control and that's okay.":
    "Accepting limits of control prevents unnecessary self-blame.",
  "I struggled with this, but struggle is part of growth.":
    "Seeing struggle as normal rather than a personal failure is realistic.",
  "I had a hard day, but tomorrow can be different.":
    "Keeping perspective without fortune-telling shows balanced thinking.",
};

const HEALTHY_FALLBACK_EXPLANATION =
  "This thought acknowledges reality without exaggerating, blaming, or predicting the worst. That's balanced, healthy thinking.";

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
      `"Always" and "everything" are overgeneralizations — one setback doesn't define every outcome.`,
  },
  {
    thought: "Nobody ever cares about what I think.",
    isDistorted: true,
    highlight: ["Nobody", "ever"],
    explanation:
      `"Nobody" and "ever" are absolute words that rarely reflect reality.`,
  },
  {
    thought: "This is the worst thing that could have happened to me.",
    isDistorted: true,
    highlight: ["worst"],
    explanation:
      `"Worst" catastrophizes — difficult events rarely represent the absolute worst possibility.`,
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
      `"Everyone" overgeneralizes and "stupid" is a label — we can't know what others think.`,
  },
  {
    thought: "It's all my fault. I ruin everything.",
    isDistorted: true,
    highlight: ["all my fault", "everything"],
    explanation:
      `Taking total blame ignores other factors. "Everything" is an overgeneralization.`,
  },
  {
    thought: "I'll never get any better at this.",
    isDistorted: true,
    highlight: ["never"],
    explanation:
      `"Never" is fortune-telling — skills and situations change with time and effort.`,
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
      .map((w) => w.word);
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
  const wrongAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(wrongAnim, {
      toValue: wrong ? 1 : 0,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [wrong, wrongAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Normal dark-green radial gradient */}
      <Svg width={SW} height={SH} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="normal-gradient" cx="50%" cy="45%" r="65%" fx="50%" fy="45%">
            <Stop offset="0%" stopColor={C.glow} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={C.bg} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SW} height={SH} fill={C.bg} />
        <Rect x="0" y="0" width={SW} height={SH} fill="url(#normal-gradient)" />
      </Svg>
      {/* Wrong-answer red radial gradient, fades in/out */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: wrongAnim }]}>
        <Svg width={SW} height={SH} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="wrong-gradient" cx="50%" cy="45%" r="65%" fx="50%" fy="45%">
              <Stop offset="0%" stopColor={C.wrongGlow} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={C.wrongBg} stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={SW} height={SH} fill={C.wrongBg} />
          <Rect x="0" y="0" width={SW} height={SH} fill="url(#wrong-gradient)" />
        </Svg>
      </Animated.View>
    </View>
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
    <View
      style={styles.dotsRow}
      accessible
      accessibilityLabel={`Round ${current} of ${total}`}
      accessibilityRole="progressbar"
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          importantForAccessibility="no"
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

// ─── Bonus word chip ──────────────────────────────────────────────────────────

function WordChip({
  word,
  isHighlighted,
  onPress,
  highlightWords,
}: {
  word: string;
  isHighlighted: boolean;
  onPress: (word: string) => void;
  highlightWords: string[];
}) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const isDistortedWord = highlightWords.some((h) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    const multiWord = h.toLowerCase().replace(/[^a-z ]/g, "");
    return clean.includes(multiWord.replace(/ /g, "")) ||
      multiWord.split(" ").some((part) => clean === part.replace(/[^a-z]/g, ""));
  });

  const handlePress = useCallback(() => {
    if (isHighlighted) return;
    if (!isDistortedWord) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
    onPress(word);
  }, [word, isHighlighted, isDistortedWord, onPress, shakeAnim]);

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          chipStyles.chip,
          isHighlighted && chipStyles.chipFound,
        ]}
        accessibilityLabel={isHighlighted ? `${word}, found` : word}
        accessibilityRole="button"
        accessibilityHint={isHighlighted ? undefined : "Tap if this is a distorted word"}
      >
        <Text
          style={[
            chipStyles.chipText,
            isHighlighted && chipStyles.chipTextFound,
          ]}
        >
          {word}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
    margin: 3,
  },
  chipFound: {
    borderColor: C.distortHighlight,
    backgroundColor: "rgba(255,77,122,0.2)",
  },
  chipText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  chipTextFound: {
    color: C.distortHighlight,
  },
});

// ─── Main game ────────────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "explain" | "bonus" | "false_positive" | "done";

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

  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [missedItems, setMissedItems] = useState<string[]>([]);
  const [truePos, setTruePos] = useState(0);
  const [trueNeg, setTrueNeg] = useState(0);
  const [falsePos, setFalsePos] = useState(0);
  const [falseNeg, setFalseNeg] = useState(0);

  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const missedItemsRef = useRef<string[]>([]);
  const truePosRef = useRef(0);
  const trueNegRef = useRef(0);
  const falsePosRef = useRef(0);
  const falseNegRef = useRef(0);

  const [bonusRemaining, setBonusRemaining] = useState<Set<string>>(new Set());
  const [bonusFound, setBonusFound] = useState<Set<string>>(new Set());
  const bonusTimerAnim = useRef(new Animated.Value(1)).current;
  const bonusTimerRef = useRef<Animated.CompositeAnimation | null>(null);

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
    streakRef.current = 0;
    bestStreakRef.current = 0;
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    missedItemsRef.current = [];
    truePosRef.current = 0;
    trueNegRef.current = 0;
    falsePosRef.current = 0;
    falseNegRef.current = 0;
    setCorrectCount(0);
    setWrongCount(0);
    setBestStreak(0);
    setMissedItems([]);
    setTruePos(0);
    setTrueNeg(0);
    setFalsePos(0);
    setFalseNeg(0);
  }, [entries]);

  const captureDoneStats = useCallback(() => {
    setCorrectCount(correctCountRef.current);
    setWrongCount(wrongCountRef.current);
    setBestStreak(bestStreakRef.current);
    setMissedItems([...missedItemsRef.current]);
    setTruePos(truePosRef.current);
    setTrueNeg(trueNegRef.current);
    setFalsePos(falsePosRef.current);
    setFalseNeg(falseNegRef.current);
  }, []);

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
        correctCountRef.current += 1;
        const ns = streakRef.current + 1;
        streakRef.current = ns;
        if (ns > bestStreakRef.current) bestStreakRef.current = ns;
        if (answerDistorted && currentRound.isDistorted) truePosRef.current += 1;
        else if (!answerDistorted && !currentRound.isDistorted) trueNegRef.current += 1;
        setScore((s) => s + 200);
        if (currentRound.isDistorted && currentRound.highlight.length > 0) {
          const remaining = new Set(currentRound.highlight.map((w) => w.toLowerCase()));
          setBonusRemaining(remaining);
          setBonusFound(new Set());
          setPhase("bonus");
        } else {
          const next = rIdx + 1;
          if (next >= rounds.length) {
            captureDoneStats();
            setPhase("done");
          } else {
            setRIdx(next);
            setTriggerKey((k) => k + 1);
          }
        }
      } else {
        wrongCountRef.current += 1;
        streakRef.current = 0;
        if (answerDistorted && !currentRound.isDistorted) falsePosRef.current += 1;
        else if (!answerDistorted && currentRound.isDistorted) falseNegRef.current += 1;
        if (missedItemsRef.current.length < 3) {
          missedItemsRef.current = [...missedItemsRef.current, currentRound.thought];
        }
        const newLives = lives - 1;
        setLives(newLives);

        if (currentRound.isDistorted) {
          setPhase("explain");
          setShowWrong(true);
        } else {
          setShowWrong(true);
          setPhase("false_positive");
        }
      }
    },
    [phase, currentRound, rIdx, rounds, lives, feedbackOpacity, captureDoneStats]
  );

  const advanceToNext = useCallback(() => {
    setShowWrong(false);
    const next = rIdx + 1;
    if (next >= rounds.length) {
      captureDoneStats();
      setPhase("done");
    } else {
      setRIdx(next);
      setPhase("playing");
      setTriggerKey((k) => k + 1);
    }
  }, [rIdx, rounds, captureDoneStats]);

  // ── Continue after explanation or false_positive ──
  const handleContinue = useCallback(() => {
    setShowWrong(false);
    if (lives <= 0) {
      captureDoneStats();
      setPhase("done");
      return;
    }
    advanceToNext();
  }, [lives, advanceToNext, captureDoneStats]);

  // ── Bonus phase timer ──
  useEffect(() => {
    if (phase === "bonus") {
      bonusTimerAnim.setValue(1);
      const anim = Animated.timing(bonusTimerAnim, {
        toValue: 0,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      bonusTimerRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) {
          advanceToNext();
        }
      });
      return () => {
        anim.stop();
        bonusTimerRef.current = null;
      };
    }
  }, [phase, advanceToNext, bonusTimerAnim]);

  // ── Bonus word tap ──
  const handleBonusWordTap = useCallback(
    (word: string) => {
      if (phase !== "bonus" || !currentRound) return;

      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");

      setBonusRemaining((prevRemaining) => {
        const matchedKey = Array.from(prevRemaining).find((h) => {
          const multiWord = h.toLowerCase().replace(/[^a-z ]/g, "");
          return cleanWord.includes(multiWord.replace(/ /g, "")) ||
            multiWord.split(" ").some((part) => cleanWord === part.replace(/[^a-z]/g, ""));
        });

        if (!matchedKey) return prevRemaining;

        setScore((s) => s + 50);
        setBonusFound((prev) => new Set(prev).add(matchedKey));
        const newRemaining = new Set(prevRemaining);
        newRemaining.delete(matchedKey);

        if (newRemaining.size === 0) {
          if (bonusTimerRef.current) bonusTimerRef.current.stop();
          setTimeout(() => advanceToNext(), 300);
        }

        return newRemaining;
      });
    },
    [phase, currentRound, advanceToNext]
  );

  // ── Reset on hide ──
  useEffect(() => {
    if (!visible) {
      setPhase("idle");
      setShowWrong(false);
      if (bonusTimerRef.current) bonusTimerRef.current.stop();
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
          <QuitButton onQuit={onClose} isPlaying={phase === "playing" || phase === "bonus"} />
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
                  accessibilityLabel="Distorted"
                  accessibilityRole="button"
                  accessibilityHint="Mark this thought as containing distorted thinking"
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
                  accessibilityLabel="Healthy"
                  accessibilityRole="button"
                  accessibilityHint="Mark this thought as healthy, balanced thinking"
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
            accessibilityLabel="Explanation. Tap to continue to the next round"
            accessibilityRole="button"
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

        {/* ── BONUS phase ── */}
        {phase === "bonus" && currentRound && (
          <View
            style={[
              styles.bonusArea,
              { paddingTop: insets.top + 54, paddingBottom: Math.max(insets.bottom + 24, 32) },
            ]}
          >
            <Animated.View
              style={[
                styles.timerBar,
                {
                  width: bonusTimerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
            <Text style={styles.bonusLabel}>TAP THE DISTORTED WORDS</Text>
            <Text style={styles.bonusSubLabel}>+50 per word</Text>
            <View style={styles.chipWrap}>
              {currentRound.thought.split(" ").map((word, i) => {
                const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
                const isFound = Array.from(bonusFound).some((h) => {
                  const multiWord = h.toLowerCase().replace(/[^a-z ]/g, "");
                  return cleanWord.includes(multiWord.replace(/ /g, "")) ||
                    multiWord.split(" ").some((part) => cleanWord === part.replace(/[^a-z]/g, ""));
                });
                return (
                  <WordChip
                    key={`${rIdx}-${i}`}
                    word={word}
                    isHighlighted={isFound}
                    onPress={handleBonusWordTap}
                    highlightWords={currentRound.highlight}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── FALSE POSITIVE phase ── */}
        {phase === "false_positive" && currentRound && (
          <Pressable
            style={[
              styles.explainArea,
              { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom + 24, 32) },
            ]}
            onPress={handleContinue}
            accessibilityLabel="This thought is actually healthy. Tap to continue to the next round"
            accessibilityRole="button"
          >
            <Text style={styles.fpLabel}>THIS THOUGHT IS ACTUALLY HEALTHY</Text>
            <Text style={styles.explainThought}>{currentRound.thought}</Text>
            <Text style={styles.explainBody}>
              {HEALTHY_EXPLANATIONS[currentRound.thought] ?? HEALTHY_FALLBACK_EXPLANATION}
            </Text>
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
              <Pressable
                style={[styles.startBtn, { marginTop: 16 }]}
                onPress={startGame}
                accessibilityLabel="Begin game"
                accessibilityRole="button"
              >
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
              <View style={styles.doneSummary}>
                <Text style={styles.doneStat}>
                  {correctCount}/{correctCount + wrongCount} correct ({correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0}%)
                </Text>
                <Text style={styles.doneStat}>Best streak: {bestStreak}</Text>
                <Text style={styles.doneStat}>
                  Caught: {truePos} distorted, {trueNeg} healthy
                </Text>
                {(falsePos > 0 || falseNeg > 0) && (
                  <Text style={styles.doneStat}>
                    Missed: {falseNeg} distortions, {falsePos} false alarms
                  </Text>
                )}
                <Text style={[styles.doneStat, styles.doneInsight]}>
                  {falseNeg > falsePos
                    ? "You tend to miss distortions"
                    : falsePos > falseNeg
                    ? "You over-identify distortions"
                    : "Good balance"}
                </Text>
              </View>
              {missedItems.length > 0 && (
                <View style={styles.doneMissed}>
                  <Text style={styles.doneMissedLabel}>WORDS TO REVIEW</Text>
                  {missedItems.map((thought, i) => (
                    <Text key={i} style={styles.doneMissedItem} numberOfLines={2}>
                      "{thought}"
                    </Text>
                  ))}
                </View>
              )}
              <View style={styles.doneBtns}>
                <Pressable
                  style={styles.startBtn}
                  onPress={startGame}
                  accessibilityLabel="Play again"
                  accessibilityRole="button"
                >
                  <Text style={styles.startBtnTxt}>Play Again</Text>
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
    color: "#fff",
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
  bonusArea: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  timerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  bonusLabel: {
    color: C.accent,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textAlign: "center",
  },
  bonusSubLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
    marginTop: -8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginTop: 4,
  },
  fpLabel: {
    color: C.accent,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 4,
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
  doneSummary: {
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  doneStat: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  doneInsight: {
    color: C.accent,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  doneMissed: {
    marginTop: 8,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
  },
  doneMissedLabel: {
    color: C.textDim,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 2,
  },
  doneMissedItem: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
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
