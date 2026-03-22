/**
 * ReframeCloudScreen — the annotated thought view shown after a thought is submitted
 * for reframing.
 *
 * Rendered when GameContext.screen === "cloud". Shows:
 *  - The ThinkingAnimation while AI enrichment is in-flight (isEnriching = true)
 *  - The AnnotatedThought with highlighted distorted words once enrichment resolves
 *  - A dismissible offline banner when the API call failed and local patterns are used
 *  - Progress indicator: how many significant words have been reframed
 *  - A quit button to return to the capture screen
 */

import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { AnnotatedThought } from "@/components/AnnotatedThought";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";
import { GamePanel } from "@/components/GamePanel";

export function ReframeCloudScreen() {
  const {
    thought,
    words,
    reframedWords,
    isEnriching,
    offlineMode,
    openGame,
    goToCapture,
    significantWords,
    reframedCount,
    totalSignificant,
    allDone,
  } = useGame();

  const insets = useSafeAreaInsets();
  const [offlineDismissed, setOfflineDismissed] = useState(false);

  const showOfflineBanner = offlineMode && !isEnriching && !offlineDismissed;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={goToCapture}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          accessibilityLabel="Back to capture"
          accessibilityRole="button"
        >
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
          </View>
        </Pressable>

        {!isEnriching && totalSignificant > 0 && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {allDone ? "Complete" : `${reframedCount}/${totalSignificant}`}
            </Text>
          </View>
        )}
      </View>

      {showOfflineBanner && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.offlineBanner}
        >
          <Ionicons name="cloud-offline-outline" size={14} color="rgba(255,255,255,0.45)" />
          <Text style={styles.offlineBannerText}>Working offline — AI insights unavailable</Text>
          <Pressable
            onPress={() => setOfflineDismissed(true)}
            hitSlop={10}
            accessibilityLabel="Dismiss offline notice"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.35)" />
          </Pressable>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isEnriching ? (
          <View style={styles.thinkingContainer}>
            <ThinkingAnimation />
          </View>
        ) : (
          <View style={styles.thoughtContainer}>
            <AnnotatedThought
              thought={thought}
              words={words}
              reframedWords={reframedWords}
              onWordPress={openGame}
            />
            {totalSignificant === 0 && (
              <Text style={styles.noDistortionsText}>
                No cognitive distortions detected in this thought.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <GamePanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  progressText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  offlineBannerText: {
    flex: 1,
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  thinkingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  thoughtContainer: {
    flex: 1,
  },
  noDistortionsText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 24,
    textAlign: "center",
    fontStyle: "italic",
  },
});
