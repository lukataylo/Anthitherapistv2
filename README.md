# Antitherapist — AI-Powered CBT in Five Mini-Games

> **Your thoughts, word by word. Your patterns, turned into play.**
> Antitherapist uses Claude AI to identify cognitive distortions at the word level, colour-code them in real time, and turn your thinking patterns into five personalised mini-games — so you actually *want* to practise CBT.

---

## The Problem

Cognitive Behavioural Therapy is one of the most evidence-backed treatments for anxiety, depression, and negative self-talk. The technique is simple: catch a distorted thought, name the distortion, reframe it.

The practice is brutal. Paper diaries collect dust. Plain-text apps offer no feedback. People quit before the skill sticks.

**Antitherapist closes that loop** — with AI precision, word-level annotation, and games that run on your own history.

---

## Why It Works (and Why Not Just a Chatbot)

Apps like Woebot and Youper offer AI conversation — but conversation alone doesn't build the skill. Antitherapist is different:

- **Word-level precision, not thought-level vagueness.** Claude doesn't label your *thought* as distorted — it labels each *word*. You see exactly which part of the sentence is doing the damage. Chatbots work at the paragraph level; Antitherapist works at the word level.
- **Your data powers your training.** The mini-games draw exclusively from your own captured thoughts — you practise on *your* patterns, not generic exercises.
- **Instant, visual feedback.** Every word is colour-coded by distortion type the moment you submit. No waiting. No ambiguity.

The result: annotate → reframe → play games built from your own patterns → improve.

---

## Try This First — 90-Second Demo

1. **Speak tab → type a negative thought.** Try: *"I always mess everything up and everyone can tell."* Hit send.
2. **Watch the AI annotate.** Distorted words light up in colour: red for beliefs, purple for fears, orange for absolutes, pink for self-judgements. Neutral words stay plain.
3. **Tap a coloured word.** A reframe panel slides up. Hit **HINT** for Claude's suggestion, then type your own reframe or use **50/50** to pick between two options.
4. **Shape tab → open Sort Tower.** Swipe word cards left (distorted) or right (healthy) — the words are from *your* thought.
5. **Open Reality Check.** Read a thought and decide: DISTORTED or HEALTHY? Get it wrong and the distorted words are highlighted with an explanation — a teaching moment, not just a score.

---

## Key Features

| Feature | What it does |
|---|---|
| **AI thought capture** | Claude classifies every word as a named cognitive distortion or neutral, rendered inline with colour-coded chips |
| **Word reframing** | Tap any distorted word for AI-generated healthier alternatives; choose one to log your reframe |
| **History feed** | Chronological log of thoughts with per-entry progress badges |
| **Entry insights** | Tap any entry for a word-by-word breakdown and an AI-generated narrative insight |
| **Streak tracking** | Daily-use streak, best streak, and total-reflections counters |
| **Five mini-games** | Carousel of CBT games that draw from your own captured history |
| **Discuss mode** | Socratic coaching chat with Claude — questions only, no labels, no diagnoses |
| **Optional auth** | Self-hosted login with JWT — enable it to sync data across devices |

---

## Navigation

Three tabs plus one hidden screen:

| Tab | Purpose |
|---|---|
| **Speak** | Capture a thought, get word-level AI annotation, reframe distorted words |
| **Shape** | Browse reflection history and launch the five CBT mini-games |
| **Own** | Swipe through belief flashcards built from your own history |
| **Discuss** *(hidden)* | Socratic coaching session with Claude — accessible in-app, not in the tab bar |

---

## The 5 Mini-Games

Each game launches full-screen from the Shape tab and draws rounds from your own captured thoughts.

| # | Game | Skill trained |
|---|---|---|
| 1 | **Sort Tower** — Swipe cards left or right to sort distorted vs. healthy words into a growing stack | Rapid categorisation |
| 2 | **Rocket Reframe** — A word is blanked in your thought; pick the best replacement to fire the rocket | Active word substitution |
| 3 | **Reality Check** — Is this whole thought distorted? If so, which category? | Whole-thought awareness |
| 4 | **Mind Voyage** — One word is highlighted; tap ERROR or VALID to sail across a moonlit sea | Word-level precision |
| 5 | **Reword** — A distorted word sits at the root of a branching tree; choose the branch that best replaces it | Vocabulary building |

---

## Cognitive Distortion Categories

Four categories, each with a distinct colour:

| Category | Colour | Example words | CBT concepts covered |
|---|---|---|---|
| `belief` | 🔴 Red `#FF5B5B` | "worthless", "broken", "unlovable" | Core beliefs, labelling, personalisation |
| `fear` | 🟣 Purple `#9B5CF6` | "terrified", "catastrophe", "doomed" | Catastrophising, fortune-telling, threat overestimation |
| `absolute` | 🟠 Orange `#F97316` | "always", "never", "everyone", "impossible" | Overgeneralising, all-or-nothing thinking, should-statements |
| `self_judgment` | 🩷 Pink `#EC4899` | "stupid", "pathetic", "failure", "weak" | Negative self-talk, self-labelling, harsh self-criticism |

Words not in any category render as plain text (`neutral`).

---

## How We Built It

A staged multi-tool AI workflow — each tool chosen for where it adds the most leverage:

| Stage | Tool | Why |
|---|---|---|
| **Prototyping** | Google AI Studio | Multimodal reasoning over screenshots and sketches accelerated UI and colour-system decisions |
| **Backend** | Claude Code | Strong at API design, CBT logic modelling, and system architecture |
| **Games** | Replit | Integrated AI agent and live preview made it ideal for interactive game development |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo SDK 54, Expo Router 6 |
| Language | TypeScript (strict) |
| UI | React Native, custom StyleSheet |
| Animations | React Native Reanimated 4, Animated API |
| Gestures | react-native-gesture-handler |
| Local storage | AsyncStorage |
| API server | Express 5 + TypeScript |
| AI | Claude Sonnet 4.6 via Anthropic SDK |
| API contracts | OpenAPI 3.1 (orval codegen → React Query hooks + Zod) |
| Auth | JWT + bcrypt (optional self-hosted login) |
| Monorepo | pnpm workspaces |

---

## Getting Started

**Prerequisites:** Node.js 20+, pnpm 10+, Expo Go on your phone, an Anthropic API key

```bash
git clone https://github.com/lukataylo/Antitherapistv2.git
cd Antitherapistv2
pnpm install
```

```bash
# Terminal 1 — API server
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Expo mobile app
PORT=18115 pnpm --filter @workspace/mobile run dev
```

Scan the QR code with Expo Go, or press `w` for web preview.

---

## Licence

MIT
