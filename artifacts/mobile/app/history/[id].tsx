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

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useGame, type WordAnalysis } from "@/context/GameContext";
import { reflectOnSession } from "@workspace/api-client-react";

/** Colour mapping for each distortion category — matches the Reframe tab palette. */
const CATEGORY_COLORS: Record<string, string> = {
  absolute: "#F59E0B",
  belief: "#EF4444",
  fear: "#8B5CF6",
  self_judgment: "#EC4899",
  neutral: "transparent",
};

/** Human-readable labels for each distortion category. */
const CATEGORY_LABELS: Record<string, string> = {
  absolute: "Absolute",
  belief: "Core Belief",
  fear: "Fear",
  self_judgment: "Self-Judgment",
  neutral: "Neutral",
};

/**
 * Renders the original thought with distorted words highlighted and their
 * chosen reframes shown beneath as inline green replacements.
 */
function AnnotatedThought({
  words,
  reframedWords,
}: {
  words: WordAnalysis[];
  reframedWords: Record<number, string>;
}) {
  return (
    <View style={styles.annotatedContainer}>
      <View style={styles.wordFlow}>
        {words.map((w, idx) => {
          const isSignificant = w.category !== "neutral";
          const reframe = reframedWords[idx];
          const hasReframe = reframe && reframe !== w.word;
          const color = CATEGORY_COLORS[w.category] ?? "transparent";

          if (!isSignificant) {
            return (
              <Text key={idx} style={styles.neutralWord}>
                {w.word}{" "}
              </Text>
            );
          }

          return (
            <View key={idx} style={styles.wordGroup}>
              <View style={[styles.wordHighlight, { borderColor: color + "66", backgroundColor: color + "22" }]}>
                <Text style={[styles.distortedWord, { color: color }]}>{w.word}</Text>
              </View>
              {hasReframe && (
                <Text style={styles.reframeWord}>{reframe}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * A single "What changed" breakdown card for one reframed word.
 */
function WordBreakdownCard({
  word,
  category,
  reframe,
  explainer,
}: {
  word: string;
  category: string;
  reframe: string | undefined;
  explainer: string | null | undefined;
}) {
  const color = CATEGORY_COLORS[category] ?? "#888";
  const label = CATEGORY_LABELS[category] ?? category;
  const reframeChanged = reframe && reframe !== word;

  return (
    <View style={styles.breakdownCard}>
      <View style={styles.breakdownHeader}>
        <Text style={styles.breakdownOriginal}>"{word}"</Text>
        <View style={[styles.categoryBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
          <Text style={[styles.categoryBadgeText, { color }]}>{label}</Text>
        </View>
      </View>
      {reframeChanged && (
        <View style={styles.breakdownReframeRow}>
          <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={styles.breakdownReframe}>"{reframe}"</Text>
        </View>
      )}
      {explainer && (
        <Text style={styles.breakdownExplainer}>{explainer}</Text>
      )}
    </View>
  );
}

/**
 * The Insight section — fetches an LLM-generated paragraph on mount, with
 * a loading skeleton and error fallback.
 */
function InsightSection({
  thought,
  words,
  reframedWords,
}: {
  thought: string;
  words: WordAnalysis[];
  reframedWords: Record<number, string>;
}) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reframedWordsStringKeys: Record<string, string> = {};
    for (const [k, v] of Object.entries(reframedWords)) {
      reframedWordsStringKeys[String(k)] = v;
    }

    reflectOnSession({ thought, words, reframedWords: reframedWordsStringKeys })
      .then((data) => {
        if (!cancelled) {
          setInsight(data.insight);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.insightSection}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="sparkles" size={15} color="#A78BFA" />
        <Text style={styles.sectionTitle}>Insight</Text>
      </View>
      {loading && (
        <View style={styles.insightLoading}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.insightLoadingText}>Generating insight…</Text>
        </View>
      )}
      {error && !loading && (
        <View style={styles.insightError}>
          <Ionicons name="alert-circle-outline" size={18} color="rgba(255,255,255,0.3)" />
          <Text style={styles.insightErrorText}>
            Unable to generate insight right now. Please try again later.
          </Text>
        </View>
      )}
      {insight && !loading && (
        <Text style={styles.insightText}>{insight}</Text>
      )}
    </View>
  );
}

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries } = useHistory();
  const { loadSession } = useGame();

  const entry = entries.find((e) => e.id === id);

  if (!entry) {
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

  const sigWords = entry.words.filter((w) => w.category !== "neutral");
  const reframedSigCount = Object.keys(entry.reframedWords).filter((idx) => {
    const word = entry.words[Number(idx)];
    return word && word.category !== "neutral";
  }).length;
  const isComplete = sigWords.length > 0 && reframedSigCount >= sigWords.length;

  const handleContinue = () => {
    loadSession(entry.thought, entry.words, entry.reframedWords);
    router.push("/");
  };

  const reframedSigWords = sigWords.map((w) => {
    const idx = entry.words.indexOf(w);
    return { word: w, idx, reframe: entry.reframedWords[idx] };
  });

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
          <Text style={styles.sectionTitle}>Your thought</Text>
          <AnnotatedThought words={entry.words} reframedWords={entry.reframedWords} />
        </View>

        {reframedSigWords.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="swap-horizontal" size={15} color="rgba(255,255,255,0.5)" />
              <Text style={styles.sectionTitle}>What changed</Text>
            </View>
            <View style={styles.breakdownList}>
              {reframedSigWords.map(({ word: w, idx, reframe }) => (
                <WordBreakdownCard
                  key={idx}
                  word={w.word}
                  category={w.category}
                  reframe={reframe}
                  explainer={w.explainer}
                />
              ))}
            </View>
          </View>
        )}

        <InsightSection
          thought={entry.thought}
          words={entry.words}
          reframedWords={entry.reframedWords}
        />

        {!isComplete && sigWords.length > 0 && (
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
          >
            <Ionicons name="play" size={16} color="#000" />
            <Text style={styles.continueBtnText}>Continue session</Text>
          </Pressable>
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
  wordFlow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    alignItems: "flex-start",
  },
  neutralWord: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 28,
  },
  wordGroup: {
    alignItems: "center",
    gap: 3,
  },
  wordHighlight: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  distortedWord: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 24,
  },
  reframeWord: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#34D399",
    letterSpacing: 0.1,
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
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  breakdownReframeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breakdownReframe: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#34D399",
  },
  breakdownExplainer: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 19,
  },
  insightSection: {
    backgroundColor: "rgba(167,139,250,0.07)",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167,139,250,0.15)",
  },
  insightLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  insightLoadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(167,139,250,0.6)",
  },
  insightError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  insightErrorText: {
    flex: 1,
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
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#34D399",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  continueBtnPressed: {
    backgroundColor: "#2BBD85",
  },
  continueBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
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
