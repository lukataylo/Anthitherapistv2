# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Cognitive Reframing ("Reframe") — a gamified Expo mobile app that helps users reframe negative/distorted thinking through an interactive word-cloud game.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (schema not yet used — app is stateless)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with Expo Router
- **AI**: Anthropic Claude via Replit AI Integrations (`@workspace/integrations-anthropic-ai`)

## App Features

### Cognitive Reframing (Mobile App)
1. **Capture Screen** — Dark minimal UI. User types a negative thought, hits the send button. On submit, the screen cross-fades to the inline annotation view (no separate cloud screen).
2. **Inline Annotation View** — The original thought renders in-place with highlighted word chips. Distortion words are colour-coded spans (belief=red, fear=purple, absolute=orange, self_judgment=pink). Reframed words swap to green. A "pencil" button returns to capture. Progress counter "N of M reframed" shown top-right. Tapping a distortion word opens the Game Panel.
3. **Reframe Game Panel** — Modal overlay: distorted word shown large, 45s countdown timer, lifeline buttons (REFRAME / HINT / 50/50 / SKIP). Correct reframe triggers a letter-tumble celebration animation.
4. **Sort Tower Game** — Swipe-based word sorting game on the History screen. Builds an architectural tower (white/grey floors with arched windows + spire) on a black background. Streak multiplier up to 4×.

### AI Backend (`/api/reframe`)
- POST endpoint that takes a thought string and returns word-by-word cognitive analysis
- Claude `claude-sonnet-4-6` classifies each word into: neutral, belief, fear, absolute, self_judgment
- For significant words, returns: reframes[], hint, fiftyFifty[], explainer

## Colour System

| Category | Colour |
|---|---|
| Neutral | #2A2A3E (dim grey) |
| Belief | #FF5B5B (coral/red) |
| Fear | #9B5CF6 (purple) |
| Absolute | #F97316 (orange) |
| Self-judgment | #EC4899 (pink) |
| Reframed | #00E5A0 (green) |

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (POST /api/reframe)
│   └── mobile/             # Expo React Native app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations/
│       └── anthropic-ai/   # Replit-managed Anthropic AI client
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Key Files

### Mobile App
- `artifacts/mobile/app/_layout.tsx` — Root layout with providers (QueryClient, GameProvider, SafeArea)
- `artifacts/mobile/app/index.tsx` — Main screen orchestrator (routes between Capture/Cloud views)
- `artifacts/mobile/context/GameContext.tsx` — Global game state (words, reframedWords, screen, activeWordIndex)
- `artifacts/mobile/components/CaptureScreen.tsx` — Thought input UI
- `artifacts/mobile/components/CloudScreen.tsx` — Word pill cloud + progress counter
- `artifacts/mobile/components/WordPill.tsx` — Animated colour-coded word pill
- `artifacts/mobile/components/GamePanel.tsx` — Full-screen reframe game overlay
- `artifacts/mobile/components/LetterTumble.tsx` — Letter scatter/converge celebration animation
- `artifacts/mobile/components/ThinkingAnimation.tsx` — Loading animation while Claude processes
- `artifacts/mobile/constants/colors.ts` — Full dark-theme colour system

### API Server
- `artifacts/api-server/src/routes/reframe/index.ts` — POST /api/reframe Claude integration
- `lib/api-spec/openapi.yaml` — OpenAPI spec with ReframeRequest/ReframeResponse schemas

## Environment Variables

- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Auto-set by Replit AI Integrations
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `EXPO_PUBLIC_DOMAIN` — Set at runtime from `$REPLIT_DEV_DOMAIN`

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/mobile run dev` — Start Expo dev server
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — Push Drizzle schema to database
