# Reframe — Turn Your Negative Thoughts Into a Game

> **CBT therapy shouldn't feel like homework.**
> Reframe uses Claude AI to analyse your thoughts word by word, colour-code every cognitive distortion, and turn your own thinking patterns into five interactive mini-games — so you actually *want* to practise the skill.

---

## The Problem

Cognitive Behavioural Therapy is one of the most evidence-backed treatments for anxiety, depression, and negative self-talk. The technique is simple: catch a distorted thought, name the distortion, reframe it.

The practice is brutal. Paper diaries collect dust. Plain-text apps offer no feedback. People quit before the skill sticks.

**Reframe closes that loop** — with AI precision, word-level annotation, and games that run on your own history.

---

## Why It Works

- **Word-level precision, not thought-level vagueness.** Instead of asking "was this thought helpful?", Reframe asks "which specific word is doing the distorting?" That precision is what actually trains the skill.
- **Your data powers your training.** The mini-games pull from your own captured thoughts — you practise on *your* patterns, not made-up examples.
- **Instant, visual feedback.** Every word in your thought is colour-coded by distortion type the moment you submit it. No waiting. No ambiguity.

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
git clone https://github.com/lukataylo/Anthitherapistv2.git
cd Anthitherapistv2
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

## Cognitive Distortion Reference

| Category | Description | Example |
|---|---|---|
| `catastrophizing` | Assuming the worst possible outcome | "This will ruin everything" |
| `overgeneralizing` | Drawing sweeping conclusions from one event | "I always fail" |
| `mind-reading` | Assuming you know what others think | "They must think I'm stupid" |
| `fortune-telling` | Predicting negative outcomes as fact | "I'll never get better at this" |
| `emotional-reasoning` | Treating feelings as facts | "I feel worthless, so I am" |
| `labeling` | Applying a global negative label to self or others | "I'm a complete failure" |
| `should-statements` | Inflexible rules about how things must be | "I should be able to handle this" |
| `personalization` | Taking excessive blame for external events | "It's all my fault" |
| `magnification` | Exaggerating the importance of a negative event | "This is the worst thing that's happened" |
| `minimization` | Downplaying positives or strengths | "Anyone could have done that" |
| `neutral` | Not distorted — used as foil in games | — |

---

## Licence

MIT
