import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from "react-native-svg";
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

const CATEGORY_LABELS: Record<SignificantCategory, string> = {
  belief: "Belief",
  fear: "Fear",
  absolute: "Absolute",
  self_judgment: "Self-Judgment",
};

const CATEGORY_COLORS: Record<SignificantCategory, string> = {
  belief: Colors.belief,
  fear: Colors.fear,
  absolute: Colors.absolute,
  self_judgment: Colors.self_judgment,
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

function MiniDonut({
  data,
  size = 36,
}: {
  data: { category: SignificantCategory; count: number; pct: number }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.55;
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) return null;

  let currentAngle = -Math.PI / 2;
  const slices = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const angle = (d.pct / 100) * 2 * Math.PI;
      const startAngle = currentAngle;
      currentAngle += angle;
      const endAngle = currentAngle;

      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const ix1 = cx + innerR * Math.cos(endAngle);
      const iy1 = cy + innerR * Math.sin(endAngle);
      const ix2 = cx + innerR * Math.cos(startAngle);
      const iy2 = cy + innerR * Math.sin(startAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        "Z",
      ].join(" ");

      return { path, color: CATEGORY_COLORS[d.category] };
    });

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => (
        <Path key={i} d={s.path} fill={s.color} opacity={0.9} />
      ))}
    </Svg>
  );
}

function DonutChart({
  data,
  size = 140,
}: {
  data: { category: SignificantCategory; count: number; pct: number }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.58;
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) return null;

  let currentAngle = -Math.PI / 2;
  const slices = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const angle = (d.pct / 100) * 2 * Math.PI;
      const startAngle = currentAngle;
      currentAngle += angle;
      const endAngle = currentAngle;

      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const ix1 = cx + innerR * Math.cos(endAngle);
      const iy1 = cy + innerR * Math.sin(endAngle);
      const ix2 = cx + innerR * Math.cos(startAngle);
      const iy2 = cy + innerR * Math.sin(startAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        "Z",
      ].join(" ");

      return { path, color: CATEGORY_COLORS[d.category] };
    });

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => (
        <Path key={i} d={s.path} fill={s.color} opacity={0.9} />
      ))}
      <SvgText
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize={11}
        fill={Colors.textSecondary}
        fontFamily="Inter_400Regular"
      >
        total
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fontSize={20}
        fontWeight="bold"
        fill={Colors.text}
        fontFamily="Inter_700Bold"
      >
        {total}
      </SvgText>
    </Svg>
  );
}

function TrendChart({
  weeks,
  series,
  width = 280,
  height = 110,
}: {
  weeks: string[];
  series: { category: SignificantCategory; points: number[] }[];
  width?: number;
  height?: number;
}) {
  const padLeft = 4;
  const padRight = 4;
  const padTop = 8;
  const padBottom = 18;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  if (weeks.length < 2) return null;

  const xScale = (i: number) => padLeft + (i / (weeks.length - 1)) * chartW;
  const yScale = (pct: number) => padTop + chartH - (pct / 100) * chartH;

  return (
    <Svg width={width} height={height}>
      {[25, 50, 75].map((pct) => (
        <Line
          key={pct}
          x1={padLeft}
          y1={yScale(pct)}
          x2={padLeft + chartW}
          y2={yScale(pct)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      <SvgText
        x={padLeft}
        y={height - 2}
        fontSize={9}
        fill={Colors.textSecondary}
        fontFamily="Inter_400Regular"
      >
        {formatWeekLabel(weeks[0])}
      </SvgText>
      <SvgText
        x={padLeft + chartW}
        y={height - 2}
        textAnchor="end"
        fontSize={9}
        fill={Colors.textSecondary}
        fontFamily="Inter_400Regular"
      >
        {formatWeekLabel(weeks[weeks.length - 1])}
      </SvgText>
      {series.map((s) => {
        const pts = s.points
          .map((pct, i) => `${xScale(i)},${yScale(pct)}`)
          .join(" ");
        return (
          <Polyline
            key={s.category}
            points={pts}
            fill="none"
            stroke={CATEGORY_COLORS[s.category]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      {series.map((s) => {
        const lastI = s.points.length - 1;
        return (
          <Circle
            key={s.category}
            cx={xScale(lastI)}
            cy={yScale(s.points[lastI])}
            r={3}
            fill={CATEGORY_COLORS[s.category]}
          />
        );
      })}
    </Svg>
  );
}

function formatWeekLabel(weekKey: string): string {
  const [year, week] = weekKey.split("-W");
  const jan4 = new Date(Number(year), 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() + (Number(week) - 1) * 7 - ((jan4.getDay() + 6) % 7));
  return weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PatternSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonLine, { width: "90%" }]} />
      <View style={[styles.skeletonLine, { width: "70%", marginTop: 6 }]} />
    </View>
  );
}

export function InsightsSection({
  entries,
  alwaysExpanded = false,
}: {
  entries: HistoryEntry[];
  alwaysExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
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

  const { weeks, trendSeries, trendSummary } = useMemo(() => {
    if (entries.length === 0) {
      return { weeks: [] as string[], trendSeries: [] as { category: SignificantCategory; points: number[] }[], trendSummary: null as string | null };
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

    const series = SIGNIFICANT_CATEGORIES.map((cat) => ({
      category: cat,
      points: sortedWeeks.map((wk) => {
        const bucket = weekMap.get(wk)!;
        const weekTotal = SIGNIFICANT_CATEGORIES.reduce((s, c) => s + bucket[c], 0);
        return weekTotal > 0 ? Math.round((bucket[cat] / weekTotal) * 100) : 0;
      }),
    }));

    let summary: string | null = null;
    if (sortedWeeks.length >= 2) {
      const firstWeek = weekMap.get(sortedWeeks[0])!;
      const lastWeek = weekMap.get(sortedWeeks[sortedWeeks.length - 1])!;
      const firstTotal = SIGNIFICANT_CATEGORIES.reduce((s, c) => s + firstWeek[c], 0);
      const lastTotal = SIGNIFICANT_CATEGORIES.reduce((s, c) => s + lastWeek[c], 0);

      if (firstTotal > 0 && lastTotal > 0) {
        let biggestChange = 0;
        let biggestCat: SignificantCategory | null = null;
        let changeDir: "up" | "down" = "down";

        for (const cat of SIGNIFICANT_CATEGORIES) {
          const firstPct = Math.round((firstWeek[cat] / firstTotal) * 100);
          const lastPct = Math.round((lastWeek[cat] / lastTotal) * 100);
          const delta = lastPct - firstPct;
          if (Math.abs(delta) > Math.abs(biggestChange)) {
            biggestChange = delta;
            biggestCat = cat;
            changeDir = delta > 0 ? "up" : "down";
          }
        }

        if (biggestCat && Math.abs(biggestChange) >= 5) {
          const numWeeks = sortedWeeks.length;
          const label = CATEGORY_LABELS[biggestCat].toLowerCase();
          const absDelta = Math.abs(biggestChange);
          if (changeDir === "down") {
            summary = `${label} language dropped ${absDelta}% over ${numWeeks} wk${numWeeks > 1 ? "s" : ""}`;
          } else {
            summary = `${label} language rose ${absDelta}% over ${numWeeks} wk${numWeeks > 1 ? "s" : ""}`;
          }
        }
      }
    }

    return { weeks: sortedWeeks, trendSeries: series, trendSummary: summary };
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

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

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
    return (
      <View style={styles.compactRow}>
        <View style={styles.compactIconWrap}>
          <Ionicons name="analytics" size={18} color="rgba(255,255,255,0.4)" />
        </View>
        <View style={styles.compactTextCol}>
          <Text style={styles.compactTitle}>Insights</Text>
          <Text style={styles.compactSub} numberOfLines={1}>
            Start reframing to unlock patterns
          </Text>
        </View>
      </View>
    );
  }

  const summaryText = trendSummary
    ? trendSummary
    : topCategory
      ? `Top: ${CATEGORY_LABELS[topCategory.category]} (${topCategory.pct}%)`
      : `${totalWords} distortions found`;

  if (!alwaysExpanded && !expanded) {
    return (
      <Pressable onPress={toggleExpanded} style={styles.compactRow}>
        <MiniDonut data={donutData} size={36} />
        <View style={styles.compactTextCol}>
          <Text style={styles.compactTitle}>Insights</Text>
          <Text style={styles.compactSub} numberOfLines={1}>
            {summaryText}
          </Text>
        </View>
        <View style={styles.compactRight}>
          <View style={styles.compactBadge}>
            <Text style={styles.compactBadgeText}>{totalWords}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {!alwaysExpanded && (
        <Pressable onPress={toggleExpanded} style={styles.expandedHeader}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.4)" />
        </Pressable>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category Breakdown</Text>
        <View style={styles.donutRow}>
          <DonutChart data={donutData} size={130} />
          <View style={styles.legend}>
            {donutData
              .filter((d) => d.count > 0)
              .map((d) => (
                <View key={d.category} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: CATEGORY_COLORS[d.category] },
                    ]}
                  />
                  <View>
                    <Text style={styles.legendLabel}>
                      {CATEGORY_LABELS[d.category]}
                    </Text>
                    <Text style={styles.legendPct}>{d.pct}%</Text>
                  </View>
                </View>
              ))}
          </View>
        </View>
      </View>

      {weeks.length >= 2 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Trends</Text>
          <View style={styles.trendChartWrap}>
            <TrendChart
              weeks={weeks}
              series={trendSeries.filter((s) =>
                s.points.some((p) => p > 0)
              )}
              width={280}
              height={110}
            />
          </View>
          <View style={styles.trendLegend}>
            {SIGNIFICANT_CATEGORIES.filter((cat) =>
              trendSeries.find((s) => s.category === cat)?.points.some((p) => p > 0)
            ).map((cat) => (
              <View key={cat} style={styles.trendLegendItem}>
                <View
                  style={[
                    styles.trendLegendLine,
                    { backgroundColor: CATEGORY_COLORS[cat] },
                  ]}
                />
                <Text style={styles.trendLegendLabel}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </View>
            ))}
          </View>
          {trendSummary && (
            <View style={styles.trendSummaryBox}>
              <Text style={styles.trendSummaryText}>{trendSummary}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Patterns</Text>
          {!patternsLoading && (
            <Pressable onPress={loadPatterns} style={styles.refreshBtn}>
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.cardSubtitle}>
          AI-observed patterns in your thinking
        </Text>
        {patternsLoading ? (
          <View style={styles.patternLoadingRow}>
            <ActivityIndicator size="small" color={Colors.textSecondary} />
            <PatternSkeleton />
            <PatternSkeleton />
          </View>
        ) : patternsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Could not load patterns. Tap Refresh to try again.
            </Text>
          </View>
        ) : patterns.length === 0 ? (
          <Text style={styles.noPatternsText}>
            No patterns detected yet — keep journaling!
          </Text>
        ) : (
          patterns.map((p, i) => (
            <View key={i} style={styles.patternCard}>
              <Text style={styles.patternBullet}>✦</Text>
              <Text style={styles.patternText}>{p}</Text>
            </View>
          ))
        )}
      </View>
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
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 4,
    gap: 12,
  },
  compactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  compactTextCol: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  compactSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  compactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  compactBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  container: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  expandedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingRight: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legend: {
    flex: 1,
    marginLeft: 14,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  legendPct: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  trendChartWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  trendLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  trendLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trendLegendLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  trendLegendLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  trendSummaryBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  trendSummaryText: {
    fontSize: 12,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  patternLoadingRow: {
    gap: 10,
    paddingTop: 4,
  },
  skeletonCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  skeletonLine: {
    height: 10,
    backgroundColor: Colors.neutral,
    borderRadius: 5,
  },
  patternCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  patternBullet: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  patternText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  errorText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  noPatternsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  refreshBtnText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
});
