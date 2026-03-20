import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { CloudScreen } from "@/components/CloudScreen";
import { useReframeThought, type ReframeResponse } from "@workspace/api-client-react";

export default function HomeScreen() {
  const { screen, setWords } = useGame();

  const mutation = useReframeThought({
    mutation: {
      onSuccess(data: ReframeResponse) {
        setWords(
          data.words.map((w) => ({
            word: w.word,
            category: w.category ?? "neutral",
            reframes: w.reframes ?? [],
            hint: w.hint ?? null,
            fiftyFifty: w.fiftyFifty ?? [],
            explainer: w.explainer ?? null,
          }))
        );
      },
      onError(err: unknown) {
        console.error("Reframe error:", err);
      },
    },
  });

  const handleSubmitThought = (thought: string) => {
    mutation.mutate({ data: { thought } });
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
          isLoading={mutation.isPending}
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
