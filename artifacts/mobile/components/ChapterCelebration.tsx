/**
 * ChapterCelebration — full-screen modal shown when a chapter is completed.
 *
 * Features a spring-scaled entrance, chapter trophy icon, spirit animal
 * message (if available), and a button to continue to the next chapter.
 */

import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SvgXml } from "react-native-svg";
import { Colors } from "@/constants/colors";
import { useChapter } from "@/context/ChapterContext";
import { useSpiritAnimal } from "@/context/SpiritAnimalContext";
import { CHAPTERS } from "@/data/chapters";

export function ChapterCelebration() {
  const {
    showCelebration,
    dismissCelebration,
    activeChapter,
  } = useChapter();
  const { spiritAnimal } = useSpiritAnimal();

  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (showCelebration) {
      scale.value = withSpring(1, { damping: 12, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 300 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [showCelebration]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!showCelebration) return null;

  // Find the chapter that was just completed (the one before the active)
  const activeIdx = CHAPTERS.findIndex((c) => c.id === activeChapter.id);
  const completedChapter =
    activeIdx > 0 ? CHAPTERS[activeIdx - 1] : CHAPTERS[0];
  const nextChapter = activeChapter;

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withTiming(0.3, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 });
    setTimeout(dismissCelebration, 220);
  };

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, animStyle]}>
          {/* Trophy */}
          <View
            style={[
              styles.trophyWrap,
              { backgroundColor: completedChapter.accentColor + "22" },
            ]}
          >
            <Ionicons
              name="trophy"
              size={36}
              color={completedChapter.accentColor}
            />
          </View>

          <Text style={styles.congrats}>Chapter Complete!</Text>
          <Text style={styles.chapterName}>
            {completedChapter.title}
          </Text>

          {/* Spirit animal message */}
          {spiritAnimal && (
            <View style={styles.guideRow}>
              <View style={styles.guideAvatar}>
                <SvgXml xml={spiritAnimal.svg} width={28} height={28} />
              </View>
              <Text style={styles.guideMessage}>
                "You've grown through this chapter. The next one awaits."
              </Text>
            </View>
          )}

          {/* Next chapter preview */}
          {activeIdx > 0 && (
            <View style={styles.nextPreview}>
              <Text style={styles.nextLabel}>UP NEXT</Text>
              <Text style={styles.nextTitle}>
                Chapter {nextChapter.number}: {nextChapter.title}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleDismiss}
            style={({ pressed }) => [
              styles.continueBtn,
              { backgroundColor: completedChapter.accentColor },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 340,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  trophyWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  congrats: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  chapterName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    width: "100%",
  },
  guideAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  guideMessage: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
    fontStyle: "italic",
  },
  nextPreview: {
    gap: 3,
    alignItems: "center",
    marginTop: 4,
  },
  nextLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 2,
  },
  nextTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
  },
  continueBtn: {
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  continueBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
});
