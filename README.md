# Reframe — CBT Thought Journal & Mini-Games

**Reframe** is a gamified mobile app for Cognitive Behavioural Therapy (CBT). Users type a negative thought, Claude AI classifies every word by cognitive distortion type with inline annotation, and a suite of five mini-games helps them practise reframing distorted thinking — one word at a time.

---

## Background & Motivation

Cognitive Behavioural Therapy is one of the most evidence-backed psychological treatments for anxiety, depression, and negative self-talk. The core CBT technique is **thought monitoring**: catching a distorted thought, naming the distortion, and consciously reframing it.

The problem is that this process is usually a chore — a paper diary or a plain-text app with no feedback loop. Reframe turns that loop into something people actually want to open.

The approach is inspired by two ideas:

1. **Spaced repetition through play.** The same distorted thoughts that live in a user's history power the mini-games. You're not practising on made-up examples — you're practising on *your own thinking patterns*.
2. **Word-level precision over thought-level vagueness.** Traditional apps ask "was this thought helpful or unhelpful?" Reframe asks "which specific word is doing the distorting?" That precision is what actually trains the skill.

---

## Features at a Glance

| Feature | Description |
|---|---|
| **AI-powered thought capture** | Claude classifies every word in a typed thought as a named cognitive distortion or neutral — rendered as inline colour-coded annotation |
| **Word reframing** | Tap any distorted word to unlock a set of AI-generated healthier alternatives; choose one to log as your reframe |
| **History feed** | Full chronological log of captured thoughts with a per-entry progress badge showing how many words have been reframed |
| **History detail view** | Tap any entry to see the full annotated thought, a word-by-word breakdown, and an LLM-generated narrative insight paragraph |
| **Streak tracking** | Daily-use streak with best-streak and total-reflections counters |
| **Five mini-games** | Carousel of interactive CBT games that draw from the user's own history |
| **Socratic Discuss mode** | Chat with Claude in a Socratic coaching mode — it asks questions that guide you to recognise your own patterns, never labels or diagnoses |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Expo Mobile App                     │
│  (React Native · Expo Router · TypeScript)           │
│                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Reframe   │  │   History    │  │   Discuss   │ │
│  │    Tab     │  │     Tab      │  │     Tab     │ │
│  └────────────┘  └──────────────┘  └─────────────┘ │
│       ↓                 ↓                 ↓         │
│  ┌─────────────────────────────────────────────┐   │
│  │         React Context Providers              │   │
│  │   HistoryContext · StreakContext · GameContext│   │
│  └────────────────────┬────────────────────────┘   │
│                       │ React Query                 │
└───────────────────────┼─────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────┼─────────────────────────────┐
│              Express API Server                      │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────┐ │
│  │ /reframe │  │ /reflect  │  │    /discuss       │ │
│  └────┬─────┘  └─────┬─────┘  └────────┬──────────┘ │
│       └──────────────┴─────────────────┘            │
│                      │ Anthropic SDK                 │
│              Claude Sonnet (via Replit AI)            │
└─────────────────────────────────────────────────────┘
```

### Mobile App (`artifacts/mobile`)

Built with **Expo SDK 54** and **Expo Router** for file-based navigation. Key directories:

```
artifacts/mobile/
├── app/
│   ├── _layout.tsx          # Root shell — providers, fonts, tab bar
│   ├── index.tsx            # Reframe tab (capture screen)
│   ├── history/
│   │   ├── index.tsx        # History feed with game carousel
│   │   └── [id].tsx         # Entry detail — annotation + LLM insight
│   └── discuss.tsx          # Socratic chat screen
├── components/
│   ├── CaptureScreen.tsx    # Thought input + annotated result
│   ├── AnnotatedThought.tsx # Inline colour-coded word annotation
│   ├── GameCarousel.tsx     # Horizontally scrollable game launcher cards
│   ├── GamePanel.tsx        # Shared mini-game modal shell (timer, HUD)
│   ├── QuitButton.tsx       # Shared quit/confirm button for all games
│   ├── SortTowerGame.tsx    # Game 1: Sort Tower
│   ├── RocketGame.tsx       # Game 2: Rocket Reframe
│   ├── ThoughtCheckGame.tsx # Game 3: Thought Check
│   ├── SailGame.tsx         # Game 4: Mind Voyage
│   ├── RewordGame.tsx       # Game 5: Reword
│   ├── TabBar.tsx           # Custom glassmorphic tab bar
│   └── ThinkingAnimation.tsx# Animated AI "thinking" indicator
├── context/
│   ├── GameContext.tsx      # Active session (thought, words, reframes)
│   ├── HistoryContext.tsx   # AsyncStorage-backed entry log
│   └── StreakContext.tsx    # Daily streak + best streak tracking
└── utils/
    └── seedData.ts          # Seeds 9 realistic CBT entries on first launch
```

**State management:** All data is stored locally in `AsyncStorage`. No user accounts, no cloud sync — privacy-first. React Context providers expose the data to components; React Query handles API mutations.

**Fonts:** Inter (400/500/600/700) loaded via `@expo-google-fonts/inter`.

**Styling:** Pure `StyleSheet.create` — no Tailwind, no UI library. Every component is hand-crafted with a dark-first palette (pure black `#000` background, elevated `#171717` cards).

### API Server (`artifacts/api-server`)

A lightweight **Express 5 + TypeScript** server that proxies three AI endpoints:

| Route | Input | Output | Purpose |
|---|---|---|---|
| `POST /api/reframe` | `{ thought: string }` | `{ words: WordAnalysis[] }` | Claude classifies each word by distortion category and generates reframe options |
| `POST /api/reflect` | `{ thought, words, reframedWords }` | `{ insight: string }` | Claude writes a 3–5 sentence narrative insight paragraph for a completed entry |
| `POST /api/discuss` | `{ messages: Message[] }` | `{ reply: string }` | Socratic coaching — Claude asks guiding questions without naming distortions |

All routes validate with **Zod** schemas before hitting the AI. Rate-limited with `express-rate-limit`. AI calls go through the **Replit AI Integrations** proxy (Claude Sonnet) — no separate API key required when running inside Replit.

### Shared Libraries (`lib/`)

| Package | Purpose |
|---|---|
| `@workspace/api-spec` | OpenAPI 3.0 spec (`openapi.yaml`) — single source of truth for all API contracts |
| `@workspace/api-client-react` | Orval-generated React Query hooks from the OpenAPI spec |
| `@workspace/api-zod` | Orval-generated Zod schemas from the OpenAPI spec |
| `@workspace/integrations-anthropic-ai` | Typed Anthropic client configured for the Replit AI proxy |
| `@workspace/db` | Drizzle ORM schema (future persistence layer) |

---

## The Five Mini-Games

Each game is a full-screen modal launched from the **GAMES carousel** on the History tab. All games draw rounds from the user's own captured thoughts, filling in with curated fallback data when history is sparse.

---

### 1. Sort Tower — *Stacking*

**Concept:** A vertical stack of cards appears one at a time. Swipe **right** if the highlighted word is distorted thinking; swipe **left** if it is healthy or neutral. Cards pile up into a tower as you sort them.

**CBT skill:** Training rapid, automatic categorisation of distorted language — the first step in catching negative thoughts in real time.

**Mechanics:**
- Deck built from user history (distorted words) + healthy reframe words
- Swipe gesture with spring-animated card throw
- Stale-closure-safe implementation using `deckRef` / `deckIdxRef` / `streakRef`
- Streak multiplier: 2× at 2 correct in a row, 3× at 3+
- Done screen shows score with "Play Again" / "Close"

---

### 2. Rocket Reframe — *Reframing*

**Concept:** A thought floats in space with one word blanked out. Four candidate words appear as answer tiles. Pick the best reframe to fire the rocket toward the target planet.

**CBT skill:** Active reframing — replacing a distorted word with a healthier alternative from a set of options. Practises the substitution step of CBT thought records.

**Mechanics:**
- Each round pairs a distorted word from history with its AI-generated reframe options
- Wrong answers show an explanation card before moving on
- Rocket animates across an illustrated space scene when correct
- 90-second countdown; score displayed per round with multiplier

---

### 3. Thought Check — *Awareness*

**Concept:** A full sentence (a captured thought) is displayed. Tap **DISTORTED** or **VALID**. If distorted, which category is it?

**CBT skill:** Whole-thought awareness — recognising whether a thought as a whole is cognitive distorted before drilling into specific words. A prerequisite skill for the word-level games.

**Mechanics:**
- Two-phase UI: first classify the thought (distorted/valid), then (if distorted) pick the category from a grid
- Immediate feedback with a colour flash and explanation
- Rounds sourced from history + curated fallback thoughts
- Score accumulates across a 90-second session

---

### 4. Mind Voyage — *Word-Level Awareness*

**Concept:** A thought is displayed with **one word highlighted**. Is that specific word an example of distorted thinking, or is it fine? Tap **× ERROR** or **✓ VALID** to push a sailing ship across a moonlit sea.

**CBT skill:** Word-level precision — identifying exactly *which* word in a sentence is doing the distorting. This mirrors the CBT technique of "thought deconstruction", where the goal is pinpointing the distorted language rather than dismissing the thought wholesale.

**Mechanics:**
- Rounds include both distorted words (from history) and healthy words (false-positive avoidance training)
- Sailboat X position advances `STEP` pixels per correct answer; 11 correct = full crossing
- Illustrated scene: crescent moon achieved by compositing two circles (no SVG library needed)
- Wrong answers show why the highlighted word is or isn't distorted before advancing
- 90-second countdown; progress track below the scene mirrors boat position

---

### 5. Reword — *Language*

**Concept:** A branching tree diagram fills the screen. A distorted word appears at the root. Three branches lead to candidate rewords — choose the one that best replaces it in the original thought. Correct choices reveal new branches with letter-by-letter animation.

**CBT skill:** Language precision — replacing exact distorted words (e.g. "always", "worthless", "everyone") with more accurate, measured alternatives. Focuses on the vocabulary of distortion.

**Mechanics:**
- 14 curated distortion rounds (words like "catastrophic", "pathetic", "doomed") + history-sourced words
- Branching tree diagram renders dynamically with SVG-like View composition
- Letter-by-letter reveal animation at 52 ms stagger on correct branch selection
- Dark purple radial glow background built from `expo-linear-gradient`
- 90-second countdown; streak multiplier up to 3×
- Hint system: tap the lightbulb to reveal which branch is correct (no point penalty)

---

## Discuss Mode

Accessible as a third tab (chat bubble icon), **Discuss** is a Socratic coaching session with Claude. The system prompt instructs Claude to:

- Ask only **one question at a time**
- Never name or diagnose a cognitive distortion directly
- Use curious, empathetic language
- Guide the user to their own realisations through self-reflection

The conversation is session-only (not persisted) and starts with an AI-generated opening question immediately on mount.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo SDK 54, Expo Router 6 |
| Language | TypeScript (strict) |
| UI | React Native, custom StyleSheet |
| Animations | React Native Reanimated 3, Animated API |
| Gestures | react-native-gesture-handler |
| Fonts | Inter (via @expo-google-fonts) |
| Local storage | AsyncStorage |
| Server-side state | React Query (@tanstack/react-query) |
| API server | Express 5 + TypeScript (tsx) |
| AI | Claude Sonnet via Replit AI Integrations (Anthropic SDK) |
| API contracts | OpenAPI 3.0 (orval codegen → React Query hooks + Zod) |
| ORM | Drizzle ORM |
| Monorepo | pnpm workspaces |
| Validation | Zod |
| Logging | Pino + pino-http |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Expo Go app on your phone (iOS or Android)
- A Replit account (for the AI integration proxy)

### Install

```bash
git clone https://github.com/lukataylo/Anthitherapistv2.git
cd Anthitherapistv2
pnpm install
```

### Environment

The API server needs a `PORT` environment variable and the Replit AI integration environment variables. When running inside Replit these are set automatically. For local development:

```bash
# API server
PORT=8080

# Set by Replit workspace — needed for the AI proxy
REPLIT_AI_API_KEY=...
```

### Run

```bash
# Terminal 1 — API server
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Expo mobile app
PORT=18115 pnpm --filter @workspace/mobile run dev
```

Scan the QR code with Expo Go, or press `w` to open the web preview.

---

## Project Structure

```
/
├── artifacts/
│   ├── mobile/          # Expo React Native app
│   └── api-server/      # Express API + Claude proxy
├── lib/
│   ├── api-spec/        # OpenAPI 3.0 specification
│   ├── api-client-react/# Generated React Query hooks
│   ├── api-zod/         # Generated Zod schemas
│   ├── integrations/    # Anthropic client wrapper
│   └── db/              # Drizzle ORM schema
├── scripts/             # Post-merge setup scripts
└── pnpm-workspace.yaml
```

---

## Cognitive Distortion Categories

The app recognises the following categories (Claude-classified, colour-coded in the UI):

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
