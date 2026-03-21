/**
 * Home screen — the Reframe tab.
 *
 * This screen is the orchestration layer between the API, the three context
 * providers, and the CaptureScreen component. It intentionally contains no
 * UI of its own — all rendering is delegated to CaptureScreen.
 *
 * ## User flow
 *
 *  1. User types a thought and taps Send
 *  2. `handleSubmitThought` stores the text in `pendingThoughtRef` and fires
 *     the React Query mutation (POST /api/reframe)
 *  3. While the request is in-flight, `mutation.isPending` is true and
 *     CaptureScreen renders the ThinkingAnimation loading state
 *  4. `onSuccess` maps the API response into WordAnalysis[], creates a history
 *     entry, records the streak, and hands the words to GameContext via `setWords()`
 *  5. GameContext transitions the screen to "cloud" (annotated thought review)
 *  6. As the user reframes words, GameContext updates `reframedWords`
 *  7. The useEffect on `reframedWords` syncs those changes back to HistoryContext
 *
 * ## Why refs instead of state for pendingThought and entryId?
 *
 * `pendingThoughtRef` and `entryIdRef` are mutable refs rather than state
 * because they bridge async boundaries (mutation callbacks, useEffect) where
 * stale closure bugs are common. We don't want a re-render when these values
 * change — we just need to read the latest value inside a callback.
 *
 * ## Streak animation
 *
 * `streakJustIncremented` is state (not a ref) because it drives a visual
 * change in StreakBadge. It's set to true on API success and automatically
 * cleared after 1.5 s so the animation plays once and then stops.
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/colors";
import { useStreak } from "@/context/StreakContext";
import { useSessionRuntime } from "@/context/SessionRuntimeContext";
import { useHistory } from "@/context/HistoryContext";

export default function HomeScreen() {
  const {
    session,
    turns,
    checkInPrompt,
    lastPrompt,
    submitTurn,
    chooseCheckIn,
    wrapSession,
    clearSession,
  } = useSessionRuntime();
  const { refresh } = useHistory();
  const { recordReflection } = useStreak();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = text.trim().length > 0 && !busy;
  const checkInPending = session?.checkInState === "pending" && Boolean(checkInPrompt);

  const messages = useMemo(() => {
    const trail: Array<{ role: "user" | "system"; content: string }> = [];
    for (let i = 0; i < turns.length; i++) {
      trail.push({ role: "user", content: turns[i].rawText });
    }
    if (lastPrompt) {
      trail.push({ role: "system", content: lastPrompt });
    }
    return trail;
  }, [turns, lastPrompt]);

  const onSend = async () => {
    if (!canSend) return;
    const value = text.trim();
    setBusy(true);
    try {
      await submitTurn(value, "text");
      recordReflection();
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const onWrap = async () => {
    setBusy(true);
    try {
      await wrapSession();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Reframe</Text>
        {session ? (
          <Pressable onPress={() => void clearSession()}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {messages.length === 0 ? (
          <Text style={styles.empty}>Share what is on your mind.</Text>
        ) : (
          messages.map((msg, idx) => (
            <View key={idx} style={msg.role === "user" ? styles.userBubble : styles.systemBubble}>
              <Text style={msg.role === "user" ? styles.userText : styles.systemText}>{msg.content}</Text>
            </View>
          ))
        )}
      </ScrollView>
      {checkInPending && (
        <View style={styles.checkIn}>
          <Text style={styles.checkInText}>{checkInPrompt}</Text>
          <View style={styles.checkInRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => void chooseCheckIn("continue")}>
              <Text style={styles.secondaryText}>Keep going</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => void chooseCheckIn("wrap")}>
              <Text style={styles.primaryText}>Let's ease off</Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={styles.bottom}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="What's on your mind..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          multiline
        />
        <View style={styles.controls}>
          <Pressable style={styles.secondaryBtn} onPress={() => void onWrap()}>
            <Text style={styles.secondaryText}>Wrap up</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, !canSend && { opacity: 0.4 }]}
            onPress={() => void onSend()}
            disabled={!canSend}
          >
            <Text style={styles.primaryText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 54,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 28,
  },
  clear: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 20,
  },
  empty: {
    marginTop: 12,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter_400Regular",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "86%",
  },
  systemBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1a1a1a",
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "86%",
  },
  userText: {
    color: "#000",
    fontFamily: "Inter_500Medium",
    lineHeight: 21,
  },
  systemText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    fontStyle: "italic",
  },
  checkIn: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  checkInText: {
    color: "rgba(255,255,255,0.88)",
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  checkInRow: {
    flexDirection: "row",
    gap: 10,
  },
  bottom: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  input: {
    minHeight: 100,
    maxHeight: 140,
    backgroundColor: "#171717",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 16,
    color: "#fff",
    padding: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryText: {
    color: "#000",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
