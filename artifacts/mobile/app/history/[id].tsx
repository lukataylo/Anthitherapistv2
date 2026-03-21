/**
 * History detail screen — shows a rich annotated view of a past reframing session.
 *
 * ## Sections
 *
 * 1. **Annotated thought** — the original text with each significant word
 *    highlighted in its distortion colour. The chosen reframe appears beneath
 *    each highlighted word in green, matching the style of the Reframe tab's
 *    cloud view.
 *
 * 2. **What changed** — a per-word breakdown card for every reframed significant
 *    word, showing: original word, distortion category badge, chosen reframe,
 *    and the one-sentence explainer from the word analysis.
 *
 * 3. **Insight** — an LLM-generated paragraph fetched fresh on mount from
 *    POST /api/reflect. Shows a loading skeleton while fetching and a graceful
 *    error state if the request fails.
 *
 * 4. **Continue session** button — only shown for incomplete entries (not all
 *    significant words reframed). Loads the session into GameContext and
 *    navigates to the Reframe tab.
 *
 * ## Navigation
 *
 * Reached via `router.push('/history/<id>')` from the history list. The entry
 * id is read from the URL params via `useLocalSearchParams`. If the id doesn't
 * match any entry, a "not found" message is shown.
 */

import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHistory } from "@/context/HistoryContext";

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessions } = useHistory();

  const session = sessions.find((e) => e.id === id);

  if (!session) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <Text style={styles.notFoundText}>Reflection not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const payload = session.feedbackPayload;
  const highlights = payload?.highlights ?? [];
  const prompts = payload?.reflectionPrompts ?? [];
  const emotions = payload?.dominantEmotions ?? [];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <Text style={styles.headerTitle}>Reflection</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session summary</Text>
          <View style={styles.annotatedContainer}>
            <Text style={styles.insightText}>Status: {session.status}</Text>
            <Text style={styles.insightText}>Turns: {session.turnCount}</Text>
            {emotions.length > 0 ? (
              <Text style={styles.insightText}>Dominant emotions: {emotions.join(", ")}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language patterns</Text>
          <View style={styles.breakdownList}>
            {highlights.length === 0 ? (
              <Text style={styles.insightErrorText}>No highlights for this session.</Text>
            ) : (
              highlights.map((h, idx) => (
                <View key={`${h.turnId}-${idx}`} style={styles.breakdownCard}>
                  <Text style={styles.breakdownOriginal}>"{h.matchedText}"</Text>
                  <Text style={styles.breakdownExplainer}>{h.categoryLabel}</Text>
                  <Text style={styles.breakdownExplainer}>{h.reframeHint}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {prompts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Something to sit with</Text>
            <View style={styles.breakdownList}>
              {prompts.map((p, idx) => (
                <View key={idx} style={styles.breakdownCard}>
                  <Text style={styles.insightText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  annotatedContainer: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  breakdownList: {
    gap: 10,
  },
  breakdownCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  breakdownOriginal: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
    flex: 1,
  },
  breakdownExplainer: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 19,
  },
  insightErrorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    lineHeight: 20,
  },
  insightText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 23,
  },
  notFoundText: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
});
