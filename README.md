# Cognitive Reframing

A gamified mobile app that helps users overcome distorted thinking patterns using Cognitive Behavioural Therapy (CBT) techniques, powered by Claude AI.

---

## What It Does

Users type or dictate a raw thought — anything from "I always fail at everything" to "nobody ever cares about me". The app sends that thought to an AI pipeline that identifies every word carrying cognitive distortion weight, explains why each one is distorted, and suggests healthier alternatives. The user then works through those words using a set of mini-games, progressively reframing their thinking in a satisfying, low-pressure way.

The core loop is:

1. **Capture** — write a thought in the text field
2. **Annotate** — Claude labels each distorted word by category (belief, fear, absolute, self-judgment)
3. **Reframe** — tap a highlighted word to open the game panel and replace it with a healthier word
4. **Practice** — revisit past thoughts through five reinforcement mini-games in the History tab

---

## The Psychology Behind It

Cognitive Behavioural Therapy (CBT) holds that the way we interpret events — not the events themselves — shapes how we feel and behave. When our internal language is dominated by cognitive distortions, our emotional responses become disproportionate to reality.

This app targets four distortion categories:

| Category | Example words | What it signals |
|---|---|---|
| **Absolute** | always, never, everyone, nothing | Black-and-white thinking that removes nuance |
| **Belief** | worthless, useless, failure, broken | Fixed negative core beliefs about the self |
| **Fear** | terrified, dreading, anxious, panic | Fear-driven appraisals of threat |
| **Self-judgment** | pathetic, loser, I can't do anything right | Harsh internal criticism of one's whole self |

By naming these words, understanding why they are distorted, and actively replacing them, users develop metacognitive awareness — the ability to notice and interrupt unhelpful thought patterns before they escalate.

---

## Architecture

```
User (React Native / Expo mobile app)
        │
        │ POST /api/reframe { thought: "..." }
        ▼
Express API Server (Node.js / TypeScript)
        │
        │ Anthropic Messages API
        ▼
Claude (claude-sonnet-4-6)
  – Analyses thought word by word
  – Returns structured JSON: category, reframes, hints, 50/50 pairs, explainer
        │
        ▼
Express validates JSON with Zod, returns to mobile
        │
        ▼
Mobile maps response into GameContext state
  – Screen transitions: capture → cloud → game
  – Words stored in HistoryContext (AsyncStorage)
  – Daily reflections tracked in StreakContext (AsyncStorage)
```

---

## Monorepo Structure

```
workspace/
├── artifacts/
│   ├── mobile/              # Expo React Native app
│   │   ├── app/             # Expo Router file-based screens
│   │   │   ├── _layout.tsx  # Root layout, providers, navigation
│   │   │   ├── index.tsx    # Home / Reframe tab
│   │   │   └── history.tsx  # History & Games tab
│   │   ├── components/      # All UI components
│   │   ├── context/         # React context providers (state management)
│   │   └── constants/       # Shared design tokens (colors)
│   │
│   └── api-server/          # Express API
│       └── src/
│           ├── index.ts     # Server entry point
│           ├── app.ts       # Express app setup
│           ├── routes/
│           │   ├── index.ts          # Route aggregator
│           │   ├── health.ts         # GET /api/healthz
│           │   └── reframe/index.ts  # POST /api/reframe (AI pipeline)
│           └── lib/
│               └── logger.ts         # Pino structured logger
│
├── packages/
│   ├── api-zod/             # Shared Zod schemas (HealthCheckResponse, etc.)
│   └── api-client-react/    # React Query hooks generated from API types
│
└── integrations/
    └── anthropic-ai/        # Replit-managed Anthropic API client
```

---

## Key Components

### Mobile

| Component | Role |
|---|---|
| `CaptureScreen` | Dual-layer UI — input layer for writing thoughts, review layer for annotated words |
| `AnnotatedThought` | Renders the thought as inline text with colour-coded tappable distortion chips |
| `GamePanel` | Bottom-sheet modal where users reframe a single word (timer, REFRAME/HINT/50-50/SKIP actions) |
| `LetterTumble` | Full-screen celebration animation when a word is successfully reframed |
| `ThinkingAnimation` | Orbital loading animation shown while the AI analyses the thought |
| `TabBar` | Custom glassmorphic tab bar with streak badge indicator |
| `GameCarousel` | Horizontal scroll carousel of the five mini-game entry cards |
| `SortTowerGame` | Swipe-to-sort card game: classify words as negative or positive |
| `RocketGame` | Multiple-choice quiz: choose the better reframe before the timer runs out |
| `ThoughtCheckGame` | Binary classification game: is this thought distorted or healthy? |
| `SailGame` | Word-level binary classification: is the highlighted word distorted? |

### Context Providers

| Provider | Persisted | Purpose |
|---|---|---|
| `GameContext` | No (session only) | Active thought, word analysis results, screen state, reframed words map |
| `HistoryContext` | Yes (AsyncStorage) | Up to 100 past reflection entries with their reframed words |
| `StreakContext` | Yes (AsyncStorage) | Daily reflection streak — current count, longest count, reflected-today flag |

### API

| Route | Method | Purpose |
|---|---|---|
| `/api/healthz` | GET | Liveness check — returns `{ status: "ok" }` |
| `/api/reframe` | POST | Analyses a thought with Claude AI, returns word-by-word distortion data |

---

## Setup & Running Locally

### Prerequisites

- Node.js 20+
- pnpm 9+
- Expo Go app (for device testing) or an iOS/Android simulator
- Replit workspace with the Anthropic AI integration configured

### Install Dependencies

```bash
pnpm install
```

### Start the API Server

```bash
pnpm --filter api-server dev
```

The server reads `PORT` from the environment (set automatically in the Replit workspace).

### Start the Mobile App

```bash
pnpm --filter mobile start
```

Set `EXPO_PUBLIC_DOMAIN` to the domain where the API server is reachable. In the Replit workspace this is configured automatically.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | API server | Port the Express server binds to |
| `NODE_ENV` | API server | `production` switches logger to JSON output |
| `LOG_LEVEL` | API server | Pino log level (default: `info`) |
| `EXPO_PUBLIC_DOMAIN` | Mobile app | Base domain for API requests |

---

## Data Flow: A Single Thought

1. User types "I always fail at everything" and taps Send
2. `HomeScreen` calls `mutation.mutate({ data: { thought } })`
3. `useReframeThought` (React Query) sends `POST /api/reframe` to the Express server
4. Express validates the request body, then calls Claude with the full CBT system prompt
5. Claude returns a JSON array of word objects — each with `category`, `reframes`, `hint`, `fiftyFifty`, `explainer`
6. Express validates the JSON with Zod and sends it to the mobile app
7. `HomeScreen.onSuccess` maps the response into `WordAnalysis[]` and calls:
   - `addEntry()` — saves the thought to history
   - `recordReflection()` — updates the streak
   - `setWords()` — pushes the app into the "cloud" (annotation review) screen
8. User taps a highlighted word → `openGame(wordIdx)` → `GamePanel` appears
9. User submits a reframe → `markReframed(wordIdx, word)` → word turns green in `AnnotatedThought`
10. `updateEntry()` syncs the reframed words map back to `HistoryContext`
