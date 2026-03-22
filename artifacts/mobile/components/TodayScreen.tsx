/**
 * TodayScreen — the daily session orchestrator.
 *
 * This is the main screen the user sees when they open the app. Instead of
 * choosing between 10+ entry points, the app serves one activity per day
 * based on the user's current chapter and page.
 *
 * ## Activity routing
 *
 * Each page in a chapter has an activityType:
 *  - "reflect" → renders a journaling question with text input
 *  - "reframe" → renders the existing CaptureScreen → ReframeCloudScreen flow
 *  - "practice" → launches the appropriate mini-game
 *  - "discuss" → renders the Socratic coaching chat
 *
 * ## Layout
 *
 * 1. Chapter hero header (title, accent glow, progress)
 * 2. Mood check-in (pre-session, same 5 emojis)
 * 3. Today's activity (the core content)
 * 4. Streak bar at bottom
 */

import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { Colors } from "@/constants/colors";
import { useChapter } from "@/context/ChapterContext";
import { useStreak } from "@/context/StreakContext";
import { useSpiritAnimal } from "@/context/SpiritAnimalContext";
import { useGame } from "@/context/GameContext";
import { CaptureScreen } from "@/components/CaptureScreen";
import { ReframeCloudScreen } from "@/components/ReframeCloudScreen";
import type { PageDef } from "@/data/chapters";

// ── Mood options ────────────────────────────────────────────────────────

const MOODS = [
  { mood: "happy", emoji: "😊", label: "Good" },
  { mood: "okay", emoji: "😐", label: "Okay" },
  { mood: "sad", emoji: "😢", label: "Sad" },
  { mood: "stressed", emoji: "😰", label: "Stressed" },
  { mood: "angry", emoji: "😤", label: "Angry" },
] as const;

// ── Sub-components ──────────────────────────────────────────────────────

function ChapterHeader({
  title,
  subtitle,
  number,
  accentColor,
  pagesCompleted,
  totalPages,
  icon,
}: {
  title: string;
  subtitle: string;
  number: number;
  accentColor: string;
  pagesCompleted: number;
  totalPages: number;
  icon: string;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.heroCard}>
      {/* Accent glow */}
      <View
        style={[
          styles.heroGlow,
          { backgroundColor: accentColor, opacity: 0.06 },
        ]}
      />
      <View style={styles.heroContent}>
        <View style={styles.heroTop}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: accentColor + "22" },
            ]}
          >
            <Ionicons name={icon as any} size={20} color={accentColor} />
          </View>
          <Text style={styles.heroChapterLabel}>
            CHAPTER {number}
          </Text>
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: accentColor,
                  width:
                    totalPages > 0
                      ? `${(pagesCompleted / totalPages) * 100}%`
                      : "0%",
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {pagesCompleted}/{totalPages}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function MoodCheckIn({
  accentColor,
  onSelect,
}: {
  accentColor: string;
  onSelect: (mood: string) => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.moodSection}>
      <Text style={styles.moodLabel}>Before we begin, how are you feeling?</Text>
      <View style={styles.moodRow}>
        {MOODS.map((m) => (
          <Pressable
            key={m.mood}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(m.mood);
            }}
            style={({ pressed }) => [
              styles.moodBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text style={styles.moodBtnLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

/** Activity label pill showing what type of activity today's page is. */
function ActivityPill({
  type,
  accentColor,
}: {
  type: string;
  accentColor: string;
}) {
  const labels: Record<string, { text: string; icon: string }> = {
    reflect: { text: "REFLECT", icon: "journal-outline" },
    reframe: { text: "REFRAME", icon: "color-wand-outline" },
    practice: { text: "PRACTICE", icon: "game-controller-outline" },
    discuss: { text: "DISCUSS", icon: "chatbubbles-outline" },
  };
  const l = labels[type] ?? labels.reflect;
  return (
    <View style={[styles.activityPill, { borderColor: accentColor + "44" }]}>
      <Ionicons name={l.icon as any} size={12} color={accentColor} />
      <Text style={[styles.activityPillText, { color: accentColor }]}>
        {l.text}
      </Text>
    </View>
  );
}

// ── Reflect Activity ────────────────────────────────────────────────────

function ReflectActivity({
  page,
  accentColor,
  onComplete,
}: {
  page: PageDef;
  accentColor: string;
  onComplete: (response: string) => void;
}) {
  const [text, setText] = useState("");
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    if (text.trim().length < 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete(text.trim());
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.reflectWrap}>
      <Text style={styles.reflectPrompt}>{page.prompt}</Text>

      {page.hint && (
        <Pressable
          onPress={() => setShowHint(!showHint)}
          style={styles.hintToggle}
        >
          <Ionicons
            name={showHint ? "eye-off-outline" : "eye-outline"}
            size={14}
            color={accentColor}
          />
          <Text style={[styles.hintToggleText, { color: accentColor }]}>
            {showHint ? "Hide hint" : "Show hint"}
          </Text>
        </Pressable>
      )}

      {showHint && page.hint && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.hintBox, { borderColor: accentColor + "33" }]}
        >
          <Text style={styles.hintText}>{page.hint}</Text>
        </Animated.View>
      )}

      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder="Write here..."
        placeholderTextColor="rgba(255,255,255,0.2)"
        multiline
        style={styles.reflectInput}
        textAlignVertical="top"
      />

      <Pressable
        onPress={handleSubmit}
        disabled={text.trim().length < 3}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor:
              text.trim().length >= 3 ? accentColor : "rgba(255,255,255,0.06)",
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text
          style={[
            styles.submitBtnText,
            {
              color:
                text.trim().length >= 3 ? "#000" : "rgba(255,255,255,0.3)",
            },
          ]}
        >
          Done
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Practice Activity (game launcher) ───────────────────────────────────

function PracticeActivity({
  page,
  accentColor,
  onComplete,
}: {
  page: PageDef;
  accentColor: string;
  onComplete: () => void;
}) {
  const router = useRouter();

  const handleLaunch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to the history tab with the game param to auto-open the game
    router.push({ pathname: "/story", params: { game: page.gameId } });
    // Mark complete immediately — the act of launching counts
    onComplete();
  };

  const gameNames: Record<string, string> = {
    "sort-tower": "Sort Tower",
    "rocket-reframe": "Rocket Reframe",
    "reality-check": "Reality Check",
    "mind-voyage": "Mind Voyage",
    reword: "Reword",
  };

  const gameIcons: Record<string, string> = {
    "sort-tower": "layers",
    "rocket-reframe": "rocket",
    "reality-check": "checkmark-circle-outline",
    "mind-voyage": "boat-outline",
    reword: "swap-horizontal-outline",
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.practiceWrap}>
      <View
        style={[styles.practiceIcon, { backgroundColor: accentColor + "18" }]}
      >
        <Ionicons
          name={(gameIcons[page.gameId ?? ""] ?? "game-controller-outline") as any}
          size={32}
          color={accentColor}
        />
      </View>
      <Text style={styles.practiceTitle}>
        {gameNames[page.gameId ?? ""] ?? "Practice Game"}
      </Text>
      <Text style={styles.practiceDesc}>
        Time to put your skills to the test. This game reinforces what you've been learning in this chapter.
      </Text>
      <Pressable
        onPress={handleLaunch}
        style={({ pressed }) => [
          styles.launchBtn,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="play" size={18} color="#000" />
        <Text style={styles.launchBtnText}>Play</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Discuss Activity ────────────────────────────────────────────────────

function DiscussActivity({
  page,
  accentColor,
  onComplete,
}: {
  page: PageDef;
  accentColor: string;
  onComplete: () => void;
}) {
  const router = useRouter();

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/discuss");
    onComplete();
  };

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.discussWrap}>
      <View style={[styles.discussIcon, { backgroundColor: accentColor + "18" }]}>
        <Ionicons name="chatbubbles-outline" size={32} color={accentColor} />
      </View>
      <Text style={styles.discussTitle}>Guided Conversation</Text>
      <Text style={styles.discussDesc}>
        Talk through what's on your mind with a supportive, curious guide. No labels, no diagnoses — just questions that help you see clearly.
      </Text>
      {page.discussSeed && (
        <View style={[styles.seedCard, { borderColor: accentColor + "33" }]}>
          <Text style={styles.seedLabel}>TODAY'S THEME</Text>
          <Text style={styles.seedText}>{page.discussSeed}</Text>
        </View>
      )}
      <Pressable
        onPress={handleStart}
        style={({ pressed }) => [
          styles.launchBtn,
          { backgroundColor: accentColor },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="chatbubble-outline" size={16} color="#000" />
        <Text style={styles.launchBtnText}>Start</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Completion Card ─────────────────────────────────────────────────────

function CompletionCard({
  accentColor,
  onContinue,
}: {
  accentColor: string;
  onContinue: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.completionCard}>
      <View style={[styles.completionCheck, { backgroundColor: accentColor + "22" }]}>
        <Ionicons name="checkmark" size={28} color={accentColor} />
      </View>
      <Text style={styles.completionTitle}>Page complete</Text>
      <Text style={styles.completionDesc}>
        Nice work. Your progress has been saved.
      </Text>
      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [
          styles.continueBtn,
          { borderColor: accentColor + "44" },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.continueBtnText, { color: accentColor }]}>
          Continue
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

type Phase = "mood" | "activity" | "done";

export function TodayScreen() {
  const insets = useSafeAreaInsets();
  const {
    activeChapter,
    activePageIndex,
    activePage,
    activeChapterPagesCompleted,
    isActiveChapterComplete,
    completePage,
    logMood,
  } = useChapter();
  const { currentStreak, reflectedToday } = useStreak();
  const { spiritAnimal } = useSpiritAnimal();
  const { screen: gameScreen } = useGame();

  const [phase, setPhase] = useState<Phase>(
    isActiveChapterComplete ? "done" : "mood"
  );
  const [moodSelected, setMoodSelected] = useState(false);

  // If in a reframe flow, delegate to existing screens
  const inReframeFlow = gameScreen === "cloud" || gameScreen === "game";
  if (
    phase === "activity" &&
    activePage?.activityType === "reframe" &&
    inReframeFlow
  ) {
    return (
      <View style={[styles.root, { paddingTop: 0 }]}>
        <StatusBar style="light" />
        <ReframeCloudScreen />
      </View>
    );
  }

  const handleMoodSelect = (mood: string) => {
    logMood(mood);
    setMoodSelected(true);
    setPhase("activity");
  };

  const handleComplete = (response?: string) => {
    if (activePage) {
      completePage(activePage.id, response);
    }
    setPhase("done");
  };

  const handleContinue = () => {
    // Reset for next page
    setPhase("mood");
    setMoodSelected(false);
  };

  const accentColor = activeChapter.accentColor;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 100,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Chapter hero */}
          <ChapterHeader
            title={activeChapter.title}
            subtitle={activeChapter.subtitle}
            number={activeChapter.number}
            accentColor={accentColor}
            pagesCompleted={activeChapterPagesCompleted}
            totalPages={activeChapter.pages.length}
            icon={activeChapter.icon as string}
          />

          {/* Phase: mood check-in */}
          {phase === "mood" && (
            <MoodCheckIn
              accentColor={accentColor}
              onSelect={handleMoodSelect}
            />
          )}

          {/* Phase: activity */}
          {phase === "activity" && activePage && (
            <View style={styles.activitySection}>
              <View style={styles.activityHeader}>
                <ActivityPill type={activePage.activityType} accentColor={accentColor} />
                <Text style={styles.pageLabel}>
                  PAGE {activePageIndex + 1} OF {activeChapter.pages.length}
                </Text>
              </View>

              {activePage.activityType === "reflect" && (
                <ReflectActivity
                  page={activePage}
                  accentColor={accentColor}
                  onComplete={(response) => handleComplete(response)}
                />
              )}

              {activePage.activityType === "reframe" && !inReframeFlow && (
                <CaptureScreen />
              )}

              {activePage.activityType === "practice" && (
                <PracticeActivity
                  page={activePage}
                  accentColor={accentColor}
                  onComplete={() => handleComplete()}
                />
              )}

              {activePage.activityType === "discuss" && (
                <DiscussActivity
                  page={activePage}
                  accentColor={accentColor}
                  onComplete={() => handleComplete()}
                />
              )}
            </View>
          )}

          {/* Phase: done */}
          {phase === "done" && (
            <>
              {isActiveChapterComplete ? (
                <Animated.View entering={FadeIn.duration(400)} style={styles.chapterDoneWrap}>
                  <View style={[styles.completionCheck, { backgroundColor: Colors.success + "22" }]}>
                    <Ionicons name="trophy-outline" size={28} color={Colors.success} />
                  </View>
                  <Text style={styles.completionTitle}>Chapter Complete!</Text>
                  <Text style={styles.completionDesc}>
                    You've finished "{activeChapter.title}". Head to the Story tab to see what's next.
                  </Text>
                </Animated.View>
              ) : (
                <CompletionCard
                  accentColor={accentColor}
                  onContinue={handleContinue}
                />
              )}
            </>
          )}
        </ScrollView>

        {/* Streak bar */}
        <View
          style={[styles.streakBar, { paddingBottom: insets.bottom + 8 }]}
        >
          <View style={styles.streakInner}>
            <Ionicons
              name="flame"
              size={16}
              color={reflectedToday ? Colors.success : "#F59E0B"}
            />
            <Text style={styles.streakText}>
              {currentStreak} day{currentStreak !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },

  // Hero
  heroCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    position: "relative",
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  heroContent: {
    padding: 20,
    gap: 6,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroChapterLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.4)",
  },

  // Mood
  moodSection: {
    gap: 14,
    paddingVertical: 8,
  },
  moodLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  moodBtn: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 58,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodBtnLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
  },

  // Activity header
  activitySection: {
    gap: 12,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  activityPillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  pageLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1,
  },

  // Reflect
  reflectWrap: {
    gap: 14,
  },
  reflectPrompt: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.9)",
    lineHeight: 26,
  },
  hintToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hintToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  hintBox: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
  },
  hintText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
  },
  reflectInput: {
    minHeight: 120,
    maxHeight: 200,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    lineHeight: 22,
  },
  submitBtn: {
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  // Practice
  practiceWrap: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
  },
  practiceIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  practiceDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  launchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  launchBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },

  // Discuss
  discussWrap: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
  },
  discussIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  discussTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  discussDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  seedCard: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    width: "100%",
    gap: 6,
  },
  seedLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1.5,
  },
  seedText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 20,
    fontStyle: "italic",
  },

  // Completion
  completionCard: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },
  completionCheck: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  completionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  completionDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  continueBtn: {
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  continueBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  chapterDoneWrap: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },

  // Streak bar
  streakBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  streakInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
  },
});
