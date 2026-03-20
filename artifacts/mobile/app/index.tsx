import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { useGame, WordAnalysis } from "@/context/GameContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { CloudScreen } from "@/components/CloudScreen";

export default function HomeScreen() {
  const { screen, setWords } = useGame();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitThought = async (thought: string) => {
    setIsLoading(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const url = domain
        ? `https://${domain}/api/reframe`
        : "/api/reframe";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      if (!data.words || !Array.isArray(data.words)) {
        throw new Error("Unexpected response format");
      }

      const words: WordAnalysis[] = (data.words as WordAnalysis[]).map((w) => ({
        word: w.word,
        category: w.category ?? "neutral",
        reframes: w.reframes ?? [],
        hint: w.hint ?? null,
        fiftyFifty: w.fiftyFifty ?? [],
        explainer: w.explainer ?? null,
      }));

      setWords(words);
    } catch (err: unknown) {
      console.error("Reframe error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const showCloud = screen === "cloud" || screen === "game";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {showCloud ? (
        <CloudScreen />
      ) : (
        <CaptureScreen
          onSubmit={handleSubmitThought}
          isLoading={isLoading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
