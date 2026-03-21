#Product Requirements Document
### AI steering document. To be placed in repository root as `PRODUCT.md` and referenced in Cursor rules.

---

## What this is
This is a private, voice-first journaling app that helps users notice and gently reframe the language they use about themselves. It is not a chatbot, a therapy tool, or a productivity app. It is a mirror — a quiet space where a person can speak freely and then, at the end, see patterns in their own words that they may not have noticed.

---

## The one thing this app does

It listens, stores, analyses in the background, and then — only at the end — reflects specific language patterns back to the user with a light invitation to reconsider them.

Everything in the product should serve this loop. Features that interrupt it, complicate it, or shift attention away from the user's own words do not belong here.

---

## Who this is for

A person who already has some interest in self-reflection — not necessarily someone in therapy, not a journaling power-user, not someone who needs to be convinced that self-awareness matters. They've probably already tried journaling and found it hard to sustain. They find blank pages intimidating. They think better when they speak. They want to feel heard, not judged.

They are not here to be fixed. They are here to think.

---

## Core experience principles

### 1. The user should never feel analysed while they are speaking
The analysis is entirely invisible during the input phase. No real-time highlighting. No feedback while they type or speak. No visible AI activity other than a brief, unobtrusive "processing" indicator that disappears immediately. The session screen is just them and a text field.

Any feature that makes the analysis visible during input breaks this principle.

### 2. Prompts are invitations, not interrogations
The follow-up prompts ("Tell me more", "What makes you feel that way?") are not clinically targeted. They are non-directive by design. The system does not ask pointed follow-up questions in the moment — those are reserved for the feedback view, after the session, when the user has chosen to receive them.

Do not add context-aware prompting during the session. The prompts are intentionally generic and hardcoded.

### 3. Feedback is observational, not corrective
The feedback view shows the user what they said and names a pattern. It does not tell them they are wrong. It does not prescribe a better way to feel. The reframe hints are questions, not corrections. The tone is the equivalent of a thoughtful friend pointing something out, not a coach assigning homework.

Any copy in the feedback view that sounds like advice, diagnosis, or instruction should be revised until it is a question or an observation.

### 4. The app holds the session, not a relationship
Temet is not a companion. It does not remember the user's name, greet them warmly on return, or reference past sessions in an intimate way. The History view exists for the user's own reference, not to build a sense of ongoing connection with the app. The product does not foster reliance.

### 5. Privacy is structural, not a feature
User text never leaves the device except for the Anthropic API call that performs background analysis. That call contains only the raw turn text — no user ID, no session metadata, no history. Each turn is analysed in isolation. The API key is environment-variable only, never hardcoded. This is not a privacy policy — it is a constraint on how the system is built.

---

## Product scope

### In scope (v1)

- Mood check-in on open (binary: good / low)
- Free-text and voice input in a single full-screen text area
- Non-directive follow-up prompts after each turn (hardcoded rotation)
- Background AI analysis per turn (async, silent)
- Session feedback view on wrap-up: highlighted language patterns + reflection questions
- Reframe interaction mechanics — structured mini-games and active exercises that deliver the reframing experience in an engaging, subliminal way. These are intentional departures from the minimal aesthetic of the session screen and serve a different psychological moment. Full specification in `REFRAME_MECHANICS.md`.
- Session history (list of past sessions, feedback payloads readable)
- Streak indicator (days used consecutively — motivational, not gamified)
- Local-only data storage

### Out of scope (v1)

- User accounts or cloud sync
- Social or sharing features
- AI responses during the session (the app does not converse)
- Therapist or coach referral features
- Mood tracking charts or analytics dashboards
- Notifications or reminders (considered for v2)
- Guided journaling prompts or topic-based sessions
- Any form of export other than reading history in-app

---

## Screens and navigation

### Screen 1 — Mood check-in
Shown on every open. Two choices: 😊 or 😔. Binary. No middle option. No skip.

Purpose: sets `session.moodOnOpen`. Warms the user into the session. Takes one tap.

Do not add: additional mood options, sliders, text labels on the emoji, explanatory copy.

### Screen 2 — Intent screen
One sentence of contextual copy (adapts slightly to mood: "Good to see you." vs "I'm here with you.") followed by a brief invitation to speak freely.

Purpose: transition from the world into the session. Should feel like closing a door.

Do not add: instructions, tips, examples of what to write, progress indicators beyond the progress bar.

### Screen 3 — Session screen
The main input area. Full screen. Placeholder text: "What's on your mind…". Microphone icon for voice. Send button. A "Wrap up session →" affordance available but not prominent.

The follow-up prompt appears after each send, rendered as lightweight italic text below the last user message. It is not a chat bubble from the app. It is not a response. It is a murmur.

Do not add: character counts, typing indicators, AI "thinking" animations beyond the brief background processing bar, suggested responses, emoji reactions, formatting tools.

### Screen 4 — Feedback view (Reframe)
Shown after "Wrap up session" is tapped. Reads from the assembled `FeedbackPayload`.

Two sections:
1. Language patterns — quoted excerpts with the flagged phrase highlighted (colour-coded by severity), a category tag, and a reframe question beneath each
2. Something to sit with — AI-generated reflection questions (max 3), rendered with a left accent bar, no attribution to AI

Following these two sections, the reframe phase may present one or more interaction mechanics (mini-games, structured exercises) designed to make the self-reframing process active and engaging rather than purely observational. These mechanics are driven by the `FeedbackPayload` data but their interaction design is governed entirely by `REFRAME_MECHANICS.md`, not this document. Cursor should not infer, invent, or constrain these mechanics based on anything written here — defer entirely to `REFRAME_MECHANICS.md` for that phase.

The minimalism of the session screen and the playfulness of the reframe phase are not in conflict. They serve different psychological moments: the session screen is for uninhibited expression; the reframe phase is for active, engaged reflection.

Do not add to the pattern/reflection sections: a score, a rating, a progress metric, comparisons to previous sessions, advice, affirmations, a summary paragraph written by the AI, a "your mood today was X" statement.

### History tab
List of past completed sessions, most recent first. Each entry shows: date, mood emoji, number of flags by severity (as small dots or counts), tap to expand full feedback payload.

Do not add: search, filtering by mood, export, sharing, streak breakdowns per session.

---

## Data constraints for AI features

The background analyser (Claude API call per turn) must:

- Receive only the raw text of the current turn — no session context, no prior turns, no user history
- Return only the structured JSON defined in `backgroundAnalyser.ts`
- Fail silently — a failed analysis call must not affect the session in any visible way
- Never be awaited in a way that delays any UI action

The feedback assembler must:

- Run only once, at session end
- Produce an immutable payload — never updated after creation
- Dedup repeated pattern matches (same phrase capped at 2 appearances in feedback)
- Surface a maximum of 3 reflection questions regardless of how many noteworthy turns there were

---

## Language and tone guidelines

### App copy
- Sentence case always. No title case, no all caps.
- Short. The app speaks less than the user.
- Warm but not effusive. Never "Amazing!" or "Great job!".
- Questions are preferred to statements wherever possible.
- The word "journal" should not appear in the UI. Neither should "therapy", "mental health", "analysis", or "AI".

### Feedback copy
Every piece of copy in the feedback view should be reviewable against this test:

> Does this make the user feel observed and invited to think, or does it make them feel judged and told what to do?

If the latter: revise.

### Prohibited phrases in UI copy
- "We noticed that…"
- "You should…"
- "It seems like you…"
- "Our AI detected…"
- "Based on your session…"
- "You used X pattern Y times" (as a headline — raw counts can appear as context only)
- Any variation of "don't worry" or "that's okay"

---

## What the AI assistant (Cursor) should always do

- Treat `patternLibrary.ts` as the single source of truth for all pattern definitions. Never define patterns inline elsewhere.
- Keep all six modules strictly separated. No module should import from another except as documented in the architecture spec.
- Keep the Pattern Matcher synchronous. Any async logic introduced into `patternMatcher.ts` is a bug.
- Keep the Background Analyser fire-and-forget. Any `await` on its result in the UI layer is a bug.
- Write the `FeedbackPayload` once and treat it as immutable. Never mutate it after `assembleFeedback()` returns.
- Store nothing about the user except what is defined in `Session`, `Turn`, and `Analysis` types.
- Use environment variables for the API key. If a hardcoded key appears anywhere in the codebase, flag it immediately.

## What the AI assistant (Cursor) should never do

- Add chat-style AI responses during the session screen
- Add real-time highlighting or pattern detection while the user is typing
- Add any UI element that references the AI, the analysis, or the pattern detection to the user
- Add user accounts, authentication, or any network call other than the Anthropic API
- Add analytics, tracking, or any third-party SDK
- Add toast notifications, push notifications, or any interruption during the session
- Expand the `FeedbackPayload` type to include advice, diagnoses, or prescriptive suggestions
- Change the tone of feedback copy from observational/questioning to corrective/instructional
- Add a "skip" option to the mood check-in on screen 1

---

## Decision log

Decisions made during design that should not be relitigated without a deliberate product conversation:

| Decision | Rationale |
|---|---|
| Binary mood check-in (not a scale) | Reduces friction. Removes the cognitive overhead of calibration. The system uses it as a flag, not a measurement. |
| No AI responses during session | The session is the user's space to speak. AI presence during input would shift the experience from introspection to conversation. |
| Prompts are hardcoded, not context-dependent | Ensures prompts remain non-leading. Context-aware prompting risks surfacing the analysis to the user mid-session. |
| Per-turn analysis, not end-of-session analysis | Allows analysis to run in parallel with the session rather than causing a delay at wrap-up. Feedback is available almost immediately. |
| Max 3 reflection questions in feedback | Cognitive load limit. More than 3 questions feel overwhelming and reduce the likelihood of any being genuinely engaged with. |
| No user accounts in v1 | Reduces technical complexity and eliminates the most significant privacy risk surface. Local-first is a feature, not a limitation. |
| Reframe hints are questions, not rewrites | Rewriting the user's language for them is presumptuous and removes agency. A question invites the user to do their own rewriting. |
| "Temet" not explained in UI | The name carries meaning for those who look it up. Explaining it in-app would be both unnecessary and condescending. |
| Reframe mechanics specified in a separate document | The playful, game-like interaction mechanics of the reframe phase are tonally distinct from the minimal session screen. Keeping them in a separate `REFRAME_MECHANICS.md` prevents Cursor from treating the minimalism of this document as a constraint on that phase, while keeping this document focused on session-layer intent. |

---

## Success criteria for v1

A session is successful if:
- The user completed the mood check-in, wrote at least 2 turns, and reached the feedback view
- At least one pattern flag was surfaced in feedback
- The user spent time on the feedback view (engaged, not immediately dismissed)

The product is successful if:
- Users return for a second session
- Users describe the feedback as "surprising but accurate" rather than "obvious" or "wrong"
- Users do not describe the experience as therapeutic or clinical — they describe it as reflective

---

*Last updated: March 2026*
*This document should be updated whenever a significant product decision is made. It is the source of truth for product intent — not Slack, not memory, not assumption.*
