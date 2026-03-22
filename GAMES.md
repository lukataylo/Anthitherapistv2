# Reframe — Games Reference

This document provides a detailed per-game breakdown of every mini-game implemented in the Reframe app. All five games live in `artifacts/mobile/components/` and are launched from the Shape tab's game carousel (`GameCarousel.tsx`). They are rendered as full-screen `Modal` components and receive `entries: HistoryEntry[]` and `onClose: () => void` as props.

---

## Shared Gamification Systems

### Daily Streak

- **Context:** `StreakContext` (`artifacts/mobile/context/StreakContext.tsx`)
- **Storage:** AsyncStorage, key `reframe_streak_v1`
- **Logic:** `recordReflection()` is called once per thought submitted. If the last reflection was yesterday, the streak increments. If it was today, the call is a no-op. Any older date resets the streak to 1. On app launch, `computeStreak()` checks whether the streak has gone stale (no reflection today or yesterday) and zeroes `currentStreak` so the display is always accurate.
- **UI component:** `StreakBadge` — a flame icon + number pill in the top-left of the capture screen. Dims to 50% opacity when not reflected today. Springs to 1.4× scale for 1.5 seconds after a new reflection is recorded.

### Score / Combo System

Each game implements its own scoring. Base scores and combo rules differ per game:

- **Sort Tower:** 100 pts per correct swipe. Combo multiplier: ≥3 → 2×, ≥5 → 3×, ≥8 → 4×. A `ScorePop` animation (scale bounce) plays on the score display after each change.
- **Rocket Reframe:** 100 pts per correct answer + speed bonus (`round(timerFraction × 80)`). No combo multiplier.
- **Thought Check:** 200 pts per correct answer. No combo multiplier.
- **Mind Voyage:** 100 pts per correct answer × combo multiplier (≥2 → 2×, ≥3 → 3×). Wrong answers reset the streak/combo.
- **Reword:** 200 pts per correct answer × combo multiplier: ≥2 consecutive correct → 2×, ≥3 → 3×. Wrong answers reset the combo but do not deduct points.

Wrong answers reset the combo to zero in Sort Tower, Mind Voyage, and Reword. Rocket Reframe has no combo; Thought Check has no combo.

### Personalisation Mechanic

Every game calls a `buildDeck` / `buildQuestions` / `buildRounds` function that extracts content from `HistoryEntry[]` (from `HistoryContext`). This means the words users see in games are drawn from their own past reflections, not a generic vocabulary list. Each game also includes a curated fallback set of common CBT word pairs for new users with little history.

### Game Done / Summary Screens

End-of-game states are currently handled inline within each game component (e.g. a `"done"` phase renders a score card and a Play Again button inside the same modal).

---

## Game 1 — Sort Tower

| Property | Value |
|---|---|
| File | `artifacts/mobile/components/SortTowerGame.tsx` |
| Carousel ID | `sort-tower` |
| Category label | STACKING |
| Card theme | Deep navy (`#0C1E2E`), chevron pattern |

### Therapeutic Goal

Trains **categorical recognition** — the ability to quickly label a word as either a cognitive distortion or a healthy alternative. This mirrors the CBT thought-record exercise of categorising automatic thoughts. Speed constraint prevents overthinking and builds rapid pattern recognition.

### Game Mechanic

- **30-second timed session.**
- Players are shown word cards one at a time, drawn from their history deck.
- Each card displays a single word (distorted or a reframe of one).
- Players **swipe LEFT** (≥ 27% of screen width) to classify the word as negative/distorted, or **swipe RIGHT** to classify it as positive/healthy.
- While dragging, the card rotates ±8° and `NEGATIVE` / `POSITIVE` labels fade in at the sides.
- On release past the threshold, the card flies off-screen and the next card animates in.
- On release below the threshold, the card springs back to centre.

### Deck Building

`buildDeck(entries)` extracts:
- Every non-neutral word from `HistoryEntry.words` → added as `isNegative: true`.
- Every reframe string from `HistoryEntry.words[i].reframes` → added as `isNegative: false`.
- Case-insensitive deduplication prevents the same word appearing twice.
- Deck is shuffled so distorted words and reframes don't cluster.

If the deck is empty (no history), an "Not Enough Reflections" state is shown instead of the game.

### Gamified Elements

- **Tower building:** each correct swipe adds a new coloured floor to a pixel-art tower that grows upward. Floors animate in with a spring drop.
- **Tower tapering:** each floor is 4 px narrower than the one below, down to a minimum width, creating a tapered shape.
- **Spire:** when the tower reaches 8 floors, an animated spire appears at the top.
- **Target line:** a "GOAL" dashed line is drawn at the 8-floor height.
- **Colour palette:** 10 floor colours cycle in order (`FLOOR_PALETTE`).
- **Window count:** each floor has arch windows; the count increases as the tower grows (capped at 5).
- **Score:** 100 pts per correct swipe × combo multiplier.
- **Combo multiplier:** ≥ 3 correct → 2×; ≥ 5 → 3×; ≥ 8 → 4×. A `ComboFlash` pill pops in when the multiplier activates.
- **Wrong-answer toast:** a brief text pill appears explaining the classification ("«word» — This is a distorted thought").
- **Timer pulse:** at 10 seconds remaining, the timer text starts pulsing (scale 1 → 1.06) via `withRepeat` to create urgency.
- **Feedback pill:** a ✓ or ✗ icon flashes briefly after each swipe.

### Personalisation Hook

Deck drawn from the user's own distorted words and their AI-provided reframes, so users sort vocabulary they have personally produced.

### Current Implementation Status

Fully implemented. The game plays end-to-end with deck building, swipe gestures (react-native-gesture-handler Reanimated worklet), tower rendering, combo system, and done/play-again state.

### Known Pending Work

- **Category-colored floors + legend:** Currently all floors cycle through a fixed 10-colour palette regardless of distortion category. The plan is to colour each floor by the category of the word that produced it, and add a legend so users understand what each colour means.

---

## Game 2 — Rocket Reframe

| Property | Value |
|---|---|
| File | `artifacts/mobile/components/RocketGame.tsx` |
| Carousel ID | `rocket-reframe` |
| Category label | REFRAMING |
| Card theme | Near-black (`#020D1A`), arc pattern |

### Therapeutic Goal

Drills the **reframing substitution** skill — associating specific distorted words with their healthy counterparts. Time pressure prevents over-analysis and builds automatic recall, similar to CBT flashcard drills used in therapy homework.

### Game Mechanic

- A rocket ship is shown on a starfield background.
- Players answer multiple-choice quiz questions: given a distorted word as a prompt, choose the correct reframe from two options.
- **Gravity:** the rocket continuously drifts downward toward the "danger zone" (`R_BOT`). If it reaches the bottom, the game ends.
- **Correct answer:** the rocket boosts upward 65–95 px and restarts its drift from the new position.
- **Wrong answer:** the correct answer is briefly revealed; one life is lost.
- **3 lives** (heart icons). Game over when lives reach 0 or when all questions are answered.
- **Per-question timer bar:** shrinks from full to empty. Starting duration is 5.8 s; each correct answer reduces the limit by 160 ms down to a floor of 2 s, creating progressive difficulty.

### Question Generation

`buildQuestions(pairs)` sources word pairs from:
1. The user's `reframedWords` history — pairs of (original distorted word, chosen reframe) from completed sessions (reframes ≤ 28 chars to fit the button).
2. A curated `FALLBACK` set of 18 common CBT word pairs when the user has few history entries.

For each question, the wrong option is randomly selected from other distorted words in the pool, so it contrasts clearly with the correct answer. Correct/wrong button positions are randomly flipped.

### Gamified Elements

- **Rocket gravity mechanic:** the visual tension of the rocket drifting toward the bottom creates urgency independent of any timer.
- **Altitude bar:** a vertical bar on the right edge of the screen interpolates the rocket's position into a visual altitude indicator.
- **Starfield parallax:** three star layers (slow, medium, fast) scroll downward at different speeds using looping `Animated.timing`. The fastest layer renders stars as vertical streaks (hyper-speed effect). Each layer has two copies offset by one screen height to create a seamless loop.
- **Speed bonus:** answering quickly gives `round(timerFraction × 80)` bonus points. A floating "+N" popup appears for 700 ms.
- **Wrong-answer teaching phase:** the correct answer is briefly highlighted (in green) before the next question appears, so every miss is a learning moment.
- **Score display** with ScorePop animation.
- **Feedback flash:** a tinted full-screen flash (teal for correct, red for wrong) on each answer.

### Personalisation Hook

Question pairs are seeded from the user's own reframedWords history (words they have personally reframed in sessions). The fallback is used to pad the deck when history is sparse.

### Current Implementation Status

Fully implemented. The wrong-answer teaching phase (revealing the correct answer) is merged and live.

### Known Pending Work

None currently tracked.

---

## Game 3 — Thought Check

| Property | Value |
|---|---|
| File | `artifacts/mobile/components/ThoughtCheckGame.tsx` |
| Carousel ID | `thought-check` |
| Category label | AWARENESS |
| Card theme | Very dark teal-green (`#001A14`), grid pattern |

### Therapeutic Goal

Trains the **recognition phase** of CBT — noticing that a thought contains cognitive distortion before any reframing can occur. Players must distinguish distorted thoughts from healthy ones, including healthy ones presented alongside distorted examples (testing false-positive avoidance).

### Game Mechanic

- Players are shown thoughts one at a time (with a drop animation for each word).
- Two buttons at the bottom: **DISTORTED** and **HEALTHY**.
- Correct answer advances to the next round.
- If the player marks a distorted thought as healthy → explanation phase is entered.
- If the player marks a healthy thought as distorted (false positive) → no explanation phase, moves to next round immediately.
- **4 lives.** Wrong answer costs one. Game over at zero.

### Round Generation

`buildRounds(entries)` creates a 10-round shuffled deck mixing:
- Up to 6 distorted rounds from the user's history. For each history entry, significant (non-neutral) words are extracted; their category drives a contextual explanation sentence.
- Fallback distorted rounds (`DISTORTED_FALLBACK` — curated list) if the user has fewer than 6 history entries with significant words.
- 4 healthy rounds drawn from `HEALTHY_THOUGHTS` (7 available, 4 selected per session).

### Gamified Elements

- **Lives (hearts):** 4 lives displayed as heart icons in the HUD.
- **DroppingText animation:** on each new round, the thought words drop in from above, staggered by 38 ms per word, triggered by incrementing `triggerKey`.
- **Feedback flash:** a 60 ms teal (correct) or red (wrong) full-screen flash.
- **Background glow:** on wrong answers, the background glow changes from green to crimson and sustains during the explanation phase, reinforcing the negative-feedback signal.
- **Explanation phase:** on wrong answers for distorted thoughts, the distorted words within the thought are highlighted in pink and an explanation card appears with a "TAP TO CONTINUE" prompt. The player taps the card to advance.
- **Score:** 200 pts per correct answer, displayed in the HUD.

### Personalisation Hook

Distorted rounds are constructed from the user's own past thoughts and the distorted words Claude identified within them. The category-keyed explanation text is generated from the same word analysis data.

### Current Implementation Status

Fully implemented with explanation phase for wrong answers on distorted rounds.

### Known Pending Work

- **Bonus phase:** A bonus round at the end of the Thought Check session is pending implementation. This would trigger after the main 10-round deck is exhausted (or lives are still > 0) before showing the final score.

---

## Game 4 — Mind Voyage (Sail Game)

| Property | Value |
|---|---|
| File | `artifacts/mobile/components/SailGame.tsx` |
| Carousel ID | `mind-voyage` |
| Category label | AWARENESS |
| Card theme | Dark teal (`#002E2A`), rings pattern |

### Therapeutic Goal

Trains **word-level precision** — pinpointing exactly which word in a thought is distorted, not just whether the overall thought is problematic. This mirrors the CBT technique of "thought deconstruction", where the therapist helps identify the precise distorted language rather than dismissing the thought wholesale.

### Game Mechanic

- Players see a thought displayed in a card, with one specific word highlighted in a teal chip.
- Two buttons: **× ERROR** (the highlighted word is a cognitive distortion) and **✓ VALID** (the word is fine).
- Correct answer advances the sailboat across the moonlit scene. On correct answers from history-derived rounds, a 2-second annotation overlay shows the full thought with every distorted word colour-coded by category, then auto-dismisses.
- Wrong answer: an explanation card replaces the thought card; the player taps to advance.
- **90-second countdown timer** (displayed as "M:SS").
- Game ends when the boat reaches the far shore (11 correct answers), all rounds are exhausted, or time runs out.

### Round Generation

`buildRounds(entries)` produces up to 12 shuffled rounds from three sources:
1. **History rounds** (capped at 8 after expansion): for each history entry, every significant (non-neutral) word creates its own separate round. A thought with 3 distorted words produces 3 rounds. Each carries `allWords` — all distorted words from that entry — for the annotation overlay.
2. **DISTORTED_FALLBACK** — curated fallback rounds (do not carry `allWords`; no annotation overlay shown).
3. **HEALTHY** — 4 rounds where the highlighted word is deliberately not distorted.

### Gamified Elements

- **Sailboat progress:** the boat (`boatX`) starts at 16 px from the left and advances `(BOAT_END - BOAT_START) / 11` pixels per correct answer. The boat position is animated with `Animated.timing`.
- **Progress track:** a horizontal bar below the scene interpolates `boatX` to a percentage fill as a secondary progress indicator.
- **Scene:** moonlit seascape with fixed star positions, crescent moon (CSS-equivalent View composition of two circles), horizon line, and water gradient.
- **Full-context annotation overlay** (history rounds only): after a correct answer, the complete thought is shown with every distorted word highlighted in its category colour for 2 seconds. This teaches the full distortion landscape of a thought.
- **Explanation flow:** wrong answers show a teaching card before advancing.
- **Score and combo/streak system:** 100 pts per correct answer × combo multiplier (streak ≥2 → 2×, ≥3 → 3×). Wrong answers reset the streak to 0. Score and streak are shown in the HUD; "STREAK x{multi}" label appears when streak ≥ 2.

### Personalisation Hook

History-derived rounds use the user's own exact thought text and distorted word set. The annotation overlay shows the complete word-by-word analysis Claude performed on their original thought.

### Current Implementation Status

Fully implemented. The full-context annotation overlay after correct answers on history-derived rounds is merged and live.

### Known Pending Work

None currently tracked.

---

## Game 5 — Reword

| Property | Value |
|---|---|
| File | `artifacts/mobile/components/RewordGame.tsx` |
| Carousel ID | `reword` |
| Category label | LANGUAGE |
| Card theme | Very dark purple (`#160A1C`), chevron pattern |

### Therapeutic Goal

Reinforces the **substitution phase** of cognitive restructuring — choosing the right word to replace a distorted one. The three-option branching tree design trains nuanced word selection: users must distinguish between "reducing intensity" (correct) versus "replacing one absolute with another" (still distorted). Both wrong options are plausible alternatives, not obviously wrong.

### Game Mechanic

- An **idle overlay** is shown first (game rules + Play button) before the session starts.
- The distorted word is displayed at the center of the screen as a root node ("the distorted word") with a letter-by-letter reveal animation.
- Three branch lines connect the root to three node circles at the bottom (at 16%, 50%, 84% of screen width).
- The player taps one node.
- **Correct node:** turns green with a glow ring; no explanation is shown; game auto-advances to the next round after ~900 ms.
- **Wrong node:** turns red; the correct node is also highlighted green; the explanation text appears with a "TAP TO CONTINUE" prompt — the player must tap the explanation card to advance to the next round.
- **90-second session timer** (displayed as "M:SS").
- Game ends when the timer expires or all rounds are exhausted.

### Content / Rounds

A fixed curated deck of 12+ word substitution rounds (in `ROUNDS`), each specifying:
- `distorted` — the distorted word at the root.
- `correct` — the correct reframe node.
- `wrong: [string, string]` — two wrong options that are still distorted alternatives.
- `explanation` — why the correct word is better.

The three node options are shuffled randomly each round so the correct answer isn't always in the same position. History entries influence which curated rounds appear (see Personalisation Hook below).

### Gamified Elements

- **Tree diagram:** a static `TreeDiagram` renders a central dot → short vertical stem → horizontal bar → three vertical legs → three node circles. Lines change colour after a selection (selected-correct leg → green; selected-wrong leg → red; others → dimmed).
- **Animated word reveal:** each new distorted word appears with a letter-by-letter animation (`AnimatedWord`), with each character fading in 52 ms apart.
- **Node selection feedback:** selected-correct → green node with scale spring to 1.25×; selected-wrong → red node; other nodes dimmed to 0.3× opacity. Immediate visual feedback via `Animated.spring` on node scale.
- **History trail:** a horizontal scrollable dot trail above the playing field shows correct (green) and wrong (red) dots for all previous rounds in the current session.
- **Score:** 200 pts per correct answer × combo multiplier (≥2 consecutive correct → 2×; ≥3 → 3×).
- **Streak indicator:** "STREAK ×N" label appears in the HUD when streak ≥ 2.
- **Wrong answers** break the combo streak but do not deduct points or lives.
- **No lives mechanic** — the game cannot end early due to errors; only the timer or exhausting all rounds ends it.
- **Hint nudge:** after 3 seconds of inactivity (no selection), a "Choose the healthier word ↓" hint fades in below the distorted word. The hint clears when the player makes a selection or moves to the next round.

### Personalisation Hook

History entries are used to influence round selection: for each history entry, the first distorted word is looked up in the curated `ROUNDS` dictionary. Any matching curated rounds are collected into a "history-first" list, which is then merged with the full shuffled `ROUNDS` deck and sliced to 10 rounds. This gives words the user has personally encountered in their thoughts a higher probability of appearing in the session, but the options (correct / wrong alternatives) always come from the pre-authored curated deck — not from user-chosen reframes.

### Current Implementation Status

Fully implemented. The static tree diagram, letter-by-letter word reveal, history trail (dot indicators), inactivity hint nudge, and correct-node reveal on wrong answers are all merged and live.

### Known Pending Work

None currently tracked.

---

## Summary Table

| Game | File | Base Score | Timer | Lives | Combo | Speed Bonus | Personalisation Source |
|---|---|---|---|---|---|---|---|
| Sort Tower | `SortTowerGame.tsx` | 100 pts | 30 s global | None | ≥3: 2×, ≥5: 3×, ≥8: 4× | No | User's distorted words + reframes |
| Rocket Reframe | `RocketGame.tsx` | 100 pts | Per-question (5.8 s→2 s) | 3 | No | Yes (+timerFraction×80) | User's reframedWords history |
| Thought Check | `ThoughtCheckGame.tsx` | 200 pts | None | 4 | No | No | User's own historical thoughts |
| Mind Voyage | `SailGame.tsx` | 100 pts | 90 s global | None | ≥2: 2×, ≥3: 3× | No | User's distorted words (per word) |
| Reword | `RewordGame.tsx` | 200 pts | 90 s global | None | ≥2: 2×, ≥3: 3× | No | History distorted words select curated rounds |
