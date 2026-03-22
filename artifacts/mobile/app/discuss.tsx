/**
 * Discuss screen — Socratic coaching mode.
 *
 * This screen presents a chat-style interface where Claude guides the user
 * to recognise their own thinking patterns through open-ended Socratic
 * questions. Claude never labels or diagnoses a cognitive distortion; it
 * only asks empathetic, curious questions.
 *
 * ## Conversation lifecycle
 *
 * Each session is persisted server-side via the /api/discuss endpoint which
 * returns a conversationId. The ID is tracked in component state and passed
 * back on every subsequent request so all turns are appended to the same
 * conversation in the database. On screen unmount the conversationId is stored
 * in AsyncStorage so the session reference is preserved across navigations
 * (even if the UI does not yet surface a resume flow).
 *
 * The conversation opens with a single welcome message from Claude generated
 * via the API on mount. Subsequent exchanges append to the `messages` array
 * which is sent in full on each request (Claude needs the history for context).
 *
 * ## Layout
 *
 * - ScrollView of chat bubbles: user messages right-aligned, Claude messages
 *   left-aligned, matching the app's dark glassmorphic aesthetic.
 * - A typing indicator (three animated dots) appears while waiting for Claude.
 * - A text input + send button at the bottom, keyboard-aware.
 * - A "clear" button in the top-right resets the conversation.
 */

import React, { useEffect, useRef, useState } from "react";
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
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  interpolateColor,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDiscuss } from "@workspace/api-client-react";
import type { DiscussMessage } from "@workspace/api-client-react";
import { Colors } from "@/constants/colors";

const CONVERSATION_ID_KEY = "discuss_last_conversation_id";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  retryHistory?: ChatMessage[] | null;
};

const WELCOME_SEED: DiscussMessage = {
  role: "user",
  content: "Hello, I'd like to talk through something on my mind.",
};

let _msgId = 0;
function nextId() {
  return String(++_msgId);
}

let _sessionId = 0;
function nextSessionId() {
  return ++_sessionId;
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 + delay }),
        withTiming(0.3, { duration: 400 + delay })
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.typingDot, style]} />;
}

function TypingIndicator() {
  return (
    <View style={styles.bubbleRowLeft}>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        <TypingDot delay={0} />
        <TypingDot delay={80} />
        <TypingDot delay={160} />
      </View>
    </View>
  );
}

function ChatBubble({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry?: (history: ChatMessage[] | null) => void;
}) {
  const isUser = message.role === "user";
  if (message.isError) {
    return (
      <View style={styles.bubbleRowLeft}>
        <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleError]}>
          <Text style={styles.bubbleTextError}>{message.content}</Text>
          <Pressable
            onPress={() => onRetry?.(message.retryHistory ?? null)}
            hitSlop={8}
            style={({ pressed }) => [styles.retryBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <View style={isUser ? styles.bubbleRowRight : styles.bubbleRowLeft}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export default function DiscussScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const sessionRef = useRef<number>(0);
  const conversationIdRef = useRef<number | undefined>(undefined);

  const sendActive = useSharedValue(0);
  const mutation = useDiscuss();

  const canSend = inputText.trim().length > 0 && !isWaiting;

  useEffect(() => {
    sendActive.value = withTiming(canSend ? 1 : 0, { duration: 200 });
  }, [canSend]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + sendActive.value * 0.65,
    backgroundColor: interpolateColor(
      sendActive.value,
      [0, 1],
      ["#3A3A3A", "#FFFFFF"]
    ),
  }));

  useEffect(() => {
    return () => {
      if (conversationIdRef.current !== undefined) {
        AsyncStorage.setItem(
          CONVERSATION_ID_KEY,
          String(conversationIdRef.current)
        ).catch(() => {});
      }
    };
  }, []);

  const appendReply = (reply: string, conversationId: number, forSession: number) => {
    if (forSession !== sessionRef.current) return;
    conversationIdRef.current = conversationId;
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: "assistant",
      content: reply,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsWaiting(false);
    setTimeout(() => scrollToBottom(), 100);
  };

  const appendError = (forSession: number, history: ChatMessage[] | null) => {
    if (forSession !== sessionRef.current) return;
    setIsWaiting(false);
    const errMsg: ChatMessage = {
      id: nextId(),
      role: "assistant",
      content: "Something went wrong.",
      isError: true,
      retryHistory: history,
    };
    setMessages((prev) => [...prev, errMsg]);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const sendToAPI = (history: ChatMessage[]) => {
    const forSession = sessionRef.current;
    const apiMessages: DiscussMessage[] = history
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
    mutation.mutate(
      {
        data: {
          messages: apiMessages,
          conversationId: conversationIdRef.current,
        },
      },
      {
        onSuccess(data) {
          appendReply(data.reply, data.conversationId, forSession);
        },
        onError(err) {
          console.error("Discuss error:", err);
          appendError(forSession, history);
        },
      }
    );
  };

  const startNewSession = (apiMessages: DiscussMessage[]) => {
    conversationIdRef.current = undefined;
    sessionRef.current = nextSessionId();
    const forSession = sessionRef.current;
    setIsWaiting(true);
    mutation.mutate(
      { data: { messages: apiMessages } },
      {
        onSuccess(data) {
          appendReply(data.reply, data.conversationId, forSession);
        },
        onError(err) {
          console.error("Discuss error:", err);
          appendError(forSession, null);
        },
      }
    );
  };

  const handleRetry = (history: ChatMessage[] | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (history === null) {
      setMessages([]);
      startNewSession([WELCOME_SEED]);
      return;
    }
    const withoutError = history.filter((m) => !m.isError);
    setMessages(withoutError);
    setIsWaiting(true);
    setTimeout(() => scrollToBottom(), 60);
    sendToAPI(withoutError);
  };

  useEffect(() => {
    startNewSession([WELCOME_SEED]);
  }, []);

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const text = inputText.trim();
    setInputText("");

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsWaiting(true);
    setTimeout(() => scrollToBottom(), 60);

    sendToAPI(updatedMessages);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([]);
    setInputText("");
    startNewSession([WELCOME_SEED]);
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <StatusBar style="light" />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 14 },
        ]}
      >
        <Text style={styles.headerTitle}>Discuss</Text>
        <Pressable
          onPress={handleClear}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={styles.clearBtn}>
            <Ionicons name="refresh-outline" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.clearBtnText}>Clear</Text>
          </View>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom()}
        >
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onRetry={handleRetry}
            />
          ))}
          {isWaiting && <TypingIndicator />}
        </ScrollView>

        <View
          style={[
            styles.inputRow,
            { paddingBottom: Math.max(insets.bottom + 6, 18) },
          ]}
        >
          <View style={styles.inputCard}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Share what's on your mind…"
              placeholderTextColor="rgba(255,255,255,0.22)"
              multiline
              maxLength={600}
              textAlignVertical="center"
              selectionColor="rgba(255,255,255,0.5)"
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              editable={!isWaiting}
              // @ts-ignore — web only
              outlineWidth={0}
              outlineStyle="none"
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Animated.View style={[styles.sendBtn, sendBtnStyle]}>
                <Ionicons
                  name="send"
                  size={17}
                  color={canSend ? "#000" : "#fff"}
                  style={{ marginLeft: 2 }}
                />
              </Animated.View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  clearBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.2,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  bubbleRowLeft: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  bubbleRowRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bubbleUser: {
    backgroundColor: "#fff",
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderBottomLeftRadius: 6,
  },
  bubbleTextUser: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#000",
    lineHeight: 22,
  },
  bubbleTextAssistant: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.88)",
    lineHeight: 22,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#000",
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#171717",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingLeft: 18,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    maxHeight: 120,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleError: {
    gap: 8,
  },
  bubbleTextError: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,180,180,0.8)",
    lineHeight: 22,
  },
  retryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  retryBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
  },
});
