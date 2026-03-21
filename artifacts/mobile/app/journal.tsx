import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useJournalSession } from '@/context/JournalSessionContext';
import { matchPatterns } from '@/utils/patternMatcher';
import { getNextPrompt } from '@/utils/promptRotator';
import type { Analysis, Turn } from '@/types/journal';

const CHECKIN_PROMPTS = [
  "You've shared quite a lot — how are you feeling right now? We can keep going, or take a breath and reflect on what's come up.",
  "That's a lot to hold. Do you want to stay with this, or would it feel good to start finding your way out of it?",
  "We've gone somewhere real today. Do you want to keep exploring, or shall we start to bring this home?",
  "You've done some heavy lifting. Want to continue, or are you ready to ease off and see what you've uncovered?",
];

function randomCheckinPrompt(): string {
  return CHECKIN_PROMPTS[Math.floor(Math.random() * CHECKIN_PROMPTS.length)];
}

const SEVERITY_COLORS = {
  high: '#FF5B5B',
  med: '#F97316',
  low: '#6B6B8A',
};

function PatternChip({ label, severity }: { label: string; severity: 'high' | 'med' | 'low' }) {
  return (
    <View style={[styles.chip, { borderColor: SEVERITY_COLORS[severity] }]}>
      <Text style={[styles.chipText, { color: SEVERITY_COLORS[severity] }]}>{label}</Text>
    </View>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  const uniqueLabels = Array.from(
    new Map(turn.flags.map((f) => [f.patternId, f])).values(),
  );
  return (
    <View style={styles.turnCard}>
      <Text style={styles.turnText}>{turn.rawText}</Text>
      {uniqueLabels.length > 0 && (
        <View style={styles.chipRow}>
          {uniqueLabels.map((f) => (
            <PatternChip key={f.patternId} label={f.category.replace(/_/g, ' ')} severity={f.severity} />
          ))}
        </View>
      )}
    </View>
  );
}

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : '';

async function callAnalyseTurn(
  turnId: string,
  sessionId: string,
  rawText: string,
): Promise<Analysis | null> {
  try {
    const res = await fetch(`${API_BASE}/api/analyse-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnId, sessionId, rawText }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as Analysis;
  } catch {
    return null;
  }
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const {
    session,
    turns,
    analyses,
    startSession,
    addTurn,
    storeAnalysis,
    wrapSession,
    acknowledgeCheckIn,
    markCheckInShown,
  } = useJournalSession();

  const params = useLocalSearchParams<{ draft?: string }>();
  const [inputText, setInputText] = useState(params.draft ?? '');
  const [checkinPrompt, setCheckinPrompt] = useState(() => randomCheckinPrompt());
  const [ascentTurnCount, setAscentTurnCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        startSession('sad');
        setInputText(params.draft ?? '');
        setCheckinPrompt(randomCheckinPrompt());
        setAscentTurnCount(0);
      }
    }, [session]),
  );

  const lastAnalysis = analyses.length > 0 ? analyses[analyses.length - 1] : null;
  const lastAnalysisNoteworthy = lastAnalysis?.noteworthy ?? false;
  const currentPhase = session?.sessionPhase ?? 'descent';
  const checkInState = session?.checkInState ?? 'none';

  const followUpPrompt = turns.length > 0
    ? getNextPrompt(turns.length, lastAnalysisNoteworthy, currentPhase)
    : null;

  const canSend = inputText.trim().length > 0;

  useEffect(() => {
    if (checkInState === 'pending') {
      markCheckInShown();
    }
  }, [checkInState]);

  const handleSend = () => {
    if (!canSend || !session) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const text = inputText.trim();
    setInputText('');

    const flags = matchPatterns(text);
    const turn = addTurn(text, flags);

    if (currentPhase === 'ascent') {
      setAscentTurnCount((c) => c + 1);
    }

    if (!turn) return;
    callAnalyseTurn(turn.id, session.id, text).then((analysis) => {
      if (analysis) {
        storeAnalysis(analysis);
      }
    });

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const payload = wrapSession();
    router.replace({
      pathname: '/journal-feedback',
      params: { payload: JSON.stringify(payload) },
    });
  };

  const handleKeepGoing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    acknowledgeCheckIn('continuing');
  };

  const handleWindDown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    acknowledgeCheckIn('wrapping');
    const payload = wrapSession();
    router.replace({
      pathname: '/journal-feedback',
      params: { payload: JSON.stringify(payload) },
    });
  };

  const showCheckin = checkInState === 'shown' || checkInState === 'pending';
  const showAscentNudge = currentPhase === 'ascent' && ascentTurnCount >= 3;

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={styles.headerBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
          </View>
        </Pressable>

        <Text style={styles.headerTitle}>Journal</Text>

        <Pressable
          onPress={handleFinish}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={[styles.headerBtn, styles.finishBtn]}>
            <Text style={styles.finishBtnText}>Finish</Text>
          </View>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.length === 0 && (
            <Text style={styles.emptyHint}>
              This is your space. Write whatever comes to mind.
            </Text>
          )}

          {turns.map((turn) => (
            <TurnCard key={turn.id} turn={turn} />
          ))}

          {showCheckin && (
            <View style={styles.checkinCard}>
              <Text style={styles.checkinText}>{checkinPrompt}</Text>
              <View style={styles.checkinBtns}>
                <Pressable
                  onPress={handleKeepGoing}
                  style={({ pressed }) => [styles.checkinBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.checkinBtnText}>Keep going</Text>
                </Pressable>
                <Pressable
                  onPress={handleWindDown}
                  style={({ pressed }) => [styles.checkinBtnAlt, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.checkinBtnAltText}>{"Let's ease off"}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {showAscentNudge && !showCheckin && (
            <View style={styles.nudgeCard}>
              <Text style={styles.nudgeText}>
                {"You've covered a lot of ground. Whenever you're ready, tap Finish to see your reflections."}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom + 6, 18) }]}>
          {followUpPrompt && !showCheckin && (
            <Text style={styles.followUpLabel}>{followUpPrompt}</Text>
          )}
          <View style={styles.inputCard}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Write here…"
              placeholderTextColor="rgba(255,255,255,0.22)"
              multiline
              maxLength={1000}
              textAlignVertical="center"
              selectionColor="rgba(255,255,255,0.5)"
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              // @ts-ignore web only
              outlineWidth={0}
              outlineStyle="none"
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <View style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnInactive]}>
                <Ionicons
                  name="send"
                  size={17}
                  color={canSend ? '#000' : '#fff'}
                  style={{ marginLeft: 2 }}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtn: {
    width: 'auto',
    paddingHorizontal: 14,
  },
  finishBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 40,
  },
  turnCard: {
    backgroundColor: '#1A1A24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 8,
  },
  turnText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
  },
  checkinCard: {
    backgroundColor: '#1E1A2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(155,92,246,0.3)',
    padding: 16,
    gap: 14,
  },
  checkinText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  checkinBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  checkinBtn: {
    flex: 1,
    backgroundColor: 'rgba(155,92,246,0.2)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(155,92,246,0.5)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  checkinBtnText: {
    color: '#C084FC',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  checkinBtnAlt: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  checkinBtnAltText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  nudgeCard: {
    backgroundColor: 'rgba(0,229,160,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.2)',
    padding: 14,
  },
  nudgeText: {
    color: 'rgba(0,229,160,0.8)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.background,
    gap: 6,
  },
  followUpLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#171720',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingLeft: 18,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    maxHeight: 120,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#fff',
  },
  sendBtnInactive: {
    backgroundColor: '#3A3A3A',
    opacity: 0.5,
  },
});
