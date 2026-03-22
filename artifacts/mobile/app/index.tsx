import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { TodayScreen } from "@/components/TodayScreen";

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <TodayScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
