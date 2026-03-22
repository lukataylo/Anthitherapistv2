/**
 * Chapter definitions — the narrative backbone of the app.
 *
 * Each chapter is a themed therapeutic arc (e.g. "Facing Your Fears",
 * "The Perfectionism Trap") containing an ordered sequence of pages.
 * Pages cycle through four activity types:
 *
 *  - **reflect** — a journaling question the user answers in their own words
 *  - **reframe** — the existing thought capture → word analysis → reframing flow
 *  - **practice** — one of the five CBT mini-games
 *  - **discuss** — a Socratic coaching question seeded with the chapter's theme
 *
 * ## Narrative design
 *
 * Chapters are ordered by CBT treatment sequencing:
 *  1. Psychoeducation (what are thoughts?)
 *  2. Self-judgment (inner critic)
 *  3. Fear / avoidance
 *  4. Absolute thinking / perfectionism
 *  5. Cognitive errors (fortune telling, mind reading)
 *  6. Social comparison
 *  7. Emotional awareness (anger)
 *  8. Integration & self-authorship
 *
 * Each chapter contains 6 pages — enough for a week of daily practice
 * without being overwhelming.
 *
 * ## Progressive unlocking
 *
 * Only Chapter 1 is unlocked initially. Completing all pages in a chapter
 * unlocks the next one. This mirrors CBT's progressive exposure hierarchy.
 */

import { Ionicons } from "@expo/vector-icons";

export type ActivityType = "reflect" | "reframe" | "practice" | "discuss";

export type PageDef = {
  id: string;
  activityType: ActivityType;
  /** Prompt shown for reflect and discuss pages. */
  prompt?: string;
  /** Optional hint toggled by the user. */
  hint?: string;
  /** Game id for practice pages — maps to existing game ids. */
  gameId?: string;
  /** Seed message for discuss pages — sets the Socratic theme. */
  discussSeed?: string;
};

export type ChapterDef = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  bg: string;
  patternColor: string;
  patternType: "chevrons" | "arcs" | "grid" | "rings";
  pages: PageDef[];
};

export const CHAPTERS: ChapterDef[] = [
  // ─── Chapter 1: Psychoeducation ──────────────────────────────────────
  {
    id: "meeting-your-mind",
    number: 1,
    title: "Meeting Your Mind",
    subtitle: "What are thoughts, really?",
    description:
      "Discover how your mind creates stories — and why not all of them are true.",
    icon: "bulb-outline",
    accentColor: "#3B82F6",
    bg: "#020A1A",
    patternColor: "#1E3A6E",
    patternType: "arcs",
    pages: [
      {
        id: "c1-reflect-1",
        activityType: "reflect",
        prompt:
          "Think about the last time a thought appeared in your head uninvited. What was it, and how did it make you feel?",
        hint: "Thoughts arrive automatically — like pop-up notifications from your brain. You didn't choose them.",
      },
      {
        id: "c1-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c1-reflect-2",
        activityType: "reflect",
        prompt:
          "If your thoughts were a weather forecast, what's the climate been like this week? Sunny, cloudy, stormy?",
        hint: "This isn't about judging — just observing. You're learning to watch the weather without getting wet.",
      },
      {
        id: "c1-practice-1",
        activityType: "practice",
        gameId: "sort-tower",
      },
      {
        id: "c1-reframe-2",
        activityType: "reframe",
      },
      {
        id: "c1-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I'm starting to pay attention to my thoughts for the first time. I'd like to explore what I'm noticing.",
      },
    ],
  },

  // ─── Chapter 2: The Inner Critic ─────────────────────────────────────
  {
    id: "the-inner-critic",
    number: 2,
    title: "The Inner Critic",
    subtitle: "That harsh voice inside",
    description:
      "Learn to recognise self-judgment patterns and talk back to the voice that says you're not enough.",
    icon: "heart-outline",
    accentColor: "#EC4899",
    bg: "#14060E",
    patternColor: "#BE185D",
    patternType: "rings",
    pages: [
      {
        id: "c2-reflect-1",
        activityType: "reflect",
        prompt:
          "When you criticise yourself, whose voice does it sound like? A parent, a teacher, a version of you?",
        hint: "Sometimes our inner critic borrows words from someone in our past.",
      },
      {
        id: "c2-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c2-reflect-2",
        activityType: "reflect",
        prompt:
          "Write down three things you like about yourself that have nothing to do with productivity or achievement.",
        hint: "Think about qualities, quirks, the way you make people feel.",
      },
      {
        id: "c2-practice-1",
        activityType: "practice",
        gameId: "reality-check",
      },
      {
        id: "c2-reframe-2",
        activityType: "reframe",
      },
      {
        id: "c2-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I've been noticing my inner critic a lot lately. I'd like to understand where it comes from and how to respond to it.",
      },
    ],
  },

  // ─── Chapter 3: Facing Your Fears ────────────────────────────────────
  {
    id: "facing-your-fears",
    number: 3,
    title: "Facing Your Fears",
    subtitle: "Moving toward what scares you",
    description:
      "Confront avoidance patterns and discover that what you fear often shrinks when you look at it directly.",
    icon: "flash-outline",
    accentColor: "#9B5CF6",
    bg: "#0E0820",
    patternColor: "#7C3AED",
    patternType: "arcs",
    pages: [
      {
        id: "c3-reflect-1",
        activityType: "reflect",
        prompt:
          "What is one fear that has been on your mind recently? When did you first notice it?",
        hint: "It can be big or small — anything that makes you feel uneasy.",
      },
      {
        id: "c3-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c3-reflect-2",
        activityType: "reflect",
        prompt:
          "What is the worst thing you imagine happening because of this fear? How likely is it, really?",
        hint: "Write it out fully — sometimes seeing it on screen takes away its power.",
      },
      {
        id: "c3-practice-1",
        activityType: "practice",
        gameId: "rocket-reframe",
      },
      {
        id: "c3-reframe-2",
        activityType: "reframe",
      },
      {
        id: "c3-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I've been avoiding something because of fear. I'd like to explore what's really behind the avoidance.",
      },
    ],
  },

  // ─── Chapter 4: The Perfectionism Trap ───────────────────────────────
  {
    id: "the-perfectionism-trap",
    number: 4,
    title: "The Perfectionism Trap",
    subtitle: "Letting go of impossible standards",
    description:
      "Explore how all-or-nothing thinking keeps you stuck and learn to embrace good enough.",
    icon: "ribbon-outline",
    accentColor: "#F97316",
    bg: "#140A02",
    patternColor: "#C2410C",
    patternType: "grid",
    pages: [
      {
        id: "c4-reflect-1",
        activityType: "reflect",
        prompt:
          "What is something you've been avoiding because you can't do it perfectly?",
        hint: "Perfectionism often disguises itself as high standards.",
      },
      {
        id: "c4-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c4-reflect-2",
        activityType: "reflect",
        prompt:
          "What rules do you hold yourself to that you would never impose on someone else?",
        hint: "Write them down — seeing double standards on screen is revealing.",
      },
      {
        id: "c4-practice-1",
        activityType: "practice",
        gameId: "reword",
      },
      {
        id: "c4-reframe-2",
        activityType: "reframe",
      },
      {
        id: "c4-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I think I might be a perfectionist. I'd like to understand how it affects my daily life and what 'good enough' could look like.",
      },
    ],
  },

  // ─── Chapter 5: Seeing Clearly ───────────────────────────────────────
  {
    id: "seeing-clearly",
    number: 5,
    title: "Seeing Clearly",
    subtitle: "Beyond fortune telling and mind reading",
    description:
      "Catch yourself predicting the worst or assuming what others think — and learn to check the evidence.",
    icon: "eye-outline",
    accentColor: "#06B6D4",
    bg: "#02101A",
    patternColor: "#0891B2",
    patternType: "grid",
    pages: [
      {
        id: "c5-reflect-1",
        activityType: "reflect",
        prompt:
          "Think of a time you were sure something bad would happen — and it didn't. What did your mind tell you versus what actually occurred?",
        hint: "Fortune telling is when we predict the future as though we already know the outcome.",
      },
      {
        id: "c5-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c5-reflect-2",
        activityType: "reflect",
        prompt:
          "When was the last time you assumed you knew what someone else was thinking about you? What evidence did you actually have?",
        hint: "Mind reading feels like fact, but it's always a guess.",
      },
      {
        id: "c5-practice-1",
        activityType: "practice",
        gameId: "mind-voyage",
      },
      {
        id: "c5-reframe-2",
        activityType: "reframe",
      },
      {
        id: "c5-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I often catch myself predicting bad outcomes or assuming what people think of me. I'd like to explore this pattern.",
      },
    ],
  },

  // ─── Chapter 6: Beyond Comparison ────────────────────────────────────
  {
    id: "beyond-comparison",
    number: 6,
    title: "Beyond Comparison",
    subtitle: "Your path is your own",
    description:
      "Stop measuring your life against someone else's highlight reel and reconnect with your own growth.",
    icon: "people-outline",
    accentColor: "#10B981",
    bg: "#021410",
    patternColor: "#059669",
    patternType: "rings",
    pages: [
      {
        id: "c6-reflect-1",
        activityType: "reflect",
        prompt:
          "Who have you been comparing yourself to recently? What specifically triggers the comparison?",
        hint: "Social media, a colleague, a sibling — name the source.",
      },
      {
        id: "c6-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c6-reflect-2",
        activityType: "reflect",
        prompt:
          "If you could only measure yourself against who you were a year ago, what progress would you see?",
        hint: "Growth is easier to spot looking backward.",
      },
      {
        id: "c6-practice-1",
        activityType: "practice",
        gameId: "reality-check",
      },
      {
        id: "c6-practice-2",
        activityType: "practice",
        gameId: "sort-tower",
      },
      {
        id: "c6-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I find myself constantly comparing my life to others'. I'd like to explore why and how to focus on my own path.",
      },
    ],
  },

  // ─── Chapter 7: Understanding Anger ──────────────────────────────────
  {
    id: "understanding-anger",
    number: 7,
    title: "Understanding Anger",
    subtitle: "What's underneath when anger shows up",
    description:
      "Discover that anger is information, not the enemy — and learn to listen to what it's really saying.",
    icon: "thunderstorm-outline",
    accentColor: "#EF4444",
    bg: "#140404",
    patternColor: "#B91C1C",
    patternType: "chevrons",
    pages: [
      {
        id: "c7-reflect-1",
        activityType: "reflect",
        prompt:
          "Think of a recent time you felt angry. Underneath that anger, was there a softer feeling — hurt, fear, helplessness?",
        hint: "Anger often acts as a bodyguard for more vulnerable emotions.",
      },
      {
        id: "c7-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c7-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I've been feeling angry a lot lately. I want to understand what's underneath it rather than just reacting.",
      },
      {
        id: "c7-practice-1",
        activityType: "practice",
        gameId: "rocket-reframe",
      },
      {
        id: "c7-discuss-2",
        activityType: "discuss",
        discussSeed:
          "If my anger could speak calmly, what would it say? I'd like to explore the message behind my anger.",
      },
      {
        id: "c7-reflect-2",
        activityType: "reflect",
        prompt:
          "What is one way you could honour the message behind your anger without letting it take the wheel?",
        hint: "Anger is information. The goal isn't to silence it, but to listen better.",
      },
    ],
  },

  // ─── Chapter 8: Writing Your Own Story ───────────────────────────────
  {
    id: "writing-your-own-story",
    number: 8,
    title: "Writing Your Own Story",
    subtitle: "Integration and self-authorship",
    description:
      "Bring everything together. You've learned to see your thoughts — now choose which ones to believe.",
    icon: "pencil-outline",
    accentColor: "#F59E0B",
    bg: "#141002",
    patternColor: "#B45309",
    patternType: "chevrons",
    pages: [
      {
        id: "c8-reflect-1",
        activityType: "reflect",
        prompt:
          "Looking back at your journey so far, which chapter changed the way you see yourself the most? Why?",
        hint: "There's no right answer — just what resonates with where you are now.",
      },
      {
        id: "c8-reflect-2",
        activityType: "reflect",
        prompt:
          "If you could write one new belief to carry with you from this point forward, what would it be?",
        hint: "Not an affirmation — a real belief you're starting to feel might be true.",
      },
      {
        id: "c8-reframe-1",
        activityType: "reframe",
      },
      {
        id: "c8-reflect-3",
        activityType: "reflect",
        prompt:
          "What would you tell someone who is just starting this journey — the version of you from Chapter 1?",
        hint: "You've come further than you think.",
      },
      {
        id: "c8-practice-1",
        activityType: "practice",
        gameId: "mind-voyage",
      },
      {
        id: "c8-discuss-1",
        activityType: "discuss",
        discussSeed:
          "I've been working through my thought patterns for a while now. I'd like to reflect on what's changed and what I want to carry forward.",
      },
    ],
  },
];
