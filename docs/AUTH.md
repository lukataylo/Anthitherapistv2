# Self-Hosted Authentication System

> Optional login/signup flow with zero external auth dependencies.
> All crypto uses Node.js built-in `crypto` module (scrypt + HMAC-SHA256).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile App (Expo / React Native)                           │
│                                                             │
│  ┌─────────────┐     ┌──────────────┐    ┌──────────────┐  │
│  │ ProfileButton│────▶│ /profile     │───▶│ /spirit-     │  │
│  │ (history hdr)│     │  (login/     │    │  animal-quiz │  │
│  └─────────────┘     │   signup +   │    └──────────────┘  │
│                       │   spirit     │                      │
│                       │   animal)    │                      │
│                       └──────┬───────┘                      │
│                              │                              │
│  ┌───────────────────────────┴──────────────────────────┐   │
│  │ AuthContext  (context/AuthContext.tsx)                │   │
│  │  - Stores JWT + user in AsyncStorage                 │   │
│  │  - Exposes: login(), signup(), logout(),             │   │
│  │    deleteAccount(), user, token, isLoading           │   │
│  └──────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │ fetch() with Bearer token
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  API Server (Express 5)                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Rate limiter: 10 req/min per IP on /api/auth/*       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  POST /api/auth/signup   → create user, return JWT          │
│  POST /api/auth/login    → verify password, return JWT      │
│  GET  /api/auth/me       → return user profile (auth req)   │
│  DELETE /api/auth/me     → delete account (auth req)        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ lib/auth.ts                                          │   │
│  │  - createToken()    → HMAC-SHA256 JWT                │   │
│  │  - verifyToken()    → timing-safe signature check    │   │
│  │  - hashPassword()   → scrypt (64-byte key, 16B salt) │   │
│  │  - verifyPassword() → timing-safe hash comparison    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PostgreSQL — users table                             │   │
│  │  id | email (unique) | password_hash | display_name  │   │
│  │  created_at                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Map

| File | Purpose |
|------|---------|
| `lib/db/src/schema/users.ts` | Drizzle ORM table definition for `users` |
| `lib/db/src/schema/index.ts` | Re-exports users (alongside conversations, messages) |
| `artifacts/api-server/src/lib/auth.ts` | JWT creation/verification, password hashing (Node.js crypto only) |
| `artifacts/api-server/src/routes/auth/index.ts` | Express routes: signup, login, me, delete |
| `artifacts/api-server/src/routes/index.ts` | Mounts `authRouter` alongside other routers |
| `artifacts/api-server/src/app.ts` | Adds rate limiter for `/api/auth` (10 req/min) |
| `artifacts/mobile/context/AuthContext.tsx` | React context: auth state, AsyncStorage persistence, API calls |
| `artifacts/mobile/app/profile.tsx` | Profile screen: login/signup form + spirit animal section |
| `artifacts/mobile/app/_layout.tsx` | Wraps app in `AuthProvider`, registers `/profile` route |
| `artifacts/mobile/app/history/index.tsx` | `ProfileButton` replaces old `SpiritAnimalButton` |

---

## Database Schema

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,       -- format: "<hex-salt>:<hex-scrypt-hash>"
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Migration:** Run `pnpm --filter @workspace/db drizzle-kit push` to create the table.

The `password_hash` column stores a colon-separated string: `<32-char-hex-salt>:<128-char-hex-hash>`. The hash is a 64-byte scrypt-derived key. Example:

```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:e8f7a6b5c4d3e2f1...
```

---

## API Endpoints

### `POST /api/auth/signup`

Creates a new user account and returns a JWT.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "min6chars",
  "displayName": "Optional Name"
}
```

**Validation (Zod):**
- `email`: valid email format, max 255 chars
- `password`: 6–128 chars
- `displayName`: optional, max 100 chars

**Success (201):**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": 1, "email": "user@example.com", "displayName": null }
}
```

**Errors:**
- `400` — validation failed (missing/invalid fields)
- `409` — email already taken (application-level check OR DB unique constraint race condition)
- `500` — unexpected server error

### `POST /api/auth/login`

Authenticates an existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "their_password"
}
```

**Success (200):** Same shape as signup response.

**Errors:**
- `400` — validation failed
- `401` — invalid email or password (deliberately vague to prevent enumeration)
- `500` — unexpected server error

### `GET /api/auth/me`

Returns the authenticated user's profile.

**Headers:** `Authorization: Bearer <jwt>`

**Success (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": null,
    "createdAt": "2026-03-22T10:00:00.000Z"
  }
}
```

**Errors:**
- `401` — missing/invalid/expired token
- `404` — token is valid but user was deleted (stale token)

### `DELETE /api/auth/me`

Permanently deletes the authenticated user's account.

**Headers:** `Authorization: Bearer <jwt>`

**Success (200):** `{ "ok": true }`

**Errors:**
- `401` — missing/invalid/expired token

---

## JWT Token Format

Standard three-part JWT: `<header>.<payload>.<signature>`

**Header:**
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload:**
```json
{
  "sub": 1,                    // user ID (number)
  "email": "user@example.com", // user email
  "iat": 1711100000,           // issued-at (Unix seconds)
  "exp": 1713692000            // expires (iat + 30 days)
}
```

**Signature:** HMAC-SHA256 of `<header>.<payload>` using `JWT_SECRET`.

**Verification steps (in `verifyToken()`):**
1. Split token on `.` — must have exactly 3 parts
2. Recompute HMAC-SHA256 over `header.payload` using JWT_SECRET
3. Decode both signatures from base64url to raw bytes
4. Check lengths match (guards against `timingSafeEqual` throwing on mismatched lengths)
5. Constant-time compare using `crypto.timingSafeEqual`
6. Parse payload JSON, check `exp` > current time
7. Return payload or `null`

---

## Password Hashing

Uses Node.js `crypto.scrypt` (memory-hard KDF):

- **Salt:** 16 random bytes (hex-encoded → 32 chars)
- **Key length:** 64 bytes (hex-encoded → 128 chars)
- **Storage format:** `<salt>:<hash>` (colon-separated)
- **Verification:** re-derive key from provided password + stored salt, then `timingSafeEqual` against stored hash

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Production: **yes** | Random 32-byte hex (ephemeral) | HMAC signing key. Must be stable across restarts or all tokens invalidate. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (already required by existing app) |

If `JWT_SECRET` is not set, the server generates a random key on startup and logs a warning. This means tokens won't survive server restarts — fine for development, not for production.

---

## Frontend: AuthContext

**File:** `artifacts/mobile/context/AuthContext.tsx`

### Provider State

| Field | Type | Description |
|-------|------|-------------|
| `user` | `AuthUser \| null` | Current logged-in user, or null |
| `token` | `string \| null` | JWT token, or null |
| `isLoading` | `boolean` | True during initial AsyncStorage hydration |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `login` | `(email, password) → Promise<AuthResult>` | Calls POST /api/auth/login, persists token+user on success |
| `signup` | `(email, password, displayName?) → Promise<AuthResult>` | Calls POST /api/auth/signup, persists token+user on success |
| `logout` | `() → void` | Clears token+user from state and AsyncStorage |
| `deleteAccount` | `() → Promise<void>` | Calls DELETE /api/auth/me, then clears local state |

### AuthResult Type

```typescript
type AuthResult = { ok: true } | { ok: false; error: string };
```

### AsyncStorage Keys

| Key | Value | Description |
|-----|-------|-------------|
| `auth_token_v1` | JWT string | Persisted auth token |
| `auth_user_v1` | JSON string | `{ id, email, displayName }` |

### Hydration Flow

On mount, `AuthProvider` reads both keys from AsyncStorage. If both are present and parseable, the user is restored as logged in. If either is missing or corrupted, the user starts as a guest. `isLoading` is `true` until hydration completes (prevents flash of login form for returning users).

---

## Frontend: Profile Screen

**File:** `artifacts/mobile/app/profile.tsx`

**Route:** `/profile` (hidden from tab bar, full-screen modal)

### Screen States

| State | What the user sees |
|-------|-------------------|
| `authLoading === true` | Centered spinner (during AsyncStorage hydration) |
| `user === null` | Avatar placeholder, spirit animal section, signup/login form |
| `user !== null` | Avatar (spirit animal or person icon), email, logout/delete buttons |

### Spirit Animal Integration

The spirit animal section appears on the profile screen regardless of auth state:
- **Has spirit animal:** Shows card with SVG avatar, name, description. "Retake quiz" navigates to `/spirit-animal-quiz`. "Reset" clears it.
- **No spirit animal:** Shows "Discover your guide" button that navigates to `/spirit-animal-quiz`.

When the user returns from the quiz after accepting a spirit animal, the profile screen automatically reflects the update (SpiritAnimalContext re-renders).

### Form Behavior

- Defaults to "Sign up" mode
- "Already have an account? Log in" toggles to login mode
- Client-side validation: both fields required, password >= 6 chars
- Server errors displayed in red error box
- Submit button disabled + shows spinner while request is in flight
- On success: form fields cleared, screen re-renders to show logged-in state
- Password visibility toggle (eye icon) with proper padding to prevent text overlap

---

## Frontend: ProfileButton (History Header)

**File:** `artifacts/mobile/app/history/index.tsx` (lines 260–292)

Replaces the old `SpiritAnimalButton`. Same position (top-right of History screen header), same 36x36px circular style.

| State | Icon Shown |
|-------|-----------|
| Spirit animal exists | Spirit animal SVG (18x18) |
| Logged in, no spirit animal | Filled person icon |
| Guest, no spirit animal | Outline person icon |

Tapping always navigates to `/profile`.

---

## Provider Nesting Order

```
SafeAreaProvider
  ErrorBoundary
    QueryClientProvider
      GestureHandlerRootView
        HistoryProvider
          StreakProvider
            GameProvider
              JournalSessionProvider
                AuthProvider            ← NEW
                  SpiritAnimalProvider
                    Tabs + TabBar
```

`AuthProvider` must wrap `SpiritAnimalProvider` and `Tabs` so that both the profile screen and the history screen's `ProfileButton` can access `useAuth()`.

---

## Security Considerations

| Concern | Status |
|---------|--------|
| Password hashing | scrypt (memory-hard KDF), 64-byte key, random 16-byte salt per password |
| Timing attacks | `crypto.timingSafeEqual` for both JWT signatures and password hashes |
| Brute force | Rate limited to 10 req/min per IP on all `/api/auth/*` routes |
| CSRF | Not applicable — JWT sent as `Authorization: Bearer` header, not cookies |
| Token storage | AsyncStorage (unencrypted on some platforms). Acceptable for MVP; upgrade to `expo-secure-store` for production hardening |
| Email enumeration | Login returns same error for wrong email vs wrong password |
| SQL injection | Drizzle ORM parameterized queries throughout |
| Signup race condition | Application-level check + DB unique constraint. Unique violation (PG error 23505) caught and returned as 409 |

---

## Debugging Guide

### "Login/signup returns network error"

1. Check `EXPO_PUBLIC_DOMAIN` is set — AuthContext builds `API_BASE` from this
2. Check API server is running and reachable at `https://<EXPO_PUBLIC_DOMAIN>`
3. Check CORS allows the mobile app's origin (or `ALLOWED_ORIGINS` is unset for dev)

### "Token not surviving server restarts"

Set `JWT_SECRET` environment variable to a stable value. Without it, the server generates a random key on each start, invalidating all existing tokens.

### "Users table doesn't exist"

Run the Drizzle migration:
```bash
pnpm --filter @workspace/db drizzle-kit push
```

### "500 on signup with existing email"

This was a known race condition — fixed by catching PostgreSQL error code `23505` (unique_violation) and returning a 409 instead. If you still see 500s on signup, check the server logs (`req.log.error`) for the actual error.

### "AuthProvider throws: useAuth must be used inside AuthProvider"

The consuming component is rendered outside the provider tree. Check `_layout.tsx` — `AuthProvider` must wrap `Tabs` (and therefore all tab screens and modal routes).

### "Profile screen shows login form briefly on app restart"

This is the `isLoading` state during AsyncStorage hydration. The profile screen shows a centered spinner during this phase. If it's not showing the spinner, check that `isLoading` is being read from `useAuth()` in the profile screen component.

### "Password text appears under the eye icon"

The password `TextInput` has `paddingRight: 48` to prevent this. If text still overlaps, increase the padding value.

---

## Testing the Auth Flow Manually

```bash
# 1. Signup
curl -X POST https://<domain>/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 2. Login
curl -X POST https://<domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 3. Get profile (use token from step 1 or 2)
curl https://<domain>/api/auth/me \
  -H "Authorization: Bearer <token>"

# 4. Delete account
curl -X DELETE https://<domain>/api/auth/me \
  -H "Authorization: Bearer <token>"
```

---

## Future Improvements

These are not implemented but are natural next steps:

1. **Cloud sync** — Tie history/streak/journal data to user accounts for cross-device access
2. **`expo-secure-store`** — Move token storage from AsyncStorage to encrypted keychain
3. **Password reset** — Requires email sending capability (not self-hosted without SMTP)
4. **Account-level rate limiting** — Currently IP-based; could lock accounts after N failed attempts
5. **Refresh tokens** — Current JWTs are long-lived (30 days). A refresh token flow would allow shorter access tokens
