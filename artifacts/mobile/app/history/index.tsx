/**
 * History screen — the second tab.
 *
 * Displays two things:
 *  1. A horizontal mini-game carousel at the top of the list
 *  2. A chronological feed of past reflection entries
 *
 * Each entry card shows the original thought, a relative timestamp, and a
 * progress badge indicating how many of the distorted words have been reframed.
 * Tapping a card reloads that session in GameContext and navigates to the
 * Reframe tab so the user can continue. Long-pressing prompts deletion.
 *
 * ## Mini-game dispatch
 *
 * Five mini-games are rendered as full-screen modals, each controlled by a
 * separate boolean visibility state. The `handleGamePress` callback maps game
 * ids (from GameCarousel's GAMES list) to the right visibility toggle. This
 * keeps the game components decoupled from the carousel — they receive entries
 * and an onClose callback, nothing else.
 *
 * ## Streak cards
 *
 * The header shows three streak/stats cards: current streak, best streak, and
 * total reflections. The current streak card turns amber when the user has
 * reflected today, providing immediate visual confirmation of the habit.
 *
 * ## ProgressBadge logic
 *
 * Only significant (non-neutral) words count toward the progress fraction.
 * A reframe counts even if the user skipped (which stores the original word
 * in reframedWords) because the CBT goal of reviewing the word has been met.
 *
 * ## timeAgo helper
 *
 * Converts a Unix timestamp to a human-readable relative string. Returns
 * "just now" for anything under a minute to avoid displaying "0m ago".
 */

import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHistory, type HistoryEntry } from "@/context/HistoryContext";
import { useStreak } from "@/context/StreakContext";
import { SortTowerGame } from "@/components/SortTowerGame";
import { RocketGame } from "@/components/RocketGame";
import { ThoughtCheckGame } from "@/components/ThoughtCheckGame";
import { SailGame } from "@/components/SailGame";
import { RewordGame } from "@/components/RewordGame";
import { GameCarousel } from "@/components/GameCarousel";

/** Converts a Unix timestamp to a short relative time string. */
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

/**
 * Shows a "Complete" pill when all significant words are reframed, otherwise
 * shows the fraction (e.g. "2/5") with a subtle background.
 */
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

/**
 * A single history entry card.
 *
 * - `onPress`    — load the session in GameContext and navigate to Reframe
 * - `onDelete`   — long-press handler, surfaced to the parent which shows Alert
 */
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
  // Only count reframedWords entries that correspond to significant words —
  // neutral words may have stale entries from earlier sessions
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
          {entry.thought}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color="rgba(255,255,255,0.25)"
        />
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

/** Shown when the entries list is empty — no reflections yet. */
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

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { entries, removeEntry } = useHistory();
  const { currentStreak, longestStreak, reflectedToday } = useStreak();
  const router = useRouter();

  // Each mini-game is a full-screen modal — visibility is toggled independently
  const [practiceVisible, setPracticeVisible] = useState(false);
  const [rocketVisible, setRocketVisible] = useState(false);
  const [thoughtCheckVisible, setThoughtCheckVisible] = useState(false);
  const [sailVisible, setSailVisible] = useState(false);
  const [rewordVisible, setRewordVisible] = useState(false);

  /** Map game carousel ids to the correct modal visibility toggle. */
  const handleGamePress = useCallback(
    (id: string) => {
      if (id === "sort-tower") setPracticeVisible(true);
      if (id === "rocket-reframe") setRocketVisible(true);
      if (id === "thought-check") setThoughtCheckVisible(true);
      if (id === "mind-voyage") setSailVisible(true);
      if (id === "reword") setRewordVisible(true);
    },
    []
  );

  /** Navigate to the detail screen for this history entry. */
  const handlePress = useCallback(
    (entry: HistoryEntry) => {
      router.push(`/history/${entry.id}`);
    },
    [router]
  );

  /** Confirm deletion with an Alert before removing from HistoryContext. */
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

      {/* Mini-game modals — always mounted so they can initialise state before becoming visible */}
      <SortTowerGame
        visible={practiceVisible}
        entries={entries}
        onClose={() => setPracticeVisible(false)}
      />
      <RocketGame
        visible={rocketVisible}
        entries={entries}
        onClose={() => setRocketVisible(false)}
      />
      <ThoughtCheckGame
        visible={thoughtCheckVisible}
        entries={entries}
        onClose={() => setThoughtCheckVisible(false)}
      />
      <SailGame
        visible={sailVisible}
        entries={entries}
        onClose={() => setSailVisible(false)}
      />
      <RewordGame
        visible={rewordVisible}
        entries={entries}
        onClose={() => setRewordVisible(false)}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>
              {entries.length > 0
                ? `${entries.length} reflection${entries.length !== 1 ? "s" : ""}`
                : ""}
            </Text>
          </View>
        </View>

        {/* Streak stat cards — the first card turns amber when reflectedToday */}
        <View style={styles.streakRow}>
          <View style={[styles.streakCard, reflectedToday && styles.streakCardActive]}>
            <Ionicons name="flame" size={18} color={reflectedToday ? "#FF9500" : "rgba(255,255,255,0.3)"} />
            <Text style={[styles.streakNum, reflectedToday && styles.streakNumActive]}>
              {currentStreak}
            </Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Ionicons name="trophy-outline" size={18} color="rgba(255,255,255,0.3)" />
            <Text style={styles.streakNum}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>best streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Ionicons name="chatbubble-outline" size={18} color="rgba(255,255,255,0.3)" />
            <Text style={styles.streakNum}>{entries.length}</Text>
            <Text style={styles.streakLabel}>total</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 20 },
        ]}
        ListHeaderComponent={
          <GameCarousel onGamePress={handleGamePress} />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
  },
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
  streakRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  streakCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  streakCardActive: {
    backgroundColor: "rgba(255,149,0,0.1)",
    borderColor: "rgba(255,149,0,0.2)",
  },
  streakNum: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.6)",
  },
  streakNumActive: {
    color: "#FF9500",
  },
  streakLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 100,
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
