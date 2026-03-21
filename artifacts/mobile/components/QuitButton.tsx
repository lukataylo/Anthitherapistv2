import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface QuitButtonProps {
  onQuit: () => void;
  isPlaying: boolean;
  tintColor?: string;
}

export function QuitButton({
  onQuit,
  isPlaying,
  tintColor = "rgba(255,255,255,0.38)",
}: QuitButtonProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  const handlePress = () => {
    if (isPlaying) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSheetVisible(true);
    } else {
      onQuit();
    }
  };

  const handleConfirmQuit = () => {
    setSheetVisible(false);
    setTimeout(() => {
      onQuit();
    }, 200);
  };

  const handleKeepPlaying = () => {
    setSheetVisible(false);
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        hitSlop={12}
        style={styles.quitBtn}
        accessibilityLabel="Quit game"
      >
        <Ionicons name="close" size={18} color={tintColor} />
      </Pressable>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleKeepPlaying}
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleKeepPlaying}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Quit game?</Text>
            <Text style={styles.sheetBody}>
              Your progress will not be saved.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.keepBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleKeepPlaying}
            >
              <Text style={styles.keepBtnText}>Keep playing</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.quitConfirmBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleConfirmQuit}
            >
              <Text style={styles.quitConfirmText}>Quit</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  quitBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1A1A2E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: "center",
    gap: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 24,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sheetBody: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 28,
  },
  keepBtn: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  keepBtnText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  quitConfirmBtn: {
    width: "100%",
    paddingVertical: 14,
    alignItems: "center",
  },
  quitConfirmText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
