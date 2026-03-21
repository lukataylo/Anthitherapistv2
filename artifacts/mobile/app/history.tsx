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
import { useGame } from "@/context/GameContext";
import { useStreak } from "@/context/StreakContext";
import { SortTowerGame } from "@/components/SortTowerGame";
import { RocketGame } from "@/components/RocketGame";
import { ThoughtCheckGame } from "@/components/ThoughtCheckGame";
import { SailGame } from "@/components/SailGame";
import { RewordGame } from "@/components/RewordGame";
import { GameCarousel } from "@/components/GameCarousel";

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
  const { loadSession } = useGame();
  const { currentStreak, longestStreak, reflectedToday } = useStreak();
  const router = useRouter();
  const [practiceVisible, setPracticeVisible] = useState(false);
  const [rocketVisible, setRocketVisible] = useState(false);
  const [thoughtCheckVisible, setThoughtCheckVisible] = useState(false);
  const [sailVisible, setSailVisible] = useState(false);
  const [rewordVisible, setRewordVisible] = useState(false);

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

  const handlePress = useCallback(
    (entry: HistoryEntry) => {
      loadSession(entry.thought, entry.words, entry.reframedWords);
      router.push("/");
    },
    [loadSession, router]
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
