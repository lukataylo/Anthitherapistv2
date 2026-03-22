/**
 * SpiritAnimalCard — large spirit animal display card for the Mirror tab.
 *
 * Shows the user's spirit animal avatar, name, and description if they've
 * completed the quiz. Otherwise shows a CTA to discover their guide.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useSpiritAnimal } from "@/context/SpiritAnimalContext";

export function SpiritAnimalCard() {
  const { spiritAnimal } = useSpiritAnimal();
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/spirit-animal-quiz");
  };

  if (!spiritAnimal) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, styles.emptyCard, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.emptyIcon}>
          <Ionicons name="sparkles-outline" size={24} color="rgba(255,255,255,0.4)" />
        </View>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyTitle}>Discover your guide</Text>
          <Text style={styles.emptyDesc}>
            Take a short quiz to find your spirit animal — a companion for your journey.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.avatarWrap}>
        <SvgXml xml={spiritAnimal.svg} width={48} height={48} />
      </View>
      <View style={styles.animalContent}>
        <Text style={styles.guideLabel}>YOUR GUIDE</Text>
        <Text style={styles.animalName}>{spiritAnimal.animal}</Text>
        <Text style={styles.animalDesc} numberOfLines={2}>
          {spiritAnimal.description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  emptyCard: {
    backgroundColor: "rgba(155,92,246,0.04)",
    borderColor: "rgba(155,92,246,0.12)",
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContent: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
  },
  emptyDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    lineHeight: 17,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  animalContent: {
    flex: 1,
    gap: 2,
  },
  guideLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 2,
  },
  animalName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  animalDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 17,
  },
});
