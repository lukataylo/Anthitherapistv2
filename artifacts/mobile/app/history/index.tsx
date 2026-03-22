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

import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { useHistory, type HistoryEntry } from "@/context/HistoryContext";
import { useSpiritAnimal } from "@/context/SpiritAnimalContext";
import { useAuth } from "@/context/AuthContext";
import { SortTowerGame } from "@/components/SortTowerGame";
import { RocketGame } from "@/components/RocketGame";
import { ThoughtCheckGame } from "@/components/ThoughtCheckGame";
import { SailGame } from "@/components/SailGame";
import { RewordGame } from "@/components/RewordGame";
import { GameCarousel } from "@/components/GameCarousel";
import { InsightsSection } from "@/components/InsightsSection";
import { GameIntroScreen, type GameIntroDef } from "@/components/GameIntroScreen";

/** Metadata for the intro screen of each mini-game.
 * accent colors and bg values are kept in sync with GameCarousel's GAMES list. */
const GAME_INTROS: Record<string, GameIntroDef> = {
  "sort-tower": {
    id: "sort-tower",
    name: "Sort Tower",
    icon: "layers",
    aim: "Build a tower by quickly sorting words into distorted or positive categories.",
    mechanics: [
      "Swipe LEFT to classify a word as a cognitive distortion.",
      "Swipe RIGHT to classify a word as a healthy, positive thought.",
      "Every correct sort adds a floor to your tower — aim for the spire!",
    ],
    accentColor: "#1E4A6E",
    bg: "#0C1E2E",
  },
  "rocket-reframe": {
    id: "rocket-reframe",
    name: "Rocket Reframe",
    icon: "rocket",
    aim: "Keep your rocket airborne by choosing the best reframe for each distorted word before gravity wins.",
    mechanics: [
      "A distorted word appears — pick the healthier replacement from two options.",
      "A correct answer boosts the rocket upward; a wrong answer costs a life.",
      "Answer fast for bonus points — speed matters!",
    ],
    accentColor: "#00557A",
    bg: "#020D1A",
  },
  "reality-check": {
    id: "reality-check",
    name: "Reality Check",
    icon: "checkmark-circle-outline",
    aim: "Train your awareness by deciding whether each thought is distorted or healthy.",
    mechanics: [
      "Read the thought shown on screen.",
      "Tap DISTORTED if it contains cognitive distortions, or HEALTHY if it is balanced.",
      "Wrong answers reveal an explanation so you learn — and cost you a life.",
    ],
    accentColor: "#007A62",
    bg: "#001A14",
  },
  "mind-voyage": {
    id: "mind-voyage",
    name: "Mind Voyage",
    icon: "boat-outline",
    aim: "Sail across the sea by pinpointing the exact distorted word hiding in each thought.",
    mechanics: [
      "One word in each thought is highlighted — decide if it is an ERROR or VALID.",
      "Every correct answer advances your sailboat toward the far shore.",
      "Wrong answers show why the word is or isn't distorted, teaching as you go.",
    ],
    accentColor: "#00B5AA",
    bg: "#002E2A",
  },
  reword: {
    id: "reword",
    name: "Reword",
    icon: "swap-horizontal-outline",
    aim: "Pick the best word to replace a cognitive distortion from three options on the tree.",
    mechanics: [
      "A distorted word sits at the root — three possible reframes branch below it.",
      "Tap the one that best softens the distortion without replacing it with another.",
      "Build combos with consecutive correct answers for a score multiplier.",
    ],
    accentColor: "#8A2050",
    bg: "#160A1C",
  },
};

/** Launches the actual game modal for the given game id. */
function openGameById(
  id: string,
  setters: {
    setPracticeVisible: (v: boolean) => void;
    setRocketVisible: (v: boolean) => void;
    setThoughtCheckVisible: (v: boolean) => void;
    setSailVisible: (v: boolean) => void;
    setRewordVisible: (v: boolean) => void;
  }
) {
  if (id === "sort-tower") setters.setPracticeVisible(true);
  if (id === "rocket-reframe") setters.setRocketVisible(true);
  if (id === "reality-check") setters.setThoughtCheckVisible(true);
  if (id === "mind-voyage") setters.setSailVisible(true);
  if (id === "reword") setters.setRewordVisible(true);
}

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
/**
 * Reconstructs the thought sentence with reframed words substituted in.
 * Iterates over `entry.words`, replaces index `i` with `reframedWords[i]`
 * when present, and joins to produce the display string.
 * Falls back to the original `thought` if `reframedWords` is empty.
 */
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
          {buildReframedThought(entry)}
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

/** Profile button — compact top-right header button.
 *  Shows spirit animal SVG if one exists, otherwise a person icon.
 *  Navigates to the unified profile screen (login + spirit animal). */
function ProfileButton({ onPress }: { onPress: () => void }) {
  const { spiritAnimal } = useSpiritAnimal();
  const { user } = useAuth();

  if (spiritAnimal) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.spiritBtn, pressed && styles.spiritBtnPressed]}
      >
        <View style={styles.spiritBtnAvatar}>
          <SvgXml xml={spiritAnimal.svg} width={18} height={18} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.spiritBtn, pressed && styles.spiritBtnPressed]}
    >
      <Ionicons
        name={user ? "person" : "person-outline"}
        size={18}
        color="rgba(255,255,255,0.5)"
      />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { entries, removeEntry } = useHistory();
  const router = useRouter();
  const params = useLocalSearchParams<{ game?: string }>();

  const [practiceVisible, setPracticeVisible] = useState(false);
  const [rocketVisible, setRocketVisible] = useState(false);
  const [thoughtCheckVisible, setThoughtCheckVisible] = useState(false);
  const [sailVisible, setSailVisible] = useState(false);
  const [rewordVisible, setRewordVisible] = useState(false);

  const [introGameId, setIntroGameId] = useState<string | null>(null);
  const introGame = introGameId ? GAME_INTROS[introGameId] ?? null : null;

  const gameSetters = {
    setPracticeVisible,
    setRocketVisible,
    setThoughtCheckVisible,
    setSailVisible,
    setRewordVisible,
  };

  useEffect(() => {
    if (params.game) {
      const id = params.game;
      if (id === "sort-tower") setPracticeVisible(true);
      if (id === "rocket-reframe") setRocketVisible(true);
      if (id === "reality-check") setThoughtCheckVisible(true);
      if (id === "mind-voyage") setSailVisible(true);
      if (id === "reword") setRewordVisible(true);
    }
  }, [params.game]);

  /** Open the game's intro screen first, rather than jumping straight into gameplay. */
  const handleGamePress = useCallback(
    (id: string) => {
      if (GAME_INTROS[id]) {
        setIntroGameId(id);
      } else {
        openGameById(id, gameSetters);
      }
    },
    []
  );

  /** Called when the user presses Play in the intro screen. */
  const handleIntroPlay = useCallback(() => {
    const id = introGameId;
    setIntroGameId(null);
    if (id) openGameById(id, gameSetters);
  }, [introGameId]);

  /** Navigate to the profile screen (login + spirit animal). */
  const handleProfilePress = useCallback(() => {
    router.push("/profile");
  }, [router]);

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

      {/* Game intro overlay — shown before the user enters any game */}
      {introGame && (
        <GameIntroScreen
          {...introGame}
          visible={!!introGame}
          onPlay={handleIntroPlay}
          onClose={() => setIntroGameId(null)}
        />
      )}

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
          <ProfileButton onPress={handleProfilePress} />
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
          <>
            <InsightsSection entries={entries} />
            <GameCarousel onGamePress={handleGamePress} />
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
    alignItems: "center",
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
  spiritBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  spiritBtnPressed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  spiritBtnAvatar: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
