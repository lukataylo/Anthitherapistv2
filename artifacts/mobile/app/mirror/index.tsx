/**
 * Mirror tab — unified self-reflection space.
 *
 * Combines spirit animal, insights, flashcards preview, and history
 * into a single scrollable feed. Replaces the old standalone flashcards
 * tab and the old history screen.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useHistory, type HistoryEntry } from "@/context/HistoryContext";
import { InsightsSection } from "@/components/InsightsSection";
import { SpiritAnimalCard } from "@/components/SpiritAnimalCard";
import { useChapter } from "@/context/ChapterContext";
import { CHAPTERS } from "@/data/chapters";

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function ProgressBadge({
  reframed,
  total,
}: {
  reframed: number;
  total: number;
}) {
  const done = total > 0 && reframed >= total;
  return (
    <View style={[styles.badge, done ? styles.badgeDone : styles.badgePartial]}>
      <Text style={styles.badgeText}>
        {done ? "Complete" : `${reframed}/${total}`}
      </Text>
    </View>
  );
}

function buildReframedThought(entry: HistoryEntry): string {
  if (Object.keys(entry.reframedWords).length === 0) {
    return entry.thought;
  }
  return entry.words
    .map((w, i) =>
      entry.reframedWords[i] !== undefined ? entry.reframedWords[i] : w.word
    )
    .join(" ");
}

// ── Entry Card ──────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPress,
  onDelete,
}: {
  entry: HistoryEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const sigWords = entry.words.filter((w) => w.category !== "neutral");
  const reframedCount = Object.keys(entry.reframedWords).filter((idx) => {
    const word = entry.words[Number(idx)];
    return word && word.category !== "neutral";
  }).length;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardThought} numberOfLines={2}>
          {buildReframedThought(entry)}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardTime}>{timeAgo(entry.savedAt)}</Text>
        {sigWords.length > 0 && (
          <ProgressBadge reframed={reframedCount} total={sigWords.length} />
        )}
      </View>
    </Pressable>
  );
}

// ── Mood Sparkline ──────────────────────────────────────────────────────

function MoodSummary() {
  const { state } = useChapter();
  const recentMoods = state.moodLog.slice(-14);
  if (recentMoods.length === 0) return null;

  const moodCounts: Record<string, number> = {};
  recentMoods.forEach((m) => {
    moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
  });

  const EMOJIS: Record<string, string> = {
    happy: "😊",
    okay: "😐",
    sad: "😢",
    stressed: "😰",
    angry: "😤",
  };

  const sorted = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.moodSummary}>
      <Text style={styles.sectionHeading}>RECENT MOODS</Text>
      <View style={styles.moodChips}>
        {sorted.map(([mood, count]) => (
          <View key={mood} style={styles.moodChip}>
            <Text style={styles.moodEmoji}>{EMOJIS[mood] || "❓"}</Text>
            <Text style={styles.moodCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="leaf-outline" size={48} color="rgba(255,255,255,0.12)" />
      <Text style={styles.emptyTitle}>No reflections yet</Text>
      <Text style={styles.emptySubtitle}>
        Your past thought reframes will appear here
      </Text>
    </View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function MirrorScreen() {
  const insets = useSafeAreaInsets();
  const { entries, removeEntry } = useHistory();
  const router = useRouter();

  const handlePress = useCallback(
    (entry: HistoryEntry) => {
      router.push(`/mirror/${entry.id}`);
    },
    [router]
  );

  const handleDelete = useCallback(
    (entry: HistoryEntry) => {
      Alert.alert("Remove reflection?", `"${entry.thought.slice(0, 60)}..."`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeEntry(entry.id),
        },
      ]);
    },
    [removeEntry]
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Mirror</Text>
        <Text style={styles.subtitle}>
          {entries.length > 0
            ? `${entries.length} reflection${entries.length !== 1 ? "s" : ""}`
            : "Self-reflection"}
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 20 },
        ]}
        ListHeaderComponent={
          <>
            <SpiritAnimalCard />
            <MoodSummary />
            <InsightsSection entries={entries} />
            {entries.length > 0 && (
              <Text style={styles.sectionHeading}>REFLECTIONS</Text>
            )}
          </>
        }
        ListEmptyComponent={EmptyState}
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            onPress={() => handlePress(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 16,
    flexGrow: 1,
    gap: 0,
  },
  sectionHeading: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2.5,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // Cards
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardPressed: {
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardThought: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.88)",
    lineHeight: 21,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeDone: {
    backgroundColor: "rgba(34,197,94,0.18)",
  },
  badgePartial: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
  },
  separator: {
    height: 8,
  },

  // Mood summary
  moodSummary: {
    gap: 8,
    marginTop: 12,
  },
  moodChips: {
    flexDirection: "row",
    gap: 8,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  moodEmoji: {
    fontSize: 14,
  },
  moodCount: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.35)",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    maxWidth: 220,
  },
});
