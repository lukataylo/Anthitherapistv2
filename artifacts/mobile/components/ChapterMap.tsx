/**
 * ChapterMap — vertical chapter list for the Story tab.
 *
 * Displays all 8 chapters as large cards in a scrollable vertical list.
 * Each card shows the chapter theme, progress, activity type icons, and
 * lock state. The active chapter has a "Continue" button.
 */

import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";

import { Colors } from "@/constants/colors";
import { CHAPTERS, type ChapterDef, type ActivityType } from "@/data/chapters";
import { useChapter } from "@/context/ChapterContext";

// ── Decorative patterns (reused from GameCarousel) ──────────────────────

function ChevronsPattern({ color }: { color: string }) {
  const items = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      items.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            top: r * 38 - 10,
            left: c * 38 + 160,
            width: 22,
            height: 22,
            borderTopWidth: 1.5,
            borderRightWidth: 1.5,
            borderColor: color,
            opacity: 0.2,
            transform: [{ rotate: "45deg" }],
          }}
        />
      );
    }
  }
  return <>{items}</>;
}

function ArcsPattern({ color }: { color: string }) {
  const arcs = [
    { size: 180, bottom: -60, right: -60, opacity: 0.15 },
    { size: 120, bottom: -30, right: -30, opacity: 0.22 },
    { size: 70, bottom: -5, right: -5, opacity: 0.3 },
  ];
  return (
    <>
      {arcs.map((a, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            bottom: a.bottom,
            right: a.right,
            width: a.size,
            height: a.size,
            borderRadius: a.size / 2,
            borderWidth: 1,
            borderColor: color,
            opacity: a.opacity,
          }}
        />
      ))}
    </>
  );
}

function GridPattern({ color }: { color: string }) {
  const lines = [];
  for (let i = 0; i < 6; i++) {
    lines.push(
      <View
        key={`v${i}`}
        style={{
          position: "absolute",
          top: -10,
          bottom: -10,
          left: 180 + i * 28,
          width: 1,
          backgroundColor: color,
          opacity: 0.15,
        }}
      />,
      <View
        key={`h${i}`}
        style={{
          position: "absolute",
          left: 160,
          right: -10,
          top: i * 26 - 8,
          height: 1,
          backgroundColor: color,
          opacity: 0.15,
        }}
      />
    );
  }
  return <>{lines}</>;
}

function RingsPattern({ color }: { color: string }) {
  const rings = [
    { size: 140, cx: 260, cy: 50, opacity: 0.12, bw: 6 },
    { size: 90, cx: 280, cy: 60, opacity: 0.16, bw: 4 },
  ];
  return (
    <>
      {rings.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: r.cy - r.size / 2,
            left: r.cx - r.size / 2,
            width: r.size,
            height: r.size,
            borderRadius: r.size / 2,
            borderWidth: r.bw,
            borderColor: color,
            opacity: r.opacity,
          }}
        />
      ))}
    </>
  );
}

function Pattern({
  type,
  color,
}: {
  type: ChapterDef["patternType"];
  color: string;
}) {
  if (type === "chevrons") return <ChevronsPattern color={color} />;
  if (type === "arcs") return <ArcsPattern color={color} />;
  if (type === "grid") return <GridPattern color={color} />;
  return <RingsPattern color={color} />;
}

// ── Activity type icons ─────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  reflect: "journal-outline",
  reframe: "color-wand-outline",
  practice: "game-controller-outline",
  discuss: "chatbubbles-outline",
};

function ActivityTypeRow({ pages }: { pages: ChapterDef["pages"] }) {
  // Count unique activity types
  const types = new Set(pages.map((p) => p.activityType));
  return (
    <View style={styles.activityRow}>
      {Array.from(types).map((type) => (
        <View key={type} style={styles.activityDot}>
          <Ionicons
            name={ACTIVITY_ICONS[type] as any}
            size={12}
            color="rgba(255,255,255,0.4)"
          />
        </View>
      ))}
    </View>
  );
}

// ── Chapter Card ────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  pagesCompleted,
  isActive,
  isUnlocked,
  isComplete,
  onPress,
  index,
}: {
  chapter: ChapterDef;
  pagesCompleted: number;
  isActive: boolean;
  isUnlocked: boolean;
  isComplete: boolean;
  onPress: () => void;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        onPress={isUnlocked ? onPress : undefined}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: chapter.bg },
          !isUnlocked && styles.cardLocked,
          pressed && isUnlocked && { opacity: 0.88 },
        ]}
        accessibilityLabel={`Chapter ${chapter.number}: ${chapter.title}`}
      >
        {/* Pattern */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Pattern type={chapter.patternType} color={chapter.patternColor} />
        </View>

        {/* Lock overlay */}
        {!isUnlocked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.25)" />
          </View>
        )}

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <View
              style={[
                styles.cardIcon,
                {
                  backgroundColor: isUnlocked
                    ? chapter.accentColor + "22"
                    : "rgba(255,255,255,0.06)",
                },
              ]}
            >
              <Ionicons
                name={chapter.icon}
                size={20}
                color={isUnlocked ? chapter.accentColor : "rgba(255,255,255,0.2)"}
              />
            </View>
            <Text style={styles.cardChapterNum}>CHAPTER {chapter.number}</Text>
          </View>

          <Text
            style={[
              styles.cardTitle,
              !isUnlocked && { color: "rgba(255,255,255,0.3)" },
            ]}
          >
            {chapter.title}
          </Text>
          <Text style={styles.cardDesc}>{chapter.description}</Text>

          <View style={styles.cardFooter}>
            {/* Progress */}
            {isUnlocked && (
              <View style={styles.cardProgress}>
                <View style={styles.cardProgressTrack}>
                  <View
                    style={[
                      styles.cardProgressFill,
                      {
                        backgroundColor: isComplete
                          ? Colors.success
                          : chapter.accentColor,
                        width: `${(pagesCompleted / chapter.pages.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.cardProgressText}>
                  {isComplete
                    ? "Complete"
                    : `${pagesCompleted}/${chapter.pages.length}`}
                </Text>
              </View>
            )}

            {/* Activity types */}
            <ActivityTypeRow pages={chapter.pages} />
          </View>

          {/* Continue button for active chapter */}
          {isActive && !isComplete && (
            <View
              style={[
                styles.continueBtn,
                { backgroundColor: chapter.accentColor },
              ]}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export function ChapterMap() {
  const insets = useSafeAreaInsets();
  const {
    state,
    activeChapter,
    setActiveChapter,
    getChapterProgress,
  } = useChapter();

  const handleChapterPress = (chapterId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChapter(chapterId);
  };

  // Count total progress
  let totalCompleted = 0;
  let activeIdx = 0;
  CHAPTERS.forEach((ch, i) => {
    const cp = getChapterProgress(ch.id);
    if (cp.completedAt) totalCompleted++;
    if (ch.id === activeChapter.id) activeIdx = i;
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Your Story</Text>
        <Text style={styles.subtitle}>
          Chapter {activeIdx + 1} of {CHAPTERS.length}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {CHAPTERS.map((ch, idx) => {
          const cp = getChapterProgress(ch.id);
          const pagesCompleted = ch.pages.filter(
            (p) => cp.pages[p.id]?.completed
          ).length;
          const isComplete = !!cp.completedAt;
          const isActive = ch.id === activeChapter.id;

          return (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              pagesCompleted={pagesCompleted}
              isActive={isActive}
              isUnlocked={cp.unlocked}
              isComplete={isComplete}
              onPress={() => handleChapterPress(ch.id)}
              index={idx}
            />
          );
        })}
      </ScrollView>
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
    gap: 12,
  },

  // Card
  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    minHeight: 160,
  },
  cardLocked: {
    opacity: 0.5,
  },
  cardContent: {
    padding: 18,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  cardChapterNum: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  cardProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    maxWidth: 120,
  },
  cardProgressFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  cardProgressText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.4)",
  },
  activityRow: {
    flexDirection: "row",
    gap: 6,
  },
  activityDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  continueBtn: {
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  continueBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },

  lockOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
});
