/**
 * RocketGame — multiple-choice reframing quiz with a gravity-based rocket mechanic.
 *
 * Players answer reframing questions as fast as possible to boost a rocket
 * upward. Gravity continuously pulls the rocket back down — if it touches
 * the bottom of the screen, the game ends. They have 3 lives.
 *
 * ## CBT rationale
 *
 * Reframing (substituting distorted language with balanced alternatives) is the
 * core skill of CBT. This game drills the association between specific distorted
 * words and their healthy counterparts. The time pressure prevents the user from
 * over-analysing and builds automatic recall — similar to CBT flashcard drills
 * used in therapy homework.
 *
 * ## Question generation — `buildQuestions`
 *
 * Each question presents a distorted word (`prompt`) and two options
 * (`opts: [string, string]`), one of which is the correct reframe. The wrong
 * option is randomly selected from other distorted words in the deck so it
 * contrasts clearly with the correct answer.
 *
 * Questions are sourced from:
 *  1. The user's `reframedWords` — pairs of (original distorted word, chosen reframe)
 *     from completed sessions (length ≤ 28 chars to fit the button)
 *  2. `FALLBACK` — a curated set of 18 common CBT word pairs used when the user
 *     has few history entries
 *
 * ## Rocket gravity mechanic
 *
 * The rocket's vertical position is controlled by a single `rocketTop` Animated.Value.
 * Two opposing animations run alternately:
 *
 *  - **Drift** (gravity): `startDrift()` animates `rocketTop` from its current
 *    position toward `R_BOT` over a duration proportional to the remaining distance.
 *    This ensures gravity "feels" constant regardless of rocket altitude.
 *
 *  - **Boost** (correct answer): `boostRocket()` stops the drift, moves the rocket
 *    up 65–95 px, then restarts drift from the new position.
 *
 * The rocket's visual position and the "altitude bar" on the right edge both read
 * from `rocketTop` via interpolation.
 *
 * ## Question timer
 *
 * Each question has a per-question timer bar that shrinks from full to empty.
 * The starting duration is `START_TIME` (5.8 s) and shrinks by `TIME_DEC` (160 ms)
 * each correct answer down to `MIN_TIME` (2 s), creating progressive difficulty.
 *
 * ## Speed bonus
 *
 * Answering quickly gives bonus points proportional to the timer fraction remaining
 * at the moment of the answer (`timerVal.current * 80`). The bonus is shown as a
 * floating "+N" popup for 700 ms.
 *
 * ## Stale closure problem — why so many refs?
 *
 * The game has many animation callbacks that reference game state (phase, lives,
 * qIdx). React Animated callbacks run asynchronously and can capture stale state
 * values from closures. All mutable game state that animation callbacks need is
 * mirrored into refs (`phaseRef`, `livesRef`, `qIdxRef`, `answeredRef`) that
 * are updated synchronously alongside their state counterparts. `handleTimeoutRef`
 * is itself a ref (a ref to a function) so the timer callback always calls the
 * most-recently-created version.
 *
 * ## Starfield parallax
 *
 * Three star layers (S1, S2, S3) are pre-generated outside the component so they
 * don't regenerate on re-render. Each layer scrolls at a different speed to create
 * depth (6.2 s, 3.4 s, 1.9 s per loop). S3 uses `streak: true` to render stars as
 * vertical streaks, mimicking hyper-speed parallax on the fastest layer.
 * Each layer has two copies (A and B) offset by one screen height to create a
 * seamless loop — as copy A scrolls off the bottom, copy B enters from the top.
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

const C = {
  bg: "#020810",
  accent: "#00CFFF",
  correct: "#00E896",
  wrong: "#FF4060",
  heart: "#FF4B8B",
  textDim: "rgba(255,255,255,0.45)",
  btn: "rgba(255,255,255,0.07)",
  btnBorder: "rgba(255,255,255,0.11)",
};

const R_TOP = SH * 0.12;
const R_BOT = SH * 0.56;
const R_START = SH * 0.46;
const MAX_LIVES = 3;
const START_TIME = 5800;
const MIN_TIME = 2000;
const TIME_DEC = 160;

// ─── Word pairs ───────────────────────────────────────────────────────────────

const FALLBACK = [
  { original: "always", better: "sometimes" },
  { original: "never", better: "rarely" },
  { original: "everyone", better: "some people" },
  { original: "terrible", better: "challenging" },
  { original: "disaster", better: "setback" },
  { original: "ruined", better: "affected" },
  { original: "stupid", better: "still learning" },
  { original: "failure", better: "attempt" },
  { original: "worthless", better: "struggling" },
  { original: "hate", better: "strongly dislike" },
  { original: "awful", better: "difficult" },
  { original: "impossible", better: "very hard" },
  { original: "useless", better: "not working yet" },
  { original: "hopeless", better: "tough right now" },
  { original: "pathetic", better: "overwhelmed" },
  { original: "idiot", better: "made a mistake" },
  { original: "loser", better: "facing a challenge" },
  { original: "weak", better: "finding it hard" },
];

type Pair = { original: string; better: string };
type Question = {
  prompt: string;
  opts: [string, string];
  correctIdx: 0 | 1;
};
type Phase = "idle" | "playing" | "done";

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function extractPairs(entries: HistoryEntry[]): Pair[] {
  const pairs: Pair[] = [];
  for (const e of entries) {
    for (let i = 0; i < e.words.length; i++) {
      if (e.words[i].category !== "neutral") {
        const r = e.reframedWords?.[String(i)];
        if (r && r.length <= 28)
          pairs.push({ original: e.words[i].word, better: r });
      }
    }
  }
  return [...pairs, ...FALLBACK];
}

function buildQuestions(pairs: Pair[]): Question[] {
  const sp = shuffle(pairs);
  const pool = sp.slice(0, Math.min(sp.length, 18));
  const negPool = sp.map((p) => p.original);

  return pool.map((pair, idx) => {
    const wrongCandidates = negPool.filter((_, i) => i !== idx);
    const wrong = wrongCandidates.length
      ? wrongCandidates[Math.floor(Math.random() * wrongCandidates.length)]
      : FALLBACK[idx % FALLBACK.length].original;
    const flip = Math.random() > 0.5;
    return {
      prompt: pair.original,
      opts: flip ? [pair.better, wrong] : [wrong, pair.better],
      correctIdx: (flip ? 0 : 1) as 0 | 1,
    };
  });
}

// ─── Stars ────────────────────────────────────────────────────────────────────

type StarData = { x: number; y: number; size: number; op: number };

function genStars(
  n: number,
  sz: [number, number],
  op: [number, number]
): StarData[] {
  return Array.from({ length: n }, () => ({
    x: Math.random() * SW,
    y: Math.random() * SH,
    size: Math.random() * (sz[1] - sz[0]) + sz[0],
    op: Math.random() * (op[1] - op[0]) + op[0],
  }));
}

// Stable outside component — won't regenerate on re-render
const S1 = genStars(38, [0.5, 1.3], [0.12, 0.4]);
const S2 = genStars(18, [1.0, 2.0], [0.2, 0.5]);
const S3 = genStars(9, [1.8, 3.0], [0.35, 0.7]);

function StarLayer({
  anim,
  stars,
  streak,
}: {
  anim: Animated.Value;
  stars: StarData[];
  streak?: boolean;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -SH,
        left: 0,
        width: SW,
        height: SH * 2,
        transform: [{ translateY: anim }],
      }}
    >
      {stars.flatMap((s, i) => [
        // Copy A: visible at translateY=0 (starts in [SH, 2*SH] of container)
        <View
          key={`a${i}`}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y + SH,
            width: s.size,
            height: streak ? s.size * 5 : s.size,
            borderRadius: s.size,
            backgroundColor: "#fff",
            opacity: s.op,
          }}
        />,
        // Copy B: enters as translateY → SH (in [0, SH] of container)
        <View
          key={`b${i}`}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: streak ? s.size * 5 : s.size,
            borderRadius: s.size,
            backgroundColor: "#fff",
            opacity: s.op,
          }}
        />,
      ])}
    </Animated.View>
  );
}

// ─── Rocket ───────────────────────────────────────────────────────────────────

function Rocket({ flameAnim }: { flameAnim: Animated.Value }) {
  return (
    <View style={{ alignItems: "center", width: 58 }}>
      {/* Nose cone */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 14,
          borderRightWidth: 14,
          borderBottomWidth: 28,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: "#DDDDE8",
        }}
      />
      {/* Body */}
      <View
        style={{
          width: 28,
          backgroundColor: "#E6E6F2",
          alignItems: "center",
          paddingTop: 6,
          paddingBottom: 4,
        }}
      >
        {/* Porthole */}
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#050E1A",
            borderWidth: 2,
            borderColor: C.accent,
          }}
        />
        {/* Red stripe */}
        <View
          style={{
            width: 28,
            height: 2.5,
            backgroundColor: "#FF3838",
            marginTop: 5,
          }}
        />
        <View style={{ height: 6 }} />
      </View>
      {/* Fin row */}
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {/* Left fin */}
        <View
          style={{
            width: 14,
            height: 22,
            backgroundColor: "#B4B4C8",
            borderTopLeftRadius: 3,
            transform: [{ skewX: "-14deg" }],
          }}
        />
        {/* Engine block */}
        <View
          style={{
            width: 28,
            height: 12,
            backgroundColor: "#C4C4D6",
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
          }}
        />
        {/* Right fin */}
        <View
          style={{
            width: 14,
            height: 22,
            backgroundColor: "#B4B4C8",
            borderTopRightRadius: 3,
            transform: [{ skewX: "14deg" }],
          }}
        />
      </View>
      {/* Flame */}
      <Animated.View
        style={{
          width: 18,
          borderBottomLeftRadius: 9,
          borderBottomRightRadius: 9,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          overflow: "hidden",
          backgroundColor: "#FF7A00",
          alignItems: "center",
          height: flameAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 34],
          }),
        }}
      >
        {/* Inner cyan flame */}
        <View
          style={{
            width: 7,
            height: 18,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            borderTopLeftRadius: 1,
            borderTopRightRadius: 1,
            backgroundColor: C.accent,
            marginTop: 2,
          }}
        />
      </Animated.View>
      {/* Exhaust glow */}
      <Animated.View
        style={{
          width: 30,
          height: 20,
          borderRadius: 15,
          backgroundColor: C.accent,
          opacity: flameAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.06, 0.18],
          }),
          marginTop: -6,
        }}
      />
    </View>
  );
}

// ─── Main game ────────────────────────────────────────────────────────────────

export function RocketGame({
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
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [qIdx, setQIdx] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [bonusText, setBonusText] = useState<string | null>(null);
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null);

  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [missedItems, setMissedItems] = useState<{ prompt: string; correct: string }[]>([]);
  const [peakAltitudePct, setPeakAltitudePct] = useState(0);
  const [timeoutCount, setTimeoutCount] = useState(0);

  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const missedItemsRef = useRef<{ prompt: string; correct: string }[]>([]);
  const peakRocketTopRef = useRef(R_START);
  const timeoutCountRef = useRef(0);

  // Animated values
  const rocketTop = useRef(new Animated.Value(R_START)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const bonusOpacity = useRef(new Animated.Value(0)).current;
  const star1 = useRef(new Animated.Value(0)).current;
  const star2 = useRef(new Animated.Value(0)).current;
  const star3 = useRef(new Animated.Value(0)).current;

  // Mutable refs (avoid stale closures in animation callbacks)
  const phaseRef = useRef<Phase>("idle");
  const livesRef = useRef(MAX_LIVES);
  const qIdxRef = useRef(0);
  const answeredRef = useRef(false);
  const timePerQRef = useRef(START_TIME);
  const questionsRef = useRef<Question[]>([]);
  const rocketTopVal = useRef(R_START);
  const timerVal = useRef(1);

  const timerAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const driftAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const starAnimsRef = useRef<Animated.CompositeAnimation[]>([]);
  const flameLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Track animated values via listener
  useEffect(() => {
    const id1 = rocketTop.addListener(({ value }) => {
      rocketTopVal.current = value;
      if (value < peakRocketTopRef.current) peakRocketTopRef.current = value;
    });
    const id2 = timerAnim.addListener(({ value }) => {
      timerVal.current = value;
    });
    return () => {
      rocketTop.removeListener(id1);
      timerAnim.removeListener(id2);
    };
  }, [rocketTop, timerAnim]);

  // Flame pulse loop
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.sin,
          useNativeDriver: false,
        }),
        Animated.timing(flameAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.sin,
          useNativeDriver: false,
        }),
      ])
    );
    flameLoopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [visible, flameAnim]);

  // ── Stars ──
  const startStars = useCallback(() => {
    star1.setValue(0);
    star2.setValue(0);
    star3.setValue(0);
    const a1 = Animated.loop(
      Animated.timing(star1, {
        toValue: SH,
        duration: 6200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const a2 = Animated.loop(
      Animated.timing(star2, {
        toValue: SH,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const a3 = Animated.loop(
      Animated.timing(star3, {
        toValue: SH,
        duration: 1900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    a1.start();
    a2.start();
    a3.start();
    starAnimsRef.current = [a1, a2, a3];
  }, [star1, star2, star3]);

  const stopStars = useCallback(() => {
    starAnimsRef.current.forEach((a) => a.stop());
    starAnimsRef.current = [];
  }, []);

  // ── Rocket drift (gravity) ──
  const startDrift = useCallback(
    (fromY: number) => {
      driftAnimRef.current?.stop();
      const remaining = (R_BOT - fromY) / (R_BOT - R_TOP);
      const duration = Math.max(1000, remaining * 13000);
      const drift = Animated.timing(rocketTop, {
        toValue: R_BOT,
        duration,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      driftAnimRef.current = drift;
      drift.start();
    },
    [rocketTop]
  );

  // ── Boost on correct answer ──
  const boostRocket = useCallback(() => {
    driftAnimRef.current?.stop();
    const boost = 65 + Math.random() * 30;
    const newY = Math.max(R_TOP, rocketTopVal.current - boost);
    Animated.timing(rocketTop, {
      toValue: newY,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && phaseRef.current === "playing") {
        startDrift(rocketTopVal.current);
      }
    });
  }, [rocketTop, startDrift]);

  // ── Feedback flash ──
  const showFeedback = useCallback(
    (type: "correct" | "wrong") => {
      setFeedback(type);
      Animated.sequence([
        Animated.timing(feedbackOpacity, {
          toValue: 0.22,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start(() => setFeedback(null));
    },
    [feedbackOpacity]
  );

  // ── Speed bonus popup ──
  const showBonus = useCallback(
    (pts: number) => {
      setBonusText(`+${pts}`);
      bonusOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(bonusOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(bonusOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setBonusText(null));
    },
    [bonusOpacity]
  );

  // ── Next question ──
  const nextQuestion = useCallback(() => {
    const nextIdx = qIdxRef.current + 1;
    if (nextIdx >= questionsRef.current.length) {
      const pct = Math.round(
        ((R_BOT - peakRocketTopRef.current) / (R_BOT - R_TOP)) * 100
      );
      setCorrectCount(correctCountRef.current);
      setWrongCount(wrongCountRef.current);
      setBestStreak(bestStreakRef.current);
      setMissedItems([...missedItemsRef.current]);
      setPeakAltitudePct(Math.min(100, Math.max(0, pct)));
      setTimeoutCount(timeoutCountRef.current);
      phaseRef.current = "done";
      setPhase("done");
      driftAnimRef.current?.stop();
      timerAnimRef.current?.stop();
      return;
    }
    qIdxRef.current = nextIdx;
    setQIdx(nextIdx);
    answeredRef.current = false;
    setAnswered(false);
    setRevealAnswer(null);

    timerAnim.setValue(1);
    const timer = Animated.timing(timerAnim, {
      toValue: 0,
      duration: timePerQRef.current,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    timerAnimRef.current = timer;
    timer.start(({ finished }) => {
      if (finished && phaseRef.current === "playing" && !answeredRef.current) {
        handleTimeoutRef.current();
      }
    });
  }, [timerAnim]);

  const captureDoneStats = useCallback(() => {
    const pct = Math.round(
      ((R_BOT - peakRocketTopRef.current) / (R_BOT - R_TOP)) * 100
    );
    setCorrectCount(correctCountRef.current);
    setWrongCount(wrongCountRef.current);
    setBestStreak(bestStreakRef.current);
    setMissedItems([...missedItemsRef.current]);
    setPeakAltitudePct(Math.min(100, Math.max(0, pct)));
    setTimeoutCount(timeoutCountRef.current);
  }, []);

  // ── Timeout handler (ref-stable to avoid stale closure in timer callback) ──
  const handleTimeoutRef = useRef(() => {});
  handleTimeoutRef.current = () => {
    if (phaseRef.current !== "playing") return;
    answeredRef.current = true;
    setAnswered(true);
    showFeedback("wrong");

    const q = questionsRef.current[qIdxRef.current];
    wrongCountRef.current += 1;
    timeoutCountRef.current += 1;
    streakRef.current = 0;
    if (q && missedItemsRef.current.length < 3) {
      const correctOpt = q.opts[q.correctIdx];
      missedItemsRef.current = [...missedItemsRef.current, { prompt: q.prompt, correct: correctOpt }];
    }

    const newLives = livesRef.current - 1;
    livesRef.current = newLives;
    setLives(newLives);

    if (newLives <= 0) {
      setTimeout(() => {
        phaseRef.current = "done";
        captureDoneStats();
        setPhase("done");
        driftAnimRef.current?.stop();
      }, 600);
      return;
    }
    setTimeout(() => nextQuestion(), 800);
  };

  // ── Answer press ──
  const handleAnswer = useCallback(
    (idx: 0 | 1) => {
      if (phaseRef.current !== "playing" || answeredRef.current) return;
      answeredRef.current = true;
      setAnswered(true);
      timerAnimRef.current?.stop();

      const q = questionsRef.current[qIdxRef.current];
      const correct = idx === q.correctIdx;

      showFeedback(correct ? "correct" : "wrong");

      if (correct) {
        const speedBonus = Math.round(timerVal.current * 80);
        const pts = 100 + speedBonus;
        setScore((s) => s + pts);
        if (speedBonus > 15) showBonus(speedBonus);

        const newTime = Math.max(MIN_TIME, timePerQRef.current - TIME_DEC);
        timePerQRef.current = newTime;

        correctCountRef.current += 1;
        const ns = streakRef.current + 1;
        streakRef.current = ns;
        if (ns > bestStreakRef.current) bestStreakRef.current = ns;

        boostRocket();
        setTimeout(() => nextQuestion(), 480);
      } else {
        setRevealAnswer(q.opts[q.correctIdx]);
        wrongCountRef.current += 1;
        streakRef.current = 0;
        if (missedItemsRef.current.length < 3) {
          const correctOpt = q.opts[q.correctIdx];
          missedItemsRef.current = [...missedItemsRef.current, { prompt: q.prompt, correct: correctOpt }];
        }

        const newLives = livesRef.current - 1;
        livesRef.current = newLives;
        setLives(newLives);

        if (newLives <= 0) {
          setTimeout(() => {
            phaseRef.current = "done";
            captureDoneStats();
            setPhase("done");
            driftAnimRef.current?.stop();
          }, 650);
          return;
        }
        setTimeout(() => nextQuestion(), 720);
      }
    },
    [showFeedback, showBonus, boostRocket, nextQuestion, captureDoneStats]
  );

  // ── Start game ──
  const startGame = useCallback(() => {
    const pairs = extractPairs(entries);
    const qs = buildQuestions(pairs);
    if (qs.length === 0) return;

    questionsRef.current = qs;
    qIdxRef.current = 0;
    livesRef.current = MAX_LIVES;
    timePerQRef.current = START_TIME;
    answeredRef.current = false;
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    missedItemsRef.current = [];
    peakRocketTopRef.current = R_START;
    timeoutCountRef.current = 0;

    setQuestions(qs);
    setQIdx(0);
    setScore(0);
    setLives(MAX_LIVES);
    setAnswered(false);
    setFeedback(null);
    setRevealAnswer(null);
    setCorrectCount(0);
    setWrongCount(0);
    setBestStreak(0);
    setMissedItems([]);
    setPeakAltitudePct(0);
    setTimeoutCount(0);

    rocketTop.setValue(R_START);
    rocketTopVal.current = R_START;

    phaseRef.current = "playing";
    setPhase("playing");

    startStars();
    startDrift(R_START);

    timerAnim.setValue(1);
    const timer = Animated.timing(timerAnim, {
      toValue: 0,
      duration: START_TIME,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    timerAnimRef.current = timer;
    timer.start(({ finished }) => {
      if (finished && phaseRef.current === "playing" && !answeredRef.current) {
        handleTimeoutRef.current();
      }
    });
  }, [entries, startStars, startDrift, rocketTop, timerAnim]);

  // ── Cleanup on hide ──
  useEffect(() => {
    if (!visible) {
      phaseRef.current = "idle";
      setPhase("idle");
      timerAnimRef.current?.stop();
      driftAnimRef.current?.stop();
      stopStars();
    }
  }, [visible, stopStars]);

  const currentQ = questions[qIdx];

  const heightPct = rocketTop.interpolate({
    inputRange: [R_TOP, R_BOT],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [C.wrong, "#FF9500", C.correct],
  });

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.root}>
        {/* ── Starfield background ── */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]}
          />
          <StarLayer anim={star1} stars={S1} />
          <StarLayer anim={star2} stars={S2} />
          <StarLayer anim={star3} stars={S3} streak />
        </View>

        {/* ── Feedback colour flash ── */}
        {feedback && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  feedback === "correct" ? C.correct : C.wrong,
                opacity: feedbackOpacity,
                zIndex: 50,
              },
            ]}
          />
        )}

        {/* ── HUD row ── */}
        <View style={[styles.hud, { paddingTop: insets.top + 10 }]}>
          <QuitButton onQuit={onClose} isPlaying={phase === "playing"} />
        </View>

        {/* ── Lives + Score cluster (top right) ── */}
        <View style={[styles.rightCluster, { top: insets.top + 12 }]}>
          <View
            style={styles.livesRow}
            accessible
            accessibilityLabel={`${lives} of ${MAX_LIVES} lives remaining`}
            accessibilityRole="progressbar"
          >
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < lives ? "heart" : "heart-outline"}
                size={15}
                color={i < lives ? C.heart : "rgba(255,255,255,0.18)"}
                importantForAccessibility="no"
              />
            ))}
          </View>
          <View
            style={styles.scoreBox}
            accessible
            accessibilityLabel={`Score: ${score}`}
            accessibilityRole="text"
          >
            <Text style={styles.scoreNum} importantForAccessibility="no">{score}</Text>
            {bonusText && (
              <Animated.Text
                style={[styles.bonusTxt, { opacity: bonusOpacity }]}
              >
                {bonusText}
              </Animated.Text>
            )}
          </View>
        </View>

        {/* ── Height bar (right edge) ── */}
        {phase === "playing" && (
          <View
            style={[
              styles.altBarWrap,
              { top: insets.top + 50, bottom: SH * 0.4 },
            ]}
          >
            <View style={styles.altBarTrack}>
              <Animated.View
                style={[styles.altBarFill, { flex: heightPct }]}
              />
            </View>
            <Ionicons
              name="rocket-outline"
              size={9}
              color="rgba(255,255,255,0.35)"
              style={{ marginTop: 4 }}
            />
          </View>
        )}

        {/* ── Rocket ── */}
        {phase === "playing" && (
          <Animated.View
            style={[styles.rocketWrap, { top: rocketTop }]}
          >
            <Rocket flameAnim={flameAnim} />
          </Animated.View>
        )}

        {/* ── Playing bottom panel ── */}
        {phase === "playing" && currentQ && (
          <View
            style={[
              styles.bottomPanel,
              { paddingBottom: Math.max(insets.bottom + 14, 24) },
            ]}
          >
            {/* Timer bar */}
            <View style={styles.timerTrack}>
              <Animated.View
                style={[
                  styles.timerFill,
                  {
                    width: timerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: timerColor,
                  },
                ]}
              />
            </View>

            <Text style={styles.promptLabel}>use this instead:</Text>
            <Text style={styles.promptWord}>{currentQ.prompt}</Text>

            <View style={styles.optsCol}>
              {currentQ.opts.map((opt, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleAnswer(i as 0 | 1)}
                  disabled={answered}
                  accessibilityLabel={opt}
                  accessibilityRole="button"
                  accessibilityHint={`Pick "${opt}" as the better reframe for "${currentQ.prompt}"`}
                  style={({ pressed }) => [
                    styles.optBtn,
                    pressed && !answered && styles.optPressed,
                    answered &&
                      i === currentQ.correctIdx &&
                      styles.optCorrect,
                    answered &&
                      i !== currentQ.correctIdx &&
                      styles.optWrong,
                  ]}
                >
                  <Text style={styles.optTxt}>{opt}</Text>
                </Pressable>
              ))}
              {revealAnswer !== null && (
                <View pointerEvents="none" style={styles.revealBanner}>
                  <Text style={styles.revealTxt}>Correct: {revealAnswer}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Idle overlay ── */}
        {phase === "idle" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Ionicons
                name="rocket"
                size={44}
                color={C.accent}
                style={{ marginBottom: 14 }}
              />
              <Text style={styles.overlayTitle}>Rocket Reframe</Text>
              <Text style={styles.overlayDesc}>
                Pick the better word to keep your rocket flying. Answer fast —
                the clock gets tighter every round.
              </Text>
              <Pressable
                style={[styles.launchBtn, { marginTop: 16 }]}
                onPress={startGame}
                accessibilityLabel="Launch game"
                accessibilityRole="button"
              >
                <Text style={styles.launchBtnTxt}>Launch</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Done overlay ── */}
        {phase === "done" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.missionLabel}>
                {lives > 0 ? "MISSION COMPLETE" : "MISSION FAILED"}
              </Text>
              <Text style={styles.doneScore}>{score}</Text>
              <View style={styles.doneSummary}>
                <Text style={styles.doneStat}>
                  {correctCount}/{correctCount + wrongCount} correct ({correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0}%)
                </Text>
                <Text style={styles.doneStat}>Best streak: {bestStreak}</Text>
                <Text style={styles.doneStat}>Peak altitude: {peakAltitudePct}%</Text>
                {timeoutCount > 0 && (
                  <Text style={styles.doneStat}>Timeouts: {timeoutCount}</Text>
                )}
              </View>
              {missedItems.length > 0 && (
                <View style={styles.doneMissed}>
                  <Text style={styles.doneMissedLabel}>WORDS TO REVIEW</Text>
                  {missedItems.map((item, i) => (
                    <Text key={i} style={styles.doneMissedItem}>
                      "{item.prompt}" → {item.correct}
                    </Text>
                  ))}
                </View>
              )}
              <View style={styles.doneBtns}>
                <Pressable
                  style={styles.launchBtn}
                  onPress={startGame}
                  accessibilityLabel="Relaunch game"
                  accessibilityRole="button"
                >
                  <Text style={styles.launchBtnTxt}>Relaunch</Text>
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
    paddingHorizontal: 20,
    zIndex: 10,
  },
  rightCluster: {
    position: "absolute",
    right: 62,
    alignItems: "flex-end",
    zIndex: 10,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  scoreNum: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  bonusTxt: {
    color: C.correct,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  livesRow: {
    flexDirection: "row",
    gap: 5,
  },
  altBarWrap: {
    position: "absolute",
    right: 18,
    width: 22,
    alignItems: "center",
    zIndex: 10,
  },
  altBarTrack: {
    flex: 1,
    width: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  altBarFill: {
    width: 4,
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  rocketWrap: {
    position: "absolute",
    left: SW / 2 - 29,
    zIndex: 5,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    gap: 10,
  },
  timerTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 2,
  },
  timerFill: {
    height: 3,
    borderRadius: 2,
  },
  promptLabel: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  promptWord: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  optsCol: {
    gap: 10,
    position: "relative",
  },
  revealBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2,8,16,0.82)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  revealTxt: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  optBtn: {
    backgroundColor: C.btn,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.btnBorder,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
  },
  optPressed: {
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  optCorrect: {
    backgroundColor: "rgba(0,232,150,0.13)",
    borderColor: C.correct,
  },
  optWrong: {
    backgroundColor: "rgba(255,64,96,0.1)",
    borderColor: "rgba(255,64,96,0.3)",
  },
  optTxt: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,8,16,0.88)",
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
    maxWidth: 270,
  },
  launchBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 38,
    paddingVertical: 15,
    borderRadius: 100,
  },
  launchBtnTxt: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  missionLabel: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.8,
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
  doneMissed: {
    marginTop: 8,
    alignItems: "center",
    gap: 3,
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
