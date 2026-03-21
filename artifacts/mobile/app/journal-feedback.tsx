import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useJournalSession } from '@/context/JournalSessionContext';
import type { FeedbackPayload, HighlightItem } from '@/types/journal';

const SEVERITY_COLORS = {
  high: '#FF5B5B',
  med: '#F97316',
  low: '#FACC15',
};

function HighlightCard({ item }: { item: HighlightItem }) {
  const before = item.quote.slice(0, item.startIndex);
  const matched = item.quote.slice(item.startIndex, item.endIndex);
  const after = item.quote.slice(item.endIndex);
  const color = SEVERITY_COLORS[item.severity];

  return (
    <View style={styles.highlightCard}>
      <View style={[styles.severityBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
        <Text style={[styles.severityText, { color }]}>{item.categoryLabel}</Text>
      </View>
      <Text style={styles.quoteText}>
        <Text>{before}</Text>
        <Text style={[styles.matchedText, { backgroundColor: '#FBBF2420', color: '#FBBF24' }]}>
          {matched}
        </Text>
        <Text>{after}</Text>
      </Text>
      <Text style={styles.reframeHint}>{item.reframeHint}</Text>
    </View>
  );
}

export default function JournalFeedbackScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clearSession } = useJournalSession();
  const params = useLocalSearchParams<{ payload: string }>();

  let payload: FeedbackPayload | null = null;
  try {
    if (params.payload) {
      payload = JSON.parse(params.payload) as FeedbackPayload;
    }
  } catch {
    payload = null;
  }

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearSession();
    router.replace('/');
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Session Complete</Text>
        <Pressable
          onPress={handleDone}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {payload?.dominantEmotions && payload.dominantEmotions.length > 0 && (
          <View style={styles.emotionsCard}>
            <Text style={styles.sectionLabel}>Today's session touched on</Text>
            <Text style={styles.emotionsText}>
              {payload.dominantEmotions.join(', ')}
            </Text>
          </View>
        )}

        {(!payload || payload.highlights.length === 0) ? (
          <View style={styles.emptyCard}>
            <Ionicons name="heart-outline" size={32} color="rgba(0,229,160,0.6)" />
            <Text style={styles.emptyText}>
              {"Nothing flagged this session — you wrote with clarity and balance."}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Patterns noticed</Text>
            {payload.highlights.map((item, idx) => (
              <HighlightCard key={`${item.turnId}-${idx}`} item={item} />
            ))}
          </>
        )}

        {payload && payload.reflectionPrompts.length > 0 && (
          <View style={styles.reflectionsSection}>
            <Text style={styles.sectionTitle}>Reflections</Text>
            {payload.reflectionPrompts.map((q, idx) => (
              <View key={idx} style={styles.reflectionCard}>
                <View style={styles.reflectionDot} />
                <Text style={styles.reflectionText}>{q}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={handleDone}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginTop: 24 })}
        >
          <View style={styles.doneFullBtn}>
            <Text style={styles.doneFullBtnText}>Done</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: -0.4,
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  emotionsCard: {
    backgroundColor: '#12121A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emotionsText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  highlightCard: {
    backgroundColor: '#14141E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 10,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  quoteText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 23,
  },
  matchedText: {
    fontFamily: 'Inter_600SemiBold',
    borderRadius: 3,
    paddingHorizontal: 2,
  },
  reframeHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  reflectionsSection: {
    gap: 10,
  },
  reflectionCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#12121A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    alignItems: 'flex-start',
  },
  reflectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(155,92,246,0.7)',
    marginTop: 8,
    flexShrink: 0,
  },
  reflectionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  emptyCard: {
    backgroundColor: 'rgba(0,229,160,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.15)',
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(0,229,160,0.7)',
    lineHeight: 22,
    textAlign: 'center',
  },
  doneFullBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  doneFullBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },
});
