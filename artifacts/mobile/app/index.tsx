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
  const entryIdRef = useRef<string | null>(null);
  const pendingThoughtRef = useRef<string>("");
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);

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
        const id = addEntry(pendingThoughtRef.current, mapped);
        entryIdRef.current = id;
        recordReflection();
        setStreakJustIncremented(true);
        setWords(mapped);
      },
      onError(err: unknown) {
        console.error("Reframe error:", err);
      },
    },
  });

  useEffect(() => {
    if (entryIdRef.current && words.length > 0) {
      updateEntry(entryIdRef.current, reframedWords);
    }
  }, [reframedWords]);

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
