/**
 * Journey definitions — structured multi-step question flows for self-reflection.
 *
 * Each journey has a theme (e.g. tackling fears, building self-worth) and a
 * sequence of reflective questions. The user progresses through the steps,
 * answering each question in their own words. Progress is persisted so journeys
 * can be resumed across sessions.
 *
 * ## Journey structure
 *
 * - `id`          — unique string key
 * - `name`        — display title
 * - `description` — short summary shown on the card
 * - `icon`        — Ionicons glyph name
 * - `accentColor` — primary hue for the journey's UI
 * - `bg`          — dark background matching the accent
 * - `patternType` — decorative pattern (reuses GameCarousel patterns)
 * - `steps`       — ordered array of { prompt, hint } objects
 */

import { Ionicons } from "@expo/vector-icons";

export type JourneyStep = {
  prompt: string;
  hint: string;
};

export type JourneyDef = {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  bg: string;
  patternColor: string;
  patternType: "chevrons" | "arcs" | "grid" | "rings";
  steps: JourneyStep[];
};

export const JOURNEYS: JourneyDef[] = [
  {
    id: "tackling-fears",
    name: "Tackling Fears",
    description: "Face what holds you back, one question at a time.",
    icon: "flash-outline",
    accentColor: "#9B5CF6",
    bg: "#0E0820",
    patternColor: "#7C3AED",
    patternType: "arcs",
    steps: [
      {
        prompt: "What is one fear that has been on your mind recently?",
        hint: "It can be big or small — anything that makes you feel uneasy.",
      },
      {
        prompt: "When did you first notice this fear? Can you trace it back?",
        hint: "Think about whether it started from an event, a person, or a pattern.",
      },
      {
        prompt: "What is the worst thing you imagine happening because of this fear?",
        hint: "Write it out fully — sometimes seeing it on screen takes away its power.",
      },
      {
        prompt: "How likely is that worst-case scenario, really? What evidence do you have?",
        hint: "Try to separate the feeling from the facts.",
      },
      {
        prompt: "What would you tell a close friend if they had this exact fear?",
        hint: "We're often kinder to others than to ourselves.",
      },
      {
        prompt: "What is one small step you could take this week to move toward this fear rather than away from it?",
        hint: "It doesn't have to be dramatic. Even tiny steps build courage.",
      },
    ],
  },
  {
    id: "building-self-worth",
    name: "Building Self-Worth",
    description: "Reconnect with your value beyond what you do.",
    icon: "heart-outline",
    accentColor: "#EC4899",
    bg: "#14060E",
    patternColor: "#BE185D",
    patternType: "rings",
    steps: [
      {
        prompt: "Describe a moment recently when you felt good about yourself. What happened?",
        hint: "It doesn't need to be an achievement — maybe you were kind, or present.",
      },
      {
        prompt: "What do people who care about you appreciate most about you?",
        hint: "Think of specific things friends or family have said.",
      },
      {
        prompt: "When you criticise yourself, whose voice does it sound like?",
        hint: "Sometimes our inner critic borrows words from someone in our past.",
      },
      {
        prompt: "Write down three things you like about yourself that have nothing to do with productivity.",
        hint: "Think about qualities, quirks, the way you make people feel.",
      },
      {
        prompt: "What would change in your daily life if you truly believed you were enough?",
        hint: "Imagine waking up tomorrow with that belief already settled in.",
      },
      {
        prompt: "What is one kind thing you could do for yourself today — not earned, just given?",
        hint: "Self-worth grows when we practice treating ourselves well without conditions.",
      },
    ],
  },
  {
    id: "breaking-perfectionism",
    name: "Breaking Perfectionism",
    description: "Let go of impossible standards and embrace good enough.",
    icon: "ribbon-outline",
    accentColor: "#F97316",
    bg: "#140A02",
    patternColor: "#C2410C",
    patternType: "grid",
    steps: [
      {
        prompt: "What is something you've been avoiding because you can't do it perfectly?",
        hint: "Perfectionism often disguises itself as high standards.",
      },
      {
        prompt: "Think of a time when something imperfect turned out well. What happened?",
        hint: "The best stories often come from things that didn't go to plan.",
      },
      {
        prompt: "What rules do you hold yourself to that you would never impose on someone else?",
        hint: "Write them down — seeing double standards on screen is revealing.",
      },
      {
        prompt: "What does 'good enough' look like for something you're working on right now?",
        hint: "Try to describe it without using the word 'but'.",
      },
      {
        prompt: "Who taught you that mistakes are failures rather than information?",
        hint: "This belief usually comes from somewhere specific.",
      },
      {
        prompt: "What would you attempt if you knew imperfect results were completely acceptable?",
        hint: "Let yourself dream without the filter of 'but what if it's not great?'",
      },
    ],
  },
  {
    id: "understanding-anger",
    name: "Understanding Anger",
    description: "Explore what's underneath when anger shows up.",
    icon: "thunderstorm-outline",
    accentColor: "#EF4444",
    bg: "#140404",
    patternColor: "#B91C1C",
    patternType: "chevrons",
    steps: [
      {
        prompt: "Think of a recent time you felt angry. What triggered it?",
        hint: "Try to describe the specific moment the anger arrived.",
      },
      {
        prompt: "Underneath that anger, was there a softer feeling? Hurt, fear, helplessness?",
        hint: "Anger often acts as a bodyguard for more vulnerable emotions.",
      },
      {
        prompt: "What need of yours wasn't being met in that moment?",
        hint: "Maybe respect, safety, fairness, or being heard.",
      },
      {
        prompt: "How do you typically express anger? Does it come out in ways you'd prefer it didn't?",
        hint: "No judgement here — just honest observation.",
      },
      {
        prompt: "If your anger could speak calmly, what would it say?",
        hint: "Give it words it might not usually get to use.",
      },
      {
        prompt: "What is one way you could honour the message behind your anger without letting it take the wheel?",
        hint: "Anger is information. The goal isn't to silence it, but to listen better.",
      },
    ],
  },
  {
    id: "quieting-comparison",
    name: "Quieting Comparison",
    description: "Stop measuring your life against someone else's highlight reel.",
    icon: "people-outline",
    accentColor: "#06B6D4",
    bg: "#02101A",
    patternColor: "#0891B2",
    patternType: "arcs",
    steps: [
      {
        prompt: "Who have you been comparing yourself to recently? What specifically triggers it?",
        hint: "Social media, a colleague, a sibling — name the source.",
      },
      {
        prompt: "What part of their life are you seeing — and what parts are you probably not?",
        hint: "We compare our behind-the-scenes to their highlight reel.",
      },
      {
        prompt: "When you compare, what story does your mind tell you about yourself?",
        hint: "Try to catch the exact narrative — 'I'm not as...', 'I should be...'",
      },
      {
        prompt: "What is something you've overcome or built that you tend to overlook?",
        hint: "Your own path has chapters others would admire.",
      },
      {
        prompt: "If you could only measure yourself against who you were a year ago, what progress would you see?",
        hint: "Growth is easier to spot looking backward.",
      },
      {
        prompt: "What would you focus your energy on if comparison wasn't part of the equation?",
        hint: "Imagine that freedom — then consider: what's actually stopping you?",
      },
    ],
  },
];
