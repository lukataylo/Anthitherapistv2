/**
 * Flashcard Practice screen — the third tab.
 *
 * Presents a swipeable deck of positive belief flashcards built from three sources:
 *  1. History cards: distorted→healthy word reframes the user chose in past sessions
 *  2. Journal cards: affirmations/insights surfaced from discuss sessions by the AI
 *  3. Seed cards: pre-filled "recall your wins" prompts across life categories
 *
 * ## Card interaction
 *
 * - Tapping a card flips it (animated) to reveal the back.
 * - Previous/Next buttons navigate through the deck sequentially.
 * - A progress counter shows current position in the deck.
 *
 * ## Flip animation
 *
 * Card flip uses a single rotateY Animated.Value that drives two complementary
 * interpolations — front face (0→90°) and back face (90→180°) — with the
 * `backfaceVisibility: "hidden"` trick to show one side at a time.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHistory } from "@/context/HistoryContext";
import {
  buildDeck,
  type FlashCard,
  type DeckResult,
} from "@/utils/flashcardDeck";
import {
  loadReminderPreference,
  saveReminderPreference,
  requestPermission,
  scheduleReminder,
  cancelReminder,
  type ReminderPreference,
} from "@/utils/notifications";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// ── Hour picker helpers ───────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${period}`;
}

// ── Reminder settings row ─────────────────────────────────────────────────────

function ReminderSettings() {
  const [pref, setPref] = useState<ReminderPreference>({
    enabled: false,
    hour: 20,
    minute: 0,
  });
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    loadReminderPreference().then(setPref).catch(() => {});
  }, []);

  const applyPref = useCallback(
    async (next: ReminderPreference) => {
      setPref(next);
      await saveReminderPreference(next);
      if (next.enabled) {
        const granted = await requestPermission();
        if (!granted) {
          const disabled = { ...next, enabled: false };
          setPref(disabled);
          await saveReminderPreference(disabled);
          return;
        }
        await scheduleReminder(next.hour, next.minute);
      } else {
        await cancelReminder();
      }
    },
    [],
  );

  const handleToggle = useCallback(
    (value: boolean) => {
      applyPref({ ...pref, enabled: value });
      if (value) setShowPicker(true);
    },
    [pref, applyPref],
  );

  const handleHour = useCallback(
    (hour: number) => {
      applyPref({ ...pref, hour });
    },
    [pref, applyPref],
  );

  const handleMinute = useCallback(
    (minute: number) => {
      applyPref({ ...pref, minute });
    },
    [pref, applyPref],
  );

  return (
    <View style={reminderStyles.card}>
      <View style={reminderStyles.row}>
        <View style={reminderStyles.labelWrap}>
          <Ionicons name="notifications-outline" size={16} color="rgba(255,255,255,0.6)" />
          <Text style={reminderStyles.label}>Daily reminder</Text>
          {pref.enabled && (
            <Text style={reminderStyles.timeLabel}>
              {formatTime(pref.hour, pref.minute)}
            </Text>
          )}
        </View>
        <Switch
          value={pref.enabled}
          onValueChange={handleToggle}
          trackColor={{ false: "rgba(255,255,255,0.12)", true: "#48C78E" }}
          thumbColor="#fff"
          ios_backgroundColor="rgba(255,255,255,0.12)"
        />
      </View>

      {pref.enabled && (
        <Pressable
          onPress={() => setShowPicker((v) => !v)}
          style={reminderStyles.timeRow}
        >
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.4)" />
          <Text style={reminderStyles.timeTapText}>
            {showPicker ? "Close time picker" : "Change time"}
          </Text>
          <Ionicons
            name={showPicker ? "chevron-up" : "chevron-down"}
            size={14}
            color="rgba(255,255,255,0.3)"
          />
        </Pressable>
      )}

      {pref.enabled && showPicker && (
        <View style={reminderStyles.pickerWrap}>
          <View style={reminderStyles.pickerCol}>
            <Text style={reminderStyles.pickerLabel}>Hour</Text>
            <ScrollView
              style={reminderStyles.pickerScroll}
              showsVerticalScrollIndicator={false}
            >
              {HOURS.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => handleHour(h)}
                  style={[
                    reminderStyles.pickerItem,
                    pref.hour === h && reminderStyles.pickerItemActive,
                  ]}
                >
                  <Text
                    style={[
                      reminderStyles.pickerItemText,
                      pref.hour === h && reminderStyles.pickerItemTextActive,
                    ]}
                  >
                    {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={reminderStyles.pickerCol}>
            <Text style={reminderStyles.pickerLabel}>Minute</Text>
            {MINUTES.map((m) => (
              <Pressable
                key={m}
                onPress={() => handleMinute(m)}
                style={[
                  reminderStyles.pickerItem,
                  pref.minute === m && reminderStyles.pickerItemActive,
                ]}
              >
                <Text
                  style={[
                    reminderStyles.pickerItemText,
                    pref.minute === m && reminderStyles.pickerItemTextActive,
                  ]}
                >
                  :{m.toString().padStart(2, "0")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function CardTypeTag({ type }: { type: FlashCard["type"] }) {
  const label = type === "journal" ? "Insight" : "Recall";
  const color =
    type === "journal" ? "rgba(154,117,245,0.25)" : "rgba(72,199,142,0.25)";
  const textColor = type === "journal" ? "#9A75F5" : "#48C78E";

  return (
    <View style={[styles.tag, { backgroundColor: color }]}>
      <Text style={[styles.tagText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="sunny-outline" size={52} color="rgba(255,255,255,0.12)" />
      <Text style={styles.emptyTitle}>Your practice deck is empty</Text>
      <Text style={styles.emptySubtitle}>
        Complete a reframing session or start a discussion to build your belief deck
      </Text>
    </View>
  );
}


function FlipCard({ card }: { card: FlashCard }) {
  const [flipped, setFlipped] = useState(false);
  const [cooldown, setCooldown] = useState(9);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setCooldown(9);
    setFlipped(false);
    flipAnim.setValue(0);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [card.id]);

  const canFlip = cooldown === 0;

  const flip = () => {
    if (!canFlip) return;
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
    setFlipped((f) => !f);
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  return (
    <Pressable onPress={flip} style={styles.cardPressable}>
      <View style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            { transform: [{ rotateY: frontRotate }] },
          ]}
        >
          <View style={styles.tagAbsolute}>
            <CardTypeTag type={card.type} />
          </View>
          <Text style={styles.cardFrontText}>{card.front}</Text>
          <View style={styles.tapHintAbsolute}>
            {canFlip ? (
              <>
                <Ionicons
                  name="refresh-outline"
                  size={14}
                  color="rgba(255,255,255,0.5)"
                />
                <Text style={styles.flipReadyText}>Tap to flip</Text>
              </>
            ) : (
              <Text style={styles.cooldownText}>{cooldown}</Text>
            )}
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            { transform: [{ rotateY: backRotate }] },
          ]}
        >
          <View style={styles.tagAbsolute}>
            <CardTypeTag type={card.type} />
          </View>
          <View style={styles.backContent}>
            {card.back
              .split("\n")
              .filter((line) => line.trim().length > 0)
              .map((line, idx) => (
                <Text key={idx} style={styles.cardBackText}>
                  {line}
                </Text>
              ))}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const { entries } = useHistory();
  const [deck, setDeck] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  const currentCard = deck[currentIndex] ?? null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === deck.length - 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildDeck(entries, BASE_URL).then((result: DeckResult) => {
      if (cancelled) return;
      setDeck(result.deck);
      setCurrentIndex(0);
      setIsEmpty(result.isEmpty);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(deck.length - 1, i + 1));
  }, [deck.length]);

  const progress = deck.length > 0 ? (currentIndex + 1) / deck.length : 0;
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = Math.round(trackWidth * progress);

  return (
    <View style={[styles.root]}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>Drill your positive beliefs</Text>
      </View>

      <View style={styles.settingsWrap}>
        <ReminderSettings />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Building your deck…</Text>
        </View>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <View style={styles.deckArea}>
          <View style={styles.progressRow}>
            <View
              style={styles.progressTrack}
              onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            >
              <View style={[styles.progressFill, { width: fillWidth }]} />
            </View>
            <Text style={styles.progressText}>
              {currentIndex + 1}/{deck.length}
            </Text>
          </View>

          <View style={styles.stackWrapper}>
            {currentCard && (
              <FlipCard key={currentCard.id} card={currentCard} />
            )}
          </View>

          <View style={[styles.actionRow, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              onPress={handlePrevious}
              disabled={isFirst}
              style={[styles.actionBtn, styles.actionBtnNav, isFirst && styles.actionBtnDisabled]}
            >
              <Ionicons name="chevron-back" size={20} color={isFirst ? "rgba(255,255,255,0.2)" : "#fff"} />
              <Text style={[styles.actionBtnText, { color: isFirst ? "rgba(255,255,255,0.2)" : "#fff" }]}>Previous</Text>
            </Pressable>
            <Pressable
              onPress={handleNext}
              disabled={isLast}
              style={[styles.actionBtn, styles.actionBtnNav, isLast && styles.actionBtnDisabled]}
            >
              <Text style={[styles.actionBtnText, { color: isLast ? "rgba(255,255,255,0.2)" : "#fff" }]}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color={isLast ? "rgba(255,255,255,0.2)" : "#fff"} />
            </Pressable>
          </View>
        </View>
      )}
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    lineHeight: 20,
  },
  settingsWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  deckArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#48C78E",
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
    minWidth: 36,
    textAlign: "right",
  },
  stackWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardPressable: {
    flex: 1,
    width: "100%",
  },
  cardContainer: {
    flex: 1,
    width: "100%",
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    padding: 24,
    backfaceVisibility: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardFront: {
    backgroundColor: "#141416",
    justifyContent: "center",
    alignItems: "center",
  },
  cardBack: {
    backgroundColor: "#1A1A1E",
    justifyContent: "center",
    alignItems: "center",
  },
  tagAbsolute: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  cardFrontText: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    lineHeight: 36,
    paddingHorizontal: 8,
  },
  tapHintAbsolute: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tapHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.25)",
  },
  cooldownText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
  },
  flipReadyText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
  },
  backContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    width: "100%",
    gap: 12,
    paddingHorizontal: 4,
  },
  cardBackText: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    textAlign: "left",
    lineHeight: 32,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionBtnNav: {
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});

const reminderStyles = StyleSheet.create({
  card: {
    backgroundColor: "#141416",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#48C78E",
    marginLeft: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  timeTapText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    flex: 1,
  },
  pickerWrap: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  pickerCol: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.3)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickerScroll: {
    maxHeight: 140,
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  pickerItemActive: {
    backgroundColor: "rgba(72,199,142,0.15)",
  },
  pickerItemText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  pickerItemTextActive: {
    color: "#48C78E",
    fontFamily: "Inter_600SemiBold",
  },
});
