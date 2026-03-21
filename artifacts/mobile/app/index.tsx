/**
 * Home screen — the Reframe tab.
 *
 * This screen is the orchestration layer between the API, the three context
 * providers, and the CaptureScreen component. It intentionally contains no
 * UI of its own — all rendering is delegated to CaptureScreen.
 *
 * ## User flow
 *
 *  1. User types a thought and taps Send
 *  2. `handleSubmitThought` stores the text in `pendingThoughtRef` and fires
 *     the React Query mutation (POST /api/reframe)
 *  3. While the request is in-flight, `mutation.isPending` is true and
 *     CaptureScreen renders the ThinkingAnimation loading state
 *  4. `onSuccess` maps the API response into WordAnalysis[], creates a history
 *     entry, records the streak, and hands the words to GameContext via `setWords()`
 *  5. GameContext transitions the screen to "cloud" (annotated thought review)
 *  6. As the user reframes words, GameContext updates `reframedWords`
 *  7. The useEffect on `reframedWords` syncs those changes back to HistoryContext
 *
 * ## Why refs instead of state for pendingThought and entryId?
 *
 * `pendingThoughtRef` and `entryIdRef` are mutable refs rather than state
 * because they bridge async boundaries (mutation callbacks, useEffect) where
 * stale closure bugs are common. We don't want a re-render when these values
 * change — we just need to read the latest value inside a callback.
 *
 * ## Streak animation
 *
 * `streakJustIncremented` is state (not a ref) because it drives a visual
 * change in StreakBadge. It's set to true on API success and automatically
 * cleared after 1.5 s so the animation plays once and then stops.
 */

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { useHistory } from "@/context/HistoryContext";
import { useStreak } from "@/context/StreakContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { useReframeThought, type ReframeResponse } from "@workspace/api-client-react";

export default function HomeScreen() {
  const { setWords, words, reframedWords } = useGame();
  const { addEntry, updateEntry } = useHistory();
  const { recordReflection } = useStreak();
  // The id returned by addEntry, held in a ref so the useEffect below can
  // always read the latest value without being listed as a dependency
  const entryIdRef = useRef<string | null>(null);
  // The thought text submitted in the current API request; stored as a ref
  // rather than state to avoid triggering a re-render on submit
  const pendingThoughtRef = useRef<string>("");
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);

  const mutation = useReframeThought({
    mutation: {
      onSuccess(data: ReframeResponse) {
        // Map API response to the internal WordAnalysis shape, providing
        // safe defaults for optional fields that Claude might omit
        const mapped = data.words.map((w) => ({
          word: w.word,
          category: w.category ?? "neutral",
          reframes: w.reframes ?? [],
          hint: w.hint ?? null,
          fiftyFifty: w.fiftyFifty ?? [],
          explainer: w.explainer ?? null,
        }));
        // Create the history entry first so we have an id to update later
        const id = addEntry(pendingThoughtRef.current, mapped);
        entryIdRef.current = id;
        recordReflection();
        setStreakJustIncremented(true);
        // Transition GameContext to the "cloud" (annotation review) screen
        setWords(mapped);
      },
      onError(err: unknown) {
        console.error("Reframe error:", err);
      },
    },
  });

  /**
   * Sync reframedWords back to HistoryContext whenever the user completes or
   * skips a word in the GamePanel. This keeps the history entry's reframedWords
   * map up to date so the HistoryScreen progress badge is accurate.
   *
   * The dep array intentionally omits `entryIdRef` and `updateEntry` because:
   * - refs don't trigger re-renders
   * - updateEntry is stable (wrapped in useCallback with no deps)
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
    pendingThoughtRef.current = text;
    mutation.mutate({ data: { thought: text } });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CaptureScreen
        onSubmit={handleSubmitThought}
        isLoading={mutation.isPending}
        streakJustIncremented={streakJustIncremented}
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
