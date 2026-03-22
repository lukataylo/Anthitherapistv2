import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { CaptureScreen } from "@/components/CaptureScreen";
import { ReframeCloudScreen } from "@/components/ReframeCloudScreen";
import { useGame } from "@/context/GameContext";

export default function HomeScreen() {
  const { screen } = useGame();

  const showReframeFlow = screen === "cloud" || screen === "game";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {showReframeFlow ? <ReframeCloudScreen /> : <CaptureScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
