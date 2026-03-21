import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useHistory } from "@/context/HistoryContext";
import { InsightsSection } from "@/components/InsightsSection";
import { Colors } from "@/constants/colors";

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries } = useHistory();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={styles.headerTitle}>Insights</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color="rgba(255,255,255,0.12)" />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete some reframing sessions to see your patterns here.
            </Text>
          </View>
        ) : (
          <InsightsSection entries={entries} alwaysExpanded />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
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
    maxWidth: 240,
    lineHeight: 18,
  },
});
