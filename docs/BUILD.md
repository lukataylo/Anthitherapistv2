# Build Pipeline & App Distribution

> EAS Build configuration, GitHub Actions CI/CD, test infrastructure,
> and step-by-step deployment guide.

---

## Overview

```
                    ┌─────────────────┐
                    │  GitHub Push /   │
                    │  Pull Request    │
                    └────────┬────────┘
                             │
                ┌────────────▼────────────┐
                │    CI Pipeline          │
                │  (.github/workflows/    │
                │   ci.yml)               │
                │                         │
                │  1. pnpm install        │
                │  2. prettier --check    │
                │  3. tsc --noEmit        │
                │  4. vitest run          │
                └────────────┬────────────┘
                             │ pass
                ┌────────────▼────────────┐
                │  EAS Build Pipeline     │
                │  (.github/workflows/    │
                │   eas-build.yml)        │
                │                         │
                │  1. Run tests (gate)    │
                │  2. eas build           │
                │     --profile preview   │
                └────────────┬────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Expo EAS Cloud             │
              │                             │
              │  ┌───────┐    ┌───────┐     │
              │  │  iOS  │    │Android│     │
              │  │ build │    │ build │     │
              │  └───┬───┘    └───┬───┘     │
              └──────┼────────────┼─────────┘
                     │            │
              ┌──────▼────────────▼─────────┐
              │  Distribution               │
              │                             │
              │  preview → TestFlight /     │
              │            internal track   │
              │  production → App Store /   │
              │               Play Store    │
              └─────────────────────────────┘
```

---

## File Map

| File | Purpose |
|------|---------|
| `eas.json` | EAS Build profiles (development, preview, production) |
| `.github/workflows/ci.yml` | CI pipeline: format, typecheck, test |
| `.github/workflows/eas-build.yml` | EAS Build pipeline: test gate + cloud build |
| `.env.example` | All environment variables documented |
| `artifacts/api-server/vitest.config.ts` | Vitest configuration for API server tests |
| `artifacts/api-server/src/__tests__/auth.test.ts` | Auth crypto helper tests (14 tests) |
| `artifacts/mobile/app.json` | Expo config with OTA updates + runtimeVersion |

---

## First-Time Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log into Expo

```bash
eas login
```

### 3. Initialize the EAS project

```bash
cd artifacts/mobile
eas init
```

This creates a project on expo.dev and outputs a **project ID**. Copy it.

### 4. Update app.json with the project ID

Replace `YOUR_PROJECT_ID` in `artifacts/mobile/app.json`:

```json
"updates": {
  "url": "https://u.expo.dev/<YOUR_ACTUAL_PROJECT_ID>"
}
```

### 5. Install expo-updates

```bash
cd artifacts/mobile
npx expo install expo-updates
```

### 6. Set up GitHub secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value | How to get it |
|--------|-------|---------------|
| `EXPO_TOKEN` | Robot access token | [expo.dev/settings/access-tokens](https://expo.dev/accounts) → Create token |

### 7. Set EAS environment secrets

```bash
# Set the API domain for builds (used by the mobile app to reach the API)
eas secret:create --name EXPO_PUBLIC_DOMAIN --value "your-api.replit.app" --scope project
```

---

## Build Profiles

Defined in `eas.json`:

| Profile | Use Case | Distribution | Auto-increment | Channel |
|---------|----------|-------------|----------------|---------|
| `development` | Local testing with dev client | Internal (simulator) | No | `development` |
| `preview` | Team testing, stakeholder demos | Internal (TestFlight / internal track) | No | `preview` |
| `production` | App Store / Play Store release | Store | Yes (remote) | `production` |

### Run a build locally

```bash
cd artifacts/mobile

# Development (iOS simulator)
eas build --profile development --platform ios

# Preview (internal distribution)
eas build --profile preview --platform all

# Production (store submission)
eas build --profile production --platform all
```

### Submit to stores

```bash
# iOS — requires Apple Developer account credentials (configured via eas credentials)
eas submit --profile production --platform ios

# Android — requires Google Play service account key
eas submit --profile production --platform android
```

---

## CI Pipeline

**File:** `.github/workflows/ci.yml`
**Triggers:** Every push and PR to `main`

| Step | Command | What it checks |
|------|---------|---------------|
| Format | `pnpm format:check` | Prettier formatting on all TS/TSX files |
| Typecheck | `pnpm typecheck` | TypeScript strict mode across all workspaces |
| Test | `pnpm test` | Vitest suites (currently: auth crypto helpers) |

**Concurrency:** Cancels in-progress runs for the same branch to save minutes.

---

## EAS Build Pipeline

**File:** `.github/workflows/eas-build.yml`
**Triggers:**
- Push to `main` → automatic preview build (both platforms)
- Manual dispatch → choose profile and platform

**Flow:**
1. **Pre-build checks** — runs tests as a gate (don't waste EAS minutes on broken code)
2. **EAS Build** — submits build to Expo's cloud infrastructure
3. **Artifacts** — available on expo.dev dashboard

The EAS build step runs from the `artifacts/mobile` directory where `eas.json` is accessible via the monorepo root.

---

## Test Infrastructure

### Configuration

**File:** `artifacts/api-server/vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      JWT_SECRET: "test-secret-key-do-not-use-in-production",
    },
  },
});
```

The `JWT_SECRET` env var is set deterministically so token tests produce reproducible results.

### Running tests

```bash
# Run all tests once
pnpm test

# Run API server tests only
pnpm --filter @workspace/api-server test

# Watch mode (re-runs on file changes)
pnpm --filter @workspace/api-server test:watch
```

### Current test coverage

**`src/__tests__/auth.test.ts`** — 14 tests covering:

| Category | Tests | What's verified |
|----------|-------|----------------|
| Password hashing | 5 | Correct verify, wrong password reject, unique salts, storage format, unicode |
| JWT tokens | 9 | Round-trip, payload fields, 3-part format, tampered sig, tampered payload, expiry, near-expiry, malformed strings, wrong secret |

### Adding new tests

Create files matching `src/__tests__/*.test.ts` in the api-server workspace. Vitest discovers them automatically.

**Testing pattern for pure functions (no mocking):**
```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../utils/myModule";

describe("myFunction", () => {
  it("does the expected thing", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

**Testing pattern for routes (requires DB mock):**
```typescript
import { describe, it, expect, vi } from "vitest";
// Mock @workspace/db before importing app
vi.mock("@workspace/db", () => ({ /* mock db chains */ }));
import request from "supertest";
import app from "../app";

describe("POST /api/my-route", () => {
  it("returns 400 on invalid input", async () => {
    const res = await request(app).post("/api/my-route").send({});
    expect(res.status).toBe(400);
  });
});
```

Route-level tests require `supertest` (`pnpm add -D supertest @types/supertest --filter @workspace/api-server`) and mocking the drizzle `db` object. For integration tests with a real database, set `DATABASE_URL` to a test database in CI.

---

## OTA Updates

**expo-updates** enables over-the-air JavaScript bundle updates without going through the app stores.

### How it works

1. Each build is tied to a **channel** (`development`, `preview`, `production`)
2. Each build has a **runtimeVersion** (derived from `version` in app.json via the `appVersion` policy)
3. When the app starts, it checks `https://u.expo.dev/<project-id>` for updates matching its channel + runtimeVersion
4. If a compatible update exists, it downloads and applies it on next launch

### Publishing an OTA update

```bash
cd artifacts/mobile

# Update the preview channel
eas update --branch preview --message "Fix: corrected button alignment"

# Update the production channel
eas update --branch production --message "Hotfix: rate limit adjustment"
```

### When OTA works vs. when you need a new build

| Change type | OTA? | Why |
|-------------|------|-----|
| JavaScript / TypeScript code | Yes | Bundle is replaceable |
| Assets (images, fonts) | Yes | Bundled with JS |
| Native module added/removed | **No** | Requires new native binary |
| app.json config change | **No** | Baked into native build |
| Expo SDK upgrade | **No** | Native dependency change |

---

## Environment Variables

See `.env.example` for the complete list. Summary:

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `DATABASE_URL` | API server | Yes | PostgreSQL connection string |
| `PORT` | API server | Yes | Server listen port |
| `JWT_SECRET` | API server | Production | JWT signing key (stable across restarts) |
| `ALLOWED_ORIGINS` | API server | No | CORS whitelist (comma-separated) |
| `EXPO_PUBLIC_DOMAIN` | Mobile app | Yes | API server domain (without protocol) |
| `EXPO_TOKEN` | GitHub Actions | EAS builds | Robot token from expo.dev |

---

## Monorepo Note: Rollup Native Binaries

The `pnpm-workspace.yaml` suppresses platform-specific native binaries for rollup, esbuild, lightningcss, etc. (lines 46–125). This is optimized for **Replit (Linux x64)**.

**If running tests locally on macOS (Apple Silicon):**

The `@rollup/rollup-darwin-arm64` binary is suppressed. Vitest depends on rollup, so tests will fail without it. Fix:

```bash
pnpm add -D @rollup/rollup-darwin-arm64 --filter @workspace/api-server
```

Do **not** commit this — it's a local-only workaround. CI runs on Linux where the binaries are available.

---

## Deployment Checklist

### Before first production build

- [ ] `eas init` completed, project ID in app.json
- [ ] `expo-updates` installed (`npx expo install expo-updates`)
- [ ] `EXPO_TOKEN` set as GitHub secret
- [ ] `JWT_SECRET` set as EAS secret and Replit secret
- [ ] `EXPO_PUBLIC_DOMAIN` set as EAS secret
- [ ] Apple Developer credentials configured (`eas credentials`)
- [ ] Google Play service account key uploaded (`eas credentials`)

### For each release

- [ ] All CI checks pass (format, typecheck, test)
- [ ] Bump `version` in app.json if native changes were made
- [ ] Run `eas build --profile production --platform all`
- [ ] Run `eas submit --profile production --platform all`
- [ ] For JS-only changes: `eas update --branch production --message "description"`
