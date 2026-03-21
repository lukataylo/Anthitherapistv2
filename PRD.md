# Reframe — Product Requirements Document

## Overview

**App name:** Reframe  
**Package / internal name:** Antitherapist  
**Platform:** iOS and Android (React Native via Expo)

Reframe is a mobile app that lowers the friction of Cognitive Behavioural Therapy (CBT) self-practice. It uses AI-powered word-level annotation to help users identify cognitive distortions in their own thoughts, then engages them in five gamified mini-games that build the skills needed to reframe those thoughts. Daily habit mechanics (streak tracking, score chasing) encourage the user to return every day.

---

## Core Value Proposition

Traditional CBT homework is high-effort and low-engagement. Reframe reduces that friction by:

1. **AI-first capture** — the user types (or speaks) a thought; Claude Sonnet analyses it word-by-word and labels each word's cognitive distortion category in real time.
2. **Annotation-first review** — distorted words appear as coloured tappable chips inline in the thought text, making the distortion landscape immediately visible.
3. **Gamified reframing** — each distorted word opens a mini-game where the user works through the reframe rather than just typing it into a blank field.
4. **Personalised content** — all five games draw on the user's own history, so the vocabulary they practise matches the vocabulary they actually use when distorting.

---

## Target User

Adults who are broadly familiar with CBT concepts (either through therapy, self-help reading, or personal experience) and want a low-friction daily practice tool. The app does not require prior clinical knowledge but does assume the user understands that some thought patterns are more helpful than others.

---

## Branding and Visual Design

| Property | Value |
|---|---|
| Colour palette | Deep blacks (#000, #020810), near-black cards (#1A1A1A), accent colours per distortion category |
| Distortion categories | `belief` (red, #EF4444), `fear` (purple, #8B5CF6), `absolute` (amber, #F59E0B), `self_judgment` (pink, #EC4899) |
| Typography | Inter (400 Regular, 500 Medium, 600 SemiBold, 700 Bold) — loaded from Google Fonts |
| Visual language | Dark glassmorphic: floating pills, frosted-glass blur (BlurView on iOS/Android, CSS backdrop-filter on web), translucent borders, low-opacity geometric patterns |
| Success colour | #00E5A0 / #4ADE80 (teal-green) |
| Feedback haptics | Light, Medium, Heavy, and Success/Error notification patterns via expo-haptics |

---

## Navigation Structure

The app has three tabs managed by Expo Router, rendered inside a custom floating glassmorphic tab bar (a `BlurView`-backed pill that floats over the screen content):

| Tab | Route | Screen |
|---|---|---|
| Reframe | `/` (`app/index.tsx`) | Thought capture + annotated review + GamePanel |
| History | `/history` (`app/history/index.tsx`) | Mini-game carousel + reflection entry feed |
| Discuss | `/discuss` (`app/discuss.tsx`) | Socratic AI coaching chat |

A fourth screen, the History detail view (`/history/[id]`), is a pushed route inside the History tab.

### Tab Bar Details

- Renders as a floating pill with `BlurView` blur at the bottom of every screen.
- Each tab item has a press-bounce animation (icon squishes to 0.82×) and a spring-in active dot beneath the icon.
- An orange dot appears on the Reframe tab icon when `currentStreak > 0 AND !reflectedToday`, nudging the user to maintain their streak.

---

## Features

### 1. Thought Capture (Home / Reframe tab)

- **Text input** — multiline, 400 character cap, dark card background. Placeholder: *"Capture a thought, a belief, or a prediction..."*
- **Voice capture** — mic button using `expo-speech-recognition` (requires custom Expo dev client). Button pulses red while listening; transcribed text is appended to any existing thought text. Gracefully hidden in standard Expo Go.
- **Send button** — colour and opacity animate from dark/disabled (#3A3A3A, 35% opacity) to bright white (100% opacity) as the user types, providing an immediate affordance signal.
- **Streak nudge** — an orange text line fades in below the input card when `currentStreak > 0 AND !reflectedToday`. Cycles through three message variants based on streak modulo to avoid repetition.
- **Loading state** — when the API request is in-flight, the entire input UI is replaced by a centred `ThinkingAnimation` component.

### 2. AI Word-Level Annotation

- On API success, the thought transitions (cross-fade) to the **annotated review** layer.
- `AnnotatedThought` renders the thought as a single `<Text>` parent with nested `<Text>` spans.
- Distorted words become coloured tappable chips; the chip background and foreground colour are keyed to the word's distortion category.
- After reframing, the chip turns green and displays the chosen reframe word in place.
- An "All reframed" banner with a sparkle icon appears when every significant word is complete.

**Distortion categories and their colours:**

| Category | Background | Foreground |
|---|---|---|
| `belief` | `beliefDim` | `#EF4444` (red) |
| `fear` | `fearDim` | `#8B5CF6` (purple) |
| `absolute` | `absoluteDim` | `#F59E0B` (amber) |
| `self_judgment` | `self_judgmentDim` | `#EC4899` (pink) |

### 3. GamePanel — Per-Word Reframing

When the user taps a distorted word chip, the `GamePanel` modal slides up from the bottom of the screen.

- **Word display** — the distorted word is shown in large uppercase with its category badge.
- **Timer bar** — a 45-second countdown is displayed as:
  - A colour-animated progress bar at the top of the panel (green → amber → red).
  - A numeric countdown in the header.
  - On timeout, the word is automatically skipped.
- **Four action buttons:**
  - **REFRAME** — opens a free-text input. The user's entry is evaluated using fuzzy matching (Levenshtein distance ≤ 25% of word length) against the AI-provided reframes list. Absolute words and the original word itself are blocked.
  - **HINT** — reveals the AI-generated hint ("Try something like: 'sometimes'").
  - **50/50** — reveals two options (one correct, one distorted decoy) to choose from.
  - **SKIP** — marks the word as handled without reframing; the original word is stored so the progress counter still advances.
- **Wrong attempt log** — each failed reframe is appended inline with strikethrough styling and the AI's one-sentence explainer for why that word is a distortion.
- **Success animation** — on correct answer, a `LetterTumble` celebration animation plays (letters scatter from the word), then `markReframed()` is called in GameContext.

### 4. Streak Tracking

Implemented in `StreakContext` (AsyncStorage persistence, key `reframe_streak_v1`).

- **Daily streak** — increments once per calendar day the user submits a thought. Idempotent within a day. Resets to zero if a day is missed.
- **Longest streak** — tracks the all-time best; never decreases.
- **`reflectedToday`** — derived boolean, used by CaptureScreen and TabBar to conditionally show nudge UI.
- **`StreakBadge`** — flame icon + numeric counter pill in the top-left of the capture screen. Dims to 50% opacity when not reflected today; springs to 1.4× scale for 1.5 seconds after a new reflection is recorded.

### 5. History Tab

- **Stats header** — three cards showing: current streak, best streak, and total reflections count.
- **Game carousel** — horizontally scrollable snap-scrolling row of five game launcher cards. Each card has a distinct colour palette, decorative geometric background pattern, icon, name, and category label. Position dots below the carousel indicate scroll position.
- **Entry feed** — chronological list (newest first) of past reflection entries. Each card shows:
  - The original thought text (truncated to 3 lines).
  - A relative timestamp ("just now", "5m ago", "3h ago", "yesterday", "4d ago").
  - A `ProgressBadge` showing the reframe fraction (e.g. "2/5") or a "Complete" pill.
- **Tap** — navigates to the History detail screen (`/history/[id]`) for that entry.
- **Long-press** — prompts deletion via an Alert.

### 6. History Detail Screen (`/history/[id]`)

A full-screen detail view for a single past session. Sections:

1. **Annotated thought** — the original text with distorted words highlighted and chosen reframes shown beneath as green replacements.
2. **What changed** — per-word breakdown card for each reframed word: original, category badge, chosen reframe, and AI explainer.
3. **Insight** — an LLM-generated paragraph (from `POST /api/reflect`) fetched fresh on mount. Rendered with a loading skeleton while fetching and a graceful error state.
4. **Continue session** button — only visible for incomplete entries; loads the session into GameContext and navigates to the Reframe tab.

### 7. Discuss Tab — Socratic Coaching

A chat-style interface where Claude acts as a Socratic coach.

- **Opening message** — the API (`POST /api/discuss`) generates a welcome message on mount using a seed `"Hello, I'd like to talk through something on my mind."` prompt.
- **Chat UI** — user messages are right-aligned; Claude messages are left-aligned. Both use rounded bubble styling matching the dark glassmorphic aesthetic.
- **Typing indicator** — three animated dots pulse in sequence while waiting for a response.
- **Clear button** — resets the conversation; conversation state is not persisted across sessions by design.
- **Tone constraint** — Claude is instructed to ask empathetic Socratic questions only, never to label or diagnose a cognitive distortion.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 |
| Navigation | Expo Router 6 (file-based, tab + push routes) |
| UI primitives | React Native core (View, Text, Pressable, ScrollView, TextInput, Modal) |
| Animation | React Native Reanimated 4.1 (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`), React Native Animated (in RocketGame, ThoughtCheckGame, RewordGame for non-worklet paths) |
| Gestures | `react-native-gesture-handler` (Gesture.Pan worklet in SortTowerGame) |
| State management | React Context (GameContext, HistoryContext, StreakContext) + React Query for server state |
| Persistence | AsyncStorage (`@react-native-async-storage/async-storage`) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Blur | `expo-blur` (`BlurView`) |
| Haptics | `expo-haptics` |
| Voice input | `expo-speech-recognition` (custom dev client only) |
| Fonts | `@expo-google-fonts/inter` |
| Backend | Express 5 (`@workspace/api-server`) |
| AI | Anthropic `claude-sonnet-4-6` via `@workspace/integrations-anthropic-ai` |
| API contract | Zod schemas (`@workspace/api-zod`) |
| API client | `@workspace/api-client-react` (React Query hooks wrapping fetch) |
| Build / monorepo | pnpm workspaces |

---

## Data Flow Summary

```
User types thought
  → POST /api/reframe
    → Claude analyses each word, returns WordAnalysis[]
      → HomeScreen maps response → addEntry() in HistoryContext
      → recordReflection() in StreakContext
      → setWords() in GameContext (transitions screen to "cloud")
        → CaptureScreen renders AnnotatedThought
          → user taps distorted word chip
            → openGame(idx) in GameContext (transitions to "game")
              → GamePanel modal opens
                → user reframes, hints, 50/50s, or skips
                  → markReframed() / skipWord() in GameContext
                    → useEffect in HomeScreen syncs reframedWords → updateEntry() in HistoryContext
```

---

## Known In-Progress Work

- **Game done/summary screens** (task #21) — end-of-game summary views are not yet implemented.
- **Sort Tower category-colored floors + legend** (task #23) — floors currently cycle through a fixed colour palette; the plan is to colour floors by the word's distortion category and add a legend.
- **Thought Check bonus phase** (task #24) — a bonus round at the end of Thought Check is pending implementation.
