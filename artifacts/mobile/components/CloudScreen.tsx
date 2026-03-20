import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { WordPill } from "@/components/WordPill";
import { GamePanel } from "@/components/GamePanel";

export function CloudScreen() {
  const {
    words,
    reframedWords,
    openGame,
    goToCapture,
    reframedCount,
    totalSignificant,
    allDone,
  } = useGame();
  const insets = useSafeAreaInsets();
  const fadeIn = useSharedValue(0);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 500 });
  }, []);

  useEffect(() => {
    if (allDone && totalSignificant > 0) {
      const t = setTimeout(() => setShowDone(true), 400);
      return () => clearTimeout(t);
    }
  }, [allDone, totalSignificant]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const handleWordPress = (wordIndex: number) => {
    if (reframedWords[wordIndex] !== undefined) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openGame(wordIndex);
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        <Pressable
          onPress={goToCapture}
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.counterArea}>
          <Text style={styles.counterText}>
            {reframedCount} of {totalSignificant} reframed
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    totalSignificant > 0
                      ? `${(reframedCount / totalSignificant) * 100}%`
                      : "0%",
                },
              ]}
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.cloudContainer,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pillsWrapper}>
          {words.map((word, idx) => {
            const isReframed = reframedWords[idx] !== undefined;
            const reframedWord = reframedWords[idx];
            return (
              <WordPill
                key={idx}
                word={word.word}
                category={word.category}
                isReframed={isReframed}
                reframedWord={reframedWord}
                onPress={() => handleWordPress(idx)}
                delay={idx * 60}
                isNeutral={word.category === "neutral"}
              />
            );
          })}
        </View>
      </ScrollView>

      {showDone && allDone && (
        <CompletionBanner onReset={goToCapture} insets={insets} />
      )}

      <GamePanel />
    </Animated.View>
  );
}

function CompletionBanner({
  onReset,
  insets,
}: {
  onReset: () => void;
  insets: { bottom: number };
}) {
  const slideAnim = useSharedValue(120);

  useEffect(() => {
    slideAnim.value = withSpring(0, { damping: 14, stiffness: 100 });
  }, []);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.completionBanner,
        { paddingBottom: insets.bottom + 20 },
        bannerStyle,
      ]}
    >
      <Text style={styles.completionTitle}>All reframed! 🌟</Text>
      <Text style={styles.completionSub}>
        You've challenged every distorted thought.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.resetBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={onReset}
      >
        <Text style={styles.resetText}>Analyse another thought</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  counterArea: {
    flex: 1,
    gap: 6,
  },
  counterText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  scrollArea: {
    flex: 1,
  },
  cloudContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  pillsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 0,
  },
  completionBanner: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  completionTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.success,
    letterSpacing: -0.5,
  },
  completionSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  resetBtn: {
    marginTop: 8,
    backgroundColor: Colors.successDim,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  resetText: {
    color: Colors.success,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
