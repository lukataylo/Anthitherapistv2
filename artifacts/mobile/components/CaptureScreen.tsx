import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGame } from "@/context/GameContext";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";

interface CaptureScreenProps {
  onSubmit: (thought: string) => void;
  isLoading: boolean;
}

const PLACEHOLDER = "What's on your mind?";

export function CaptureScreen({ onSubmit, isLoading }: CaptureScreenProps) {
  const { thought, setThought } = useGame();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const sendScale = useSharedValue(1);
  const sendOpacity = useSharedValue(0);
  const micOpacity = useSharedValue(1);

  const canSend = thought.trim().length > 0 && !isLoading;

  useEffect(() => {
    sendOpacity.value = withTiming(canSend ? 1 : 0.3, { duration: 180 });
    micOpacity.value = withTiming(canSend ? 0 : 1, { duration: 180 });
  }, [canSend]);

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendOpacity.value,
  }));

  const micBtnStyle = useAnimatedStyle(() => ({
    opacity: micOpacity.value,
  }));

  const handleSubmit = () => {
    if (!canSend) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendScale.value = withSpring(0.88, { damping: 6 }, () => {
      sendScale.value = withSpring(1, { damping: 8 });
    });
    onSubmit(thought.trim());
  };

  const handleMicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inputRef.current?.focus();
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ThinkingAnimation />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={thought}
          onChangeText={setThought}
          placeholder={PLACEHOLDER}
          placeholderTextColor="rgba(255,255,255,0.22)"
          multiline
          maxLength={400}
          textAlignVertical="top"
          selectionColor="#2196F3"
          autoFocus={false}
          scrollEnabled
        />

        <View style={styles.toolbar}>
          <Animated.View style={micBtnStyle}>
            <Pressable
              onPress={handleMicPress}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={12}
            >
              <Ionicons name="mic-outline" size={26} color="rgba(255,255,255,0.55)" />
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSend}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            hitSlop={8}
          >
            <Animated.View style={[styles.sendBtn, sendBtnStyle]}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    lineHeight: 30,
    paddingTop: 8,
    paddingBottom: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2196F3",
    alignItems: "center",
    justifyContent: "center",
  },
});
