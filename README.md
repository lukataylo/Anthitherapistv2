# Antitherapist — AI-Powered CBT in Five Mini-Games

> **Your thoughts, word by word. Your patterns, turned into play.**
> Antitherapist uses Claude AI to identify cognitive distortions at the word level, colour-code them in real time, and transform your own thinking patterns into five personalised mini-games — so you actually *want* to practise CBT.

---

## The Problem

Cognitive Behavioural Therapy is one of the most evidence-backed treatments for anxiety, depression, and negative self-talk. The technique is simple: catch a distorted thought, name the distortion, reframe it.

The practice is brutal. Paper diaries collect dust. Plain-text apps offer no feedback. People quit before the skill sticks.

**Antitherapist closes that loop** — with AI precision, word-level annotation, and games that run on your own history.

---

## Why It Works

- **Word-level precision, not thought-level vagueness.** Instead of asking "was this thought helpful?", Antitherapist asks "which specific word is doing the distorting?" That precision is what actually trains the skill.
- **Your data powers your training.** The mini-games pull from your own captured thoughts — you practise on *your* patterns, not made-up examples.
- **Instant, visual feedback.** Every word in your thought is colour-coded by distortion type the moment you submit it. No waiting. No ambiguity.

---

## Why Not Just a Chatbot?

Apps like Woebot and Youper offer AI conversation — but conversation alone doesn't build the skill. Antitherapist is different in two concrete ways:

1. **Word-level precision.** Claude doesn't label your *thought* as distorted — it labels each *word*, individually. You see exactly which part of the sentence is doing the damage. Chatbots work at the paragraph level; Antitherapist works at the word level.
2. **Personalised game data.** The five mini-games draw exclusively from your own captured history. Every round you play uses words you personally wrote, in distortions you personally produced. Chatbots give you generic exercises; Antitherapist gives you a mirror.

The result is a tighter feedback loop: annotate → reframe → play games built from your own patterns → improve.

---

## Try This First — 90-Second Demo Flow

Follow these five steps to see the core experience:

1. **Speak tab → type a negative thought.** Try something like: *"I always mess everything up and everyone can tell."* Hit send.
2. **Watch the AI annotate.** In a few seconds, distorted words light up in colour: red chips for beliefs, purple for fears, amber for absolutes, pink for self-judgements. Neutral words stay plain.
3. **Tap a coloured word.** The GamePanel slides up. Hit **HINT** to see what Claude suggests, then type a reframe or use **50/50** to choose between two options.
4. **Shape tab → open Sort Tower.** Swipe word cards left (distorted) or right (healthy) — the words are from *your* thought. Watch the tower grow with each correct swipe.
5. **Open Thought Check.** Read a thought and decide: DISTORTED or HEALTHY? If you get it wrong, the distorted words are highlighted with an explanation — a teaching moment, not just a score.

---

## Key Features

| Feature | What it does |
|---|---|
| **AI thought capture** | Claude classifies every word as a named cognitive distortion or neutral — rendered inline with colour-coded annotation |
| **Word reframing** | Tap any distorted word for AI-generated healthier alternatives; choose one to log your reframe |
| **History feed** | Full chronological log of thoughts with a per-entry progress badge |
| **Entry insights** | Tap any entry for a word-by-word breakdown and an LLM-generated narrative insight |
| **Streak tracking** | Daily-use streak, best streak, and total-reflections counters |
| **Five mini-games** | Carousel of CBT games that draw from your own captured history |
| **Socratic Discuss mode** | Chat with Claude in a Socratic coaching mode — questions only, no labels, no diagnoses |

---

## Navigation

The app has three tabs:

| Tab | What it does |
|---|---|
| **Speak** | Capture a thought, get word-level AI annotation, and reframe distorted words |
| **Shape** | Browse your reflection history and launch the five CBT mini-games |
| **Own** | Work through a deck of belief flashcards built from your own history |

Discuss (Socratic coaching chat with Claude) is accessible from within the app but does not appear in the tab bar.

---

## The 5 Mini-Games

Each game launches full-screen from the Shape tab and draws rounds from your own captured thoughts.

| # | Game | Skill trained |
|---|---|---|
| 1 | **Sort Tower** — Swipe cards left or right to sort distorted vs. healthy words into a growing stack | Rapid automatic categorisation |
| 2 | **Rocket Reframe** — A word is blanked in your thought; pick the best replacement to fire the rocket | Active word substitution |
| 3 | **Thought Check** — Is this whole thought distorted? If so, which category? | Whole-thought awareness |
| 4 | **Mind Voyage** — One word is highlighted in your thought; tap ERROR or VALID to sail across a moonlit sea | Word-level precision |
| 5 | **Reword** — A distorted word sits at the root of a branching tree; choose the branch that best replaces it | Language and vocabulary |

---

## Discuss Mode

Accessible from within the app, **Discuss** opens a Socratic coaching session with Claude. The AI is prompted to:

- Ask only one question at a time
- Never name or diagnose a cognitive distortion directly
- Guide you to your own realisations through self-reflection
- Use curious, empathetic language throughout

The session starts immediately with a Claude-generated opening question. No setup required.

---

## Cognitive Distortion Categories

The app uses four distortion categories, each with a distinct colour, to annotate words in your thoughts:

| Category | Colour | Example words | CBT concepts covered |
|---|---|---|---|
| `belief` | 🔴 Red `#FF5B5B` | "worthless", "broken", "unlovable" | Core beliefs, labelling, personalisation |
| `fear` | 🟣 Purple `#9B5CF6` | "terrified", "catastrophe", "doomed" | Catastrophising, fortune-telling, threat overestimation |
| `absolute` | 🟠 Orange `#F97316` | "always", "never", "everyone", "impossible" | Overgeneralising, all-or-nothing thinking, should-statements |
| `self_judgment` | 🩷 Pink `#EC4899` | "stupid", "pathetic", "failure", "weak" | Negative self-talk, self-labelling, harsh self-criticism |

Words not in any category are rendered as plain text (`neutral`).

---

## How We Built It — AI Tools & Workflow

This project was built using a staged multi-tool AI workflow, with each tool chosen for where it adds the most leverage:

| Stage | Tool | Why |
|---|---|---|
| **Frontend ideation** | Google Gemini AI Studio | Multimodal input made it easy to reason about UI layouts, colour systems, and component design using screenshots and sketches alongside text prompts. Its strong frontend instincts accelerated early design decisions. |
| **Backend & architecture** | Claude (via Claude.ai) + Cursor | Claude's reasoning depth was well-suited to API design, CBT logic modelling, and system architecture. Cursor handled in-editor code generation and refactoring across the codebase during this phase. |
| **Collaboration & shipping** | Replit | Once the project was in a stable state, we imported it from GitHub into Replit. Replit's multiplayer environment let the team work on the same codebase simultaneously in real time, and its integrated AI agent accelerated feature delivery significantly. |

The handoff — from Gemini for visual thinking → Claude/Cursor for depth → Replit for collaboration and speed — let each tool do what it does best.

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
| AI | Claude Sonnet via Replit AI Integrations |
| API contracts | OpenAPI 3.0 (orval codegen → React Query hooks + Zod) |
| Monorepo | pnpm workspaces |

---

## Getting Started

**Prerequisites:** Node.js 20+, pnpm 10+, Expo Go on your phone, a Replit account (for the AI proxy)

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
