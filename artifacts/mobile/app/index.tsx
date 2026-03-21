/**
 * Home screen — the Reframe tab.
 *
 * This screen is the orchestration layer between the API, the three context
 * providers, and the CaptureScreen component. It intentionally contains no
 * UI of its own — all rendering is delegated to CaptureScreen.
 *
 * ## Two-phase analysis flow
 *
 * When the user submits a thought:
 *
 * Phase 1 — Instant local pattern matching (synchronous, no loader)
 *  1. `categoriseLocally` tokenises the thought and classifies each word using
 *     the on-device distortion dictionary.
 *  2. `setWords(localWords)` is called immediately, transitioning GameContext
 *     to "cloud" with the locally-matched categories already colour-coded.
 *  3. `isEnriching` in GameContext is set to `true` (done inside `setWords`).
 *  4. A history entry is created immediately with the local words so that any
 *     reframes the user makes before enrichment completes are tracked correctly.
 *
 * Phase 2 — LLM enrichment (async, in parallel with Phase 1 display)
 *  5. The React Query mutation fires POST /api/reframe in the background.
 *  6. `onSuccess` merges the richer API result (reframes, hints, 50-50,
 *     explainers, corrected categories) over the local result via
 *     `mergeEnrichedWords`. `isEnriching` becomes `false`.
 *  7. The history entry's word list is upgraded to the enriched version while
 *     preserving whatever reframedWords the user has entered so far.
 *
 * ## Why refs instead of state for pendingThought, entryId, and reframedWords?
 *
 * These are mutable refs rather than state because they bridge async boundaries
 * (mutation callbacks, useEffect) where stale closure bugs are common. We don't
 * want a re-render when these values change — we just need to read the latest
 * value inside a callback.
 *
 * ## Streak animation
 *
 * `streakJustIncremented` is state (not a ref) because it drives a visual
 * change in StreakBadge. It's set to true on API success and automatically
 * cleared after 1.5 s so the animation plays once and then stops.
 */

import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { useHistory } from "@/context/HistoryContext";
import { useStreak } from "@/context/StreakContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { useReframeThought, type ReframeResponse } from "@workspace/api-client-react";
import { categoriseLocally } from "@/utils/localDistortionDictionary";

export default function HomeScreen() {
  const { setWords, words, reframedWords, mergeEnrichedWords, setIsEnriching } = useGame();
  const { addEntry, updateEntry } = useHistory();
  const { recordReflection } = useStreak();
  const entryIdRef = useRef<string | null>(null);
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);

  // Keep a ref to the latest reframedWords so the onSuccess callback always
  // reads the current value — avoids stale closure bugs in the async callback.
  const reframedWordsRef = useRef<Record<number, string>>({});
  useEffect(() => { reframedWordsRef.current = reframedWords; }, [reframedWords]);

  const mutation = useReframeThought({
    mutation: {
      onSuccess(data: ReframeResponse) {
        const mapped = data.words.map((w) => ({
          word: w.word,
          category: w.category ?? "neutral",
          reframes: w.reframes ?? [],
          hint: w.hint ?? null,
          fiftyFifty: w.fiftyFifty ?? [],
          explainer: w.explainer ?? null,
        }));

        mergeEnrichedWords(mapped);

        if (entryIdRef.current) {
          updateEntry(entryIdRef.current, reframedWordsRef.current, mapped);
        }

        recordReflection();
        setStreakJustIncremented(true);
      },
      onError(err: unknown) {
        setIsEnriching(false);
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        Alert.alert(
          "Couldn't analyse thought",
          `Please check your connection and try again.\n\n${message}`,
        );
      },
    },
  });

  /**
   * Sync reframedWords back to HistoryContext whenever the user completes or
   * skips a word in the GamePanel. This keeps the history entry up to date as
   * the user works through the session.
   */
  useEffect(() => {
    if (entryIdRef.current && words.length > 0) {
      updateEntry(entryIdRef.current, reframedWords);
    }
  }, [reframedWords]);

  // Auto-clear the streak animation flag after 1.5 s
  useEffect(() => {
    if (streakJustIncremented) {
      const t = setTimeout(() => setStreakJustIncremented(false), 1500);
      return () => clearTimeout(t);
    }
  }, [streakJustIncremented]);

  const handleSubmitThought = (text: string) => {
    const localWords = categoriseLocally(text);

    if (localWords.length > 0) {
      setWords(localWords);
      const id = addEntry(text, localWords);
      entryIdRef.current = id;
    } else {
      entryIdRef.current = null;
    }

    mutation.mutate({ data: { thought: text } });
  };

  // Only show the full-screen ThinkingAnimation in the edge case where the
  // local pass produced no words (empty thought) and the API is still pending.
  const isLoading = mutation.isPending && words.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CaptureScreen
        onSubmit={handleSubmitThought}
        isLoading={isLoading}
        streakJustIncremented={streakJustIncremented}
        entryId={entryIdRef.current}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
