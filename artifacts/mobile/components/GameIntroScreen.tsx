/**
 * GameIntroScreen — full-screen intro/instruction overlay shown before each mini-game.
 *
 * Renders as a Modal over the History screen. Displays the game's name, icon,
 * a short aim sentence, and 2–3 mechanics bullets. Two actions are available:
 *
 *  - "Play" — calls `onPlay`, which the parent uses to open the real game modal
 *  - Close (×) — calls `onClose`, which dismisses the intro without starting
 *
 * ## Styling
 *
 * Matches the app's dark gradient aesthetic used by the games themselves.
 * Each game passes its own `accentColor` (its `patternColor` from GameCarousel)
 * so the intro screen carries the same hue as the game card.
 *
 * ## Props
 *
 * - `visible`      — controls Modal visibility
 * - `name`         — game name (e.g. "Sort Tower")
 * - `icon`         — Ionicons glyph name
 * - `aim`          — one-sentence description of the game's goal
 * - `mechanics`    — array of 2–3 strings describing how to play
 * - `accentColor`  — hex color used for the icon ring and Play button glow
 * - `onPlay`       — called when the user presses Play
 * - `onClose`      — called when the user presses the close button
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export type GameIntroDef = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  aim: string;
  mechanics: string[];
  accentColor: string;
  bg: string;
};

interface GameIntroScreenProps extends GameIntroDef {
  visible: boolean;
  onPlay: () => void;
  onClose: () => void;
}

export function GameIntroScreen({
  visible,
  name,
  icon,
  aim,
  mechanics,
  accentColor,
  bg,
  onPlay,
  onClose,
}: GameIntroScreenProps) {
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: bg }]}>
        {/* Subtle radial glow behind the icon */}
        <View
          style={[styles.glowCircle, { backgroundColor: accentColor }]}
          pointerEvents="none"
        />

        {/* Close button */}
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { marginTop: insets.top + 12 }]}
          accessibilityLabel="Close intro"
          accessibilityRole="button"
          hitSlop={12}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <Animated.View
          style={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.iconRing,
              {
                borderColor: accentColor + "55",
                backgroundColor: accentColor + "22",
              },
            ]}
          >
            <View
              style={[
                styles.iconInner,
                { backgroundColor: accentColor + "33" },
              ]}
            >
              <Ionicons name={icon} size={36} color="#fff" />
            </View>
          </View>

          {/* Game name */}
          <Text style={styles.gameName}>{name}</Text>

          {/* Aim */}
          <Text style={styles.aim}>{aim}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* How to play */}
          <Text style={styles.howTitle}>HOW TO PLAY</Text>
          <View style={styles.mechanicsWrap}>
            {mechanics.map((m, i) => (
              <View key={i} style={styles.mechRow}>
                <View
                  style={[styles.mechDot, { backgroundColor: accentColor }]}
                />
                <Text style={styles.mechText}>{m}</Text>
              </View>
            ))}
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Play button */}
          <Pressable
            onPress={onPlay}
            style={({ pressed }) => [
              styles.playBtn,
              { backgroundColor: accentColor },
              pressed && styles.playBtnPressed,
            ]}
            accessibilityLabel={`Play ${name}`}
            accessibilityRole="button"
          >
            <Ionicons name="play" size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.playBtnText}>Play</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glowCircle: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.12,
  },
  closeBtn: {
    position: "absolute",
    top: 0,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 100,
    alignItems: "center",
  },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  gameName: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 14,
  },
  aim: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
    maxWidth: 300,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 24,
  },
  howTitle: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2.5,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  mechanicsWrap: {
    alignSelf: "stretch",
    gap: 12,
  },
  mechRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  mechDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  mechText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    height: 56,
    borderRadius: 16,
    marginTop: 12,
  },
  playBtnPressed: {
    opacity: 0.85,
  },
  playBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#000",
    letterSpacing: -0.2,
  },
});
