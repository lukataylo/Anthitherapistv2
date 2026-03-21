import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HistoryEntry } from "@/context/HistoryContext";
import type { WordAnalysis } from "@/context/GameContext";

const HISTORY_KEY = "reframe_history_v1";
const STREAK_KEY = "reframe_streak_v1";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

function makeId(offset: number): string {
  return `${Math.floor(daysAgo(offset))}-seed${offset}`;
}

const n = (word: string): WordAnalysis => ({
  word,
  category: "neutral",
  reframes: [],
  hint: null,
  fiftyFifty: [],
  explainer: null,
});

const SEED_ENTRIES: HistoryEntry[] = [
  {
    id: makeId(1),
    thought: "I always mess everything up at work",
    words: [
      n("I"),
      {
        word: "always",
        category: "absolute",
        reframes: ["sometimes", "occasionally", "can"],
        hint: "Absolute thinking",
        fiftyFifty: ["sometimes", "never"],
        explainer: '"Always" overgeneralises. "Sometimes" is more honest.',
      },
      n("mess"),
      {
        word: "everything",
        category: "absolute",
        reframes: ["some things", "a few tasks", "certain projects"],
        hint: "Over-generalisation",
        fiftyFifty: ["some things", "nothing"],
        explainer: 'Replace "everything" with "some things" for accuracy.',
      },
      n("up"),
      n("at"),
      n("work"),
    ],
    reframedWords: { 1: "sometimes", 3: "some things" },
    savedAt: daysAgo(1),
  },
  {
    id: makeId(2),
    thought: "Nobody ever really listens to what I say",
    words: [
      {
        word: "Nobody",
        category: "absolute",
        reframes: ["Some people", "Not everyone", "A few people"],
        hint: "All-or-nothing thinking",
        fiftyFifty: ["Some people", "Everyone"],
        explainer: '"Nobody" is an absolute. "Some people" reflects reality.',
      },
      {
        word: "ever",
        category: "absolute",
        reframes: ["always", "consistently", "often"],
        hint: "Absolute thinking",
        fiftyFifty: ["often", "never"],
        explainer: '"Ever" is extreme. Consider "often" or "sometimes".',
      },
      n("really"),
      n("listens"),
      n("to"),
      n("what"),
      n("I"),
      n("say"),
    ],
    reframedWords: { 0: "Some people" },
    savedAt: daysAgo(2),
  },
  {
    id: makeId(3),
    thought: "I'm worthless if I can't handle this alone",
    words: [
      n("I'm"),
      {
        word: "worthless",
        category: "self_judgment",
        reframes: ["struggling", "finding this hard", "challenged"],
        hint: "Labelling",
        fiftyFifty: ["struggling", "capable"],
        explainer: '"Worthless" is a global label. "Struggling" is specific and temporary.',
      },
      n("if"),
      n("I"),
      {
        word: "can't",
        category: "belief",
        reframes: ["find it difficult to", "haven't yet learned to", "am learning to"],
        hint: "Limiting belief",
        fiftyFifty: ["find it difficult to", "refuse to"],
        explainer: '"Can\'t" is permanent. "Find it difficult to" leaves room for growth.',
      },
      n("handle"),
      n("this"),
      n("alone"),
    ],
    reframedWords: { 1: "struggling", 4: "find it difficult to" },
    savedAt: daysAgo(3),
  },
  {
    id: makeId(5),
    thought: "This is terrible I must be the worst parent",
    words: [
      n("This"),
      n("is"),
      {
        word: "terrible",
        category: "absolute",
        reframes: ["difficult", "challenging", "hard right now"],
        hint: "Catastrophising",
        fiftyFifty: ["difficult", "wonderful"],
        explainer: '"Terrible" amplifies distress. "Difficult" is more grounded.',
      },
      n("I"),
      {
        word: "must",
        category: "belief",
        reframes: ["might feel like", "fear I am", "worry I am"],
        hint: "Should statements",
        fiftyFifty: ["could be", "cannot be"],
        explainer: '"Must" creates pressure. "Might feel like" keeps perspective.',
      },
      n("be"),
      n("the"),
      {
        word: "worst",
        category: "self_judgment",
        reframes: ["a flawed", "an imperfect", "a learning"],
        hint: "Labelling",
        fiftyFifty: ["a struggling", "the best"],
        explainer: '"Worst" is extreme self-judgement. Try "a learning parent".',
      },
      n("parent"),
    ],
    reframedWords: { 2: "difficult", 7: "a learning" },
    savedAt: daysAgo(5),
  },
  {
    id: makeId(7),
    thought: "I'll never feel better no matter what I do",
    words: [
      n("I'll"),
      {
        word: "never",
        category: "absolute",
        reframes: ["may not always", "don't always", "sometimes struggle to"],
        hint: "Fortune-telling",
        fiftyFifty: ["sometimes", "always"],
        explainer: '"Never" predicts permanent suffering. "Sometimes struggle to" is more honest.',
      },
      n("feel"),
      n("better"),
      n("no"),
      n("matter"),
      n("what"),
      n("I"),
      n("do"),
    ],
    reframedWords: { 1: "sometimes struggle to" },
    savedAt: daysAgo(7),
  },
  {
    id: makeId(8),
    thought: "I'm stupid for not figuring this out sooner",
    words: [
      n("I'm"),
      {
        word: "stupid",
        category: "self_judgment",
        reframes: ["still learning", "finding this complex", "working through"],
        hint: "Labelling",
        fiftyFifty: ["still learning", "brilliant"],
        explainer: '"Stupid" is a fixed label. "Still learning" is growth-oriented.',
      },
      n("for"),
      n("not"),
      n("figuring"),
      n("this"),
      n("out"),
      n("sooner"),
    ],
    reframedWords: { 1: "still learning" },
    savedAt: daysAgo(8),
  },
  {
    id: makeId(10),
    thought: "Everything is ruined because of my mistake",
    words: [
      {
        word: "Everything",
        category: "absolute",
        reframes: ["This situation", "One area", "A part of my plan"],
        hint: "Over-generalisation",
        fiftyFifty: ["One thing", "Nothing"],
        explainer: '"Everything" exaggerates scope. "This situation" is specific.',
      },
      n("is"),
      {
        word: "ruined",
        category: "absolute",
        reframes: ["affected", "set back", "challenged"],
        hint: "Catastrophising",
        fiftyFifty: ["set back", "perfect"],
        explainer: '"Ruined" implies no recovery. "Set back" keeps the door open.',
      },
      n("because"),
      n("of"),
      n("my"),
      n("mistake"),
    ],
    reframedWords: { 0: "This situation", 2: "set back" },
    savedAt: daysAgo(10),
  },
  {
    id: makeId(12),
    thought: "I should always know the right answer",
    words: [
      n("I"),
      {
        word: "should",
        category: "belief",
        reframes: ["aim to", "try to", "can work towards"],
        hint: "Should statements",
        fiftyFifty: ["could", "must"],
        explainer: '"Should" creates shame. "Aim to" gives you agency.',
      },
      {
        word: "always",
        category: "absolute",
        reframes: ["often", "usually", "frequently"],
        hint: "Absolute thinking",
        fiftyFifty: ["often", "never"],
        explainer: '"Always" is an impossible standard. "Often" is more compassionate.',
      },
      n("know"),
      n("the"),
      n("right"),
      n("answer"),
    ],
    reframedWords: { 1: "aim to", 2: "often" },
    savedAt: daysAgo(12),
  },
  {
    id: makeId(14),
    thought: "People must think I'm a total failure",
    words: [
      n("People"),
      {
        word: "must",
        category: "belief",
        reframes: ["might", "may", "could possibly"],
        hint: "Mind reading",
        fiftyFifty: ["might", "definitely"],
        explainer: '"Must" assumes certainty about others\' thoughts. "Might" is more realistic.',
      },
      n("think"),
      n("I'm"),
      n("a"),
      n("total"),
      {
        word: "failure",
        category: "self_judgment",
        reframes: ["person who made a mistake", "work in progress", "learner"],
        hint: "Labelling",
        fiftyFifty: ["a learner", "a success"],
        explainer: '"Failure" defines your worth by one outcome. You are more than that.',
      },
    ],
    reframedWords: { 1: "might", 6: "person who made a mistake" },
    savedAt: daysAgo(14),
  },
];

const SEED_STREAK = {
  currentStreak: 7,
  longestStreak: 12,
  lastReflectionDate: todayStr(),
};

export async function seedIfEmpty(): Promise<void> {
  try {
    const [history, streak] = await Promise.all([
      AsyncStorage.getItem(HISTORY_KEY),
      AsyncStorage.getItem(STREAK_KEY),
    ]);

    const writes: Promise<void>[] = [];

    if (!history) {
      writes.push(
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(SEED_ENTRIES))
      );
    }

    if (!streak) {
      writes.push(
        AsyncStorage.setItem(STREAK_KEY, JSON.stringify(SEED_STREAK))
      );
    }

    await Promise.all(writes);
  } catch {
    // silently ignore — seeding is best-effort
  }
}
