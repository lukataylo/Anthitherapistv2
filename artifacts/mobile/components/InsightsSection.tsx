import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPatterns } from "@workspace/api-client-react";
import type { HistoryEntry } from "@/context/HistoryContext";
import { Colors } from "@/constants/colors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SignificantCategory = "belief" | "fear" | "absolute" | "self_judgment";

const CARD_W = 120;
const CARD_H = 148;

const CATEGORY_LABELS: Record<SignificantCategory, string> = {
  belief: "Belief",
  fear: "Fear",
  absolute: "Absolute",
  self_judgment: "Self-Judgment",
};

const SIGNIFICANT_CATEGORIES: SignificantCategory[] = [
  "belief",
  "fear",
  "absolute",
  "self_judgment",
];

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

type InsightCardData = {
  id: string;
  reversed: boolean;
  bigText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
};

function InsightCard({ card, grid }: { card: InsightCardData; grid?: boolean }) {
  return (
    <View style={grid ? styles.gridCard : styles.card} accessibilityLabel={card.label}>
      {card.bigText ? (
        <Text style={styles.bigText} numberOfLines={1} adjustsFontSizeToFit>
          {card.bigText}
        </Text>
      ) : card.icon ? (
        <Ionicons name={card.icon} size={26} color="rgba(255,255,255,0.45)" style={styles.bigIcon} />
      ) : null}
      <View style={styles.cardBottom}>
        <Text style={styles.label} numberOfLines={2}>
          {card.label}
        </Text>
        {card.sublabel ? (
          <Text style={styles.sublabel} numberOfLines={1}>
            {card.sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SkeletonCard({ grid }: { grid?: boolean }) {
  return (
    <View style={[grid ? styles.gridCard : styles.card, styles.skeletonBg]}>
      <View style={[styles.skeletonBlock, { width: 48, height: 28, borderRadius: 6, marginBottom: "auto" }]} />
      <View>
        <View style={[styles.skeletonBlock, { width: "75%", height: 10, borderRadius: 5, marginBottom: 6 }]} />
        <View style={[styles.skeletonBlock, { width: "50%", height: 8, borderRadius: 4 }]} />
      </View>
    </View>
  );
}

function ErrorCard({ onRetry, grid }: { onRetry: () => void; grid?: boolean }) {
  return (
    <Pressable onPress={onRetry} style={[grid ? styles.gridCard : styles.card, styles.skeletonBg]}>
      <Ionicons name="refresh-outline" size={28} color="rgba(255,255,255,0.35)" style={styles.bigIcon} />
      <View style={styles.cardBottom}>
        <Text style={[styles.label, { color: "#fff" }]}>Could not load</Text>
        <Text style={[styles.sublabel, { color: "rgba(255,255,255,0.4)" }]}>Tap to retry</Text>
      </View>
    </Pressable>
  );
}

function useInsightsData(entries: HistoryEntry[]) {
  const [patterns, setPatterns] = useState<string[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsError, setPatternsError] = useState(false);
  const fetchedRef = useRef(false);

  const categoryCounts = useMemo<Record<SignificantCategory, number>>(() => {
    const counts: Record<SignificantCategory, number> = {
      belief: 0,
      fear: 0,
      absolute: 0,
      self_judgment: 0,
    };
    for (const entry of entries) {
      for (const word of entry.words) {
        if (SIGNIFICANT_CATEGORIES.includes(word.category as SignificantCategory)) {
          counts[word.category as SignificantCategory]++;
        }
      }
    }
    return counts;
  }, [entries]);

  const totalWords = useMemo(
    () => SIGNIFICANT_CATEGORIES.reduce((s, c) => s + categoryCounts[c], 0),
    [categoryCounts]
  );

  const donutData = useMemo(
    () =>
      SIGNIFICANT_CATEGORIES.map((cat) => ({
        category: cat,
        count: categoryCounts[cat],
        pct: totalWords > 0 ? Math.round((categoryCounts[cat] / totalWords) * 100) : 0,
      })).sort((a, b) => b.count - a.count),
    [categoryCounts, totalWords]
  );

  const topCategory = useMemo(() => {
    const top = donutData.find((d) => d.count > 0);
    return top ? top : null;
  }, [donutData]);

  const { trendSummary, trendDelta, trendDir } = useMemo(() => {
    if (entries.length === 0) {
      return { trendSummary: null as string | null, trendDelta: 0, trendDir: "down" as "up" | "down" };
    }

    const weekMap: Map<string, Record<SignificantCategory, number>> = new Map();
    for (const entry of entries) {
      const key = getWeekKey(new Date(entry.savedAt));
      if (!weekMap.has(key)) {
        weekMap.set(key, { belief: 0, fear: 0, absolute: 0, self_judgment: 0 });
      }
      const bucket = weekMap.get(key)!;
      for (const word of entry.words) {
        if (SIGNIFICANT_CATEGORIES.includes(word.category as SignificantCategory)) {
          bucket[word.category as SignificantCategory]++;
        }
      }
    }

    const sortedWeeks = Array.from(weekMap.keys()).sort();
    let summary: string | null = null;
    let delta = 0;
    let dir: "up" | "down" = "down";
    if (sortedWeeks.length >= 2) {
      const firstWeek = weekMap.get(sortedWeeks[0])!;
      const lastWeek = weekMap.get(sortedWeeks[sortedWeeks.length - 1])!;
      const firstTotal = SIGNIFICANT_CATEGORIES.reduce((s, c) => s + firstWeek[c], 0);
      const lastTotal = SIGNIFICANT_CATEGORIES.reduce((s, c) => s + lastWeek[c], 0);

      if (firstTotal > 0 && lastTotal > 0) {
        let biggestChange = 0;
        let biggestCat: SignificantCategory | null = null;

        for (const cat of SIGNIFICANT_CATEGORIES) {
          const firstPct = Math.round((firstWeek[cat] / firstTotal) * 100);
          const lastPct = Math.round((lastWeek[cat] / lastTotal) * 100);
          const d = lastPct - firstPct;
          if (Math.abs(d) > Math.abs(biggestChange)) {
            biggestChange = d;
            biggestCat = cat;
          }
        }

        if (biggestCat && Math.abs(biggestChange) >= 5) {
          delta = Math.abs(biggestChange);
          dir = biggestChange > 0 ? "up" : "down";
          const label = CATEGORY_LABELS[biggestCat].toLowerCase();
          const numWeeks = sortedWeeks.length;
          summary = `${label} ${dir === "down" ? "dropped" : "rose"} over ${numWeeks} wk${numWeeks > 1 ? "s" : ""}`;
        }
      }
    }

    return { trendSummary: summary, trendDelta: delta, trendDir: dir };
  }, [entries]);

  const thoughtSamples = useMemo(() => {
    const samples: { thought: string; dominantCategory: SignificantCategory }[] = [];
    for (const entry of entries.slice(0, 20)) {
      const counts: Record<SignificantCategory, number> = {
        belief: 0,
        fear: 0,
        absolute: 0,
        self_judgment: 0,
      };
      for (const word of entry.words) {
        if (SIGNIFICANT_CATEGORIES.includes(word.category as SignificantCategory)) {
          counts[word.category as SignificantCategory]++;
        }
      }
      const dominant = SIGNIFICANT_CATEGORIES.reduce((best, cat) =>
        counts[cat] > counts[best] ? cat : best
      );
      if (counts[dominant] > 0 && entry.thought.trim().length > 0) {
        samples.push({ thought: entry.thought.trim(), dominantCategory: dominant });
      }
    }
    return samples.slice(0, 10);
  }, [entries]);

  const loadPatterns = useCallback(async () => {
    if (totalWords === 0 || thoughtSamples.length === 0) return;
    setPatternsLoading(true);
    setPatternsError(false);
    try {
      const result = await getPatterns({ categoryCounts, thoughtSamples });
      setPatterns(result.patterns ?? []);
    } catch {
      setPatternsError(true);
    } finally {
      setPatternsLoading(false);
    }
  }, [categoryCounts, thoughtSamples, totalWords]);

  useEffect(() => {
    if (!fetchedRef.current && totalWords > 0) {
      fetchedRef.current = true;
      loadPatterns();
    }
  }, [loadPatterns, totalWords]);

  const staticCards = useMemo<InsightCardData[]>(() => {
    const cards: InsightCardData[] = [];

    if (topCategory) {
      cards.push({
        id: `top-${topCategory.category}`,
        reversed: false,
        bigText: `${topCategory.pct}%`,
        label: `${CATEGORY_LABELS[topCategory.category]}`,
        sublabel: "top pattern",
      });
    }

    if (trendSummary) {
      cards.push({
        id: "trend",
        reversed: false,
        bigText: `${trendDir === "down" ? "\u2193" : "\u2191"}${trendDelta}%`,
        label: trendSummary,
      });
    }

    cards.push({
      id: "total",
      reversed: false,
      bigText: `${totalWords}`,
      label: "distortions found",
      sublabel: `across ${entries.length} entries`,
    });

    const nonTopCats = donutData.filter((d) => d.count > 0 && d.category !== topCategory?.category);
    for (let i = 0; i < nonTopCats.length; i++) {
      const d = nonTopCats[i];
      cards.push({
        id: `cat-${d.category}`,
        reversed: false,
        bigText: `${d.pct}%`,
        label: CATEGORY_LABELS[d.category],
        sublabel: `${d.count} flagged`,
      });
    }

    return cards;
  }, [topCategory, trendSummary, trendDelta, trendDir, totalWords, donutData, entries.length]);

  const patternCards: InsightCardData[] = useMemo(() =>
    patterns.map((p, i) => ({
      id: `pattern-${i}`,
      reversed: false,
      icon: (["eye-outline", "bulb-outline", "chatbubble-ellipses-outline", "flash-outline"] as Array<keyof typeof Ionicons.glyphMap>)[i % 4],
      label: p,
    })),
    [patterns]
  );

  return {
    totalWords,
    staticCards,
    patternCards,
    patternsLoading,
    patternsError,
    loadPatterns,
  };
}

export function InsightsSection({
  entries,
  alwaysExpanded = false,
}: {
  entries: HistoryEntry[];
  alwaysExpanded?: boolean;
}) {
  const {
    totalWords,
    staticCards,
    patternCards,
    patternsLoading,
    patternsError,
    loadPatterns,
  } = useInsightsData(entries);

  const allCards = useMemo(() => [...staticCards, ...patternCards], [staticCards, patternCards]);

  const [activeIdx, setActiveIdx] = useState(0);

  if (totalWords === 0) {
    if (entries.length === 0) return null;
    if (alwaysExpanded) {
      return (
        <View style={styles.noDataState}>
          <Ionicons name="analytics-outline" size={40} color="rgba(255,255,255,0.12)" />
          <Text style={styles.noDataTitle}>No patterns yet</Text>
          <Text style={styles.noDataSubtitle}>
            Start reframing thoughts to unlock your Insights.
          </Text>
        </View>
      );
    }
    return null;
  }

  if (alwaysExpanded) {
    return (
      <View style={styles.gridContainer}>
        <View style={styles.gridWrap}>
          {staticCards.map((card) => (
            <InsightCard key={card.id} card={card} grid />
          ))}
          {patternsLoading ? (
            <>
              <SkeletonCard grid />
              <SkeletonCard grid />
              <SkeletonCard grid />
            </>
          ) : patternsError ? (
            <ErrorCard onRetry={loadPatterns} grid />
          ) : (
            patternCards.map((card) => (
              <InsightCard key={card.id} card={card} grid />
            ))
          )}
        </View>
      </View>
    );
  }

  const cardCount = patternsLoading
    ? staticCards.length + 3
    : patternsError
      ? staticCards.length + 1
      : allCards.length;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>INSIGHTS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
        snapToInterval={CARD_W + 10}
        snapToAlignment="start"
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const idx = Math.round(x / (CARD_W + 10));
          setActiveIdx(Math.max(0, Math.min(idx, cardCount - 1)));
        }}
        scrollEventThrottle={16}
      >
        {staticCards.map((card) => (
          <InsightCard key={card.id} card={card} />
        ))}

        {patternsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : patternsError ? (
          <ErrorCard onRetry={loadPatterns} />
        ) : (
          patternCards.map((card) => (
            <InsightCard key={card.id} card={card} />
          ))
        )}
      </ScrollView>
      {cardCount > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIdx ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noDataState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  noDataTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.35)",
  },
  noDataSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 18,
  },
  section: {
    marginTop: 8,
    marginBottom: 20,
  },
  heading: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 2.5,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  bigText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: -1,
  },
  bigIcon: {
    marginTop: 2,
  },
  cardBottom: {
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 15,
    letterSpacing: -0.1,
  },
  sublabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 2,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  dotInactive: {
    width: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  skeletonBg: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  skeletonBlock: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  gridContainer: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCard: {
    width: "47%",
    minHeight: 140,
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
});
