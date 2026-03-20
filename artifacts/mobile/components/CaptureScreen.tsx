import React, { useRef, useState } from "react";
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
  withSequence,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useGame } from "@/context/GameContext";
import { ThinkingAnimation } from "@/components/ThinkingAnimation";

interface CaptureScreenProps {
  onSubmit: (thought: string) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  "I always fail at everything I try",
  "Nobody ever listens to me",
  "I am completely worthless",
  "I can never do anything right",
];

export function CaptureScreen({ onSubmit, isLoading }: CaptureScreenProps) {
  const { thought, setThought } = useGame();
  const insets = useSafeAreaInsets();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const micScale = useSharedValue(1);

  const [currentExample] = useState(
    () => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]
  );

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const handleSubmit = () => {
    if (!thought.trim() || isLoading) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(thought.trim());
  };

  const handleMicPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    inputRef.current?.focus();
    micScale.value = withSequence(
      withSpring(1.2, { damping: 4 }),
      withSpring(1, { damping: 6 })
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 },
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingArea}>
              <ThinkingAnimation />
            </View>
          ) : (
            <>
              <View style={styles.headerArea}>
                <Text style={styles.title}>What's on your mind?</Text>
                <Text style={styles.subtitle}>
                  Speak or type a thought, and we'll help you see it differently.
                </Text>
              </View>

              <Pressable
                onPress={handleMicPress}
                style={({ pressed }) => [
                  styles.micWrapper,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Animated.View style={[styles.micOuter, micStyle]}>
                  <View style={styles.micInner}>
                    <Ionicons name="mic" size={40} color={Colors.text} />
                  </View>
                </Animated.View>
                <Text style={styles.micHint}>Tap to type your thought</Text>
              </Pressable>

              <View style={styles.inputArea}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    isFocused && styles.inputFocused,
                  ]}
                  value={thought}
                  onChangeText={setThought}
                  placeholder={currentExample}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={300}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{thought.length}/300</Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  !thought.trim() && styles.submitBtnDisabled,
                  { opacity: pressed && thought.trim() ? 0.85 : 1 },
                ]}
                onPress={handleSubmit}
                disabled={!thought.trim() || isLoading}
              >
                <Text style={styles.submitText}>Analyse →</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerArea: {
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  micWrapper: {
    alignItems: "center",
    gap: 14,
  },
  micOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.fearDim,
    borderWidth: 1,
    borderColor: Colors.fear,
    alignItems: "center",
    justifyContent: "center",
  },
  micInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  micHint: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  inputArea: {
    width: "100%",
    gap: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    lineHeight: 24,
  },
  inputFocused: {
    borderColor: Colors.fear,
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  submitBtn: {
    backgroundColor: Colors.fear,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  submitBtnDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitText: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
