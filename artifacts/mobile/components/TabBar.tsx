/**
 * TabBar — custom bottom navigation bar replacing Expo Router's default.
 *
 * Renders a floating "pill" with a glassmorphic blur effect (expo-blur on
 * native; CSS backdrop-filter on web). Two tabs: Reframe and History.
 *
 * ## Tab item animations
 *
 * Each `TabItem` handles two independent animations using React Native's
 * built-in `Animated` API (not Reanimated — the animations are simple enough
 * that the overhead of Reanimated isn't justified here):
 *
 *  - **Active dot** — a small white dot below the icon that springs in/out
 *    when focus changes. The dot's scale goes 0→1 (spring) and opacity 0→1
 *    (timed) simultaneously. Giving both values their own Animated.Value keeps
 *    them independently interpolatable even though they run in parallel.
 *
 *  - **Icon press bounce** — when the user taps a tab, the icon squishes to
 *    0.82× scale and bounces back. This provides immediate tactile feedback
 *    before the navigation transition completes.
 *
 * ## Active highlight pill
 *
 * A rounded rectangle (rgba white, 9% opacity) is rendered behind the icon
 * when the tab is focused. This is conditionally mounted (not animated) because
 * the pill itself only needs to appear/disappear — the icon scale animation
 * already draws the eye during the transition.
 *
 * ## Streak badge dot
 *
 * An orange dot appears on the Reframe tab icon when `currentStreak > 0 AND
 * !reflectedToday`. This nudges the user to keep their streak alive. The dot
 * disappears immediately after they submit a thought (StreakContext updates
 * `reflectedToday` to true). No animation on the badge — it relies on the
 * ambient orange colour to attract attention without being distracting.
 *
 * ## Cross-platform blur
 *
 * `BlurView` from expo-blur only works on iOS and Android. On web, a fallback
 * `View` with CSS `backdropFilter: "blur(24px)"` is used instead. The `@ts-ignore`
 * comment suppresses a TypeScript error since React Native's StyleSheet type
 * doesn't know about web-only CSS properties.
 *
 * ## Navigation emission
 *
 * Rather than calling `navigation.navigate()` directly, the tab bar emits a
 * `tabPress` event and checks `event.defaultPrevented`. This mirrors Expo
 * Router's default behaviour and allows screens to intercept tab presses (e.g.
 * to confirm navigation away from an unsaved state).
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStreak } from "@/context/StreakContext";

type TabDef = {
  name: string;
  renderIcon: (focused: boolean) => React.ReactNode;
  label: string;
};

/**
 * Static tab configuration. Each entry maps an Expo Router route name to an
 * icon renderer. The filled vs outline variant of each icon provides a
 * secondary visual cue for the active tab beyond the dot indicator.
 */
const TABS: TabDef[] = [
  {
    name: "index",
    label: "Reframe",
    renderIcon: (focused) => (
      <MaterialCommunityIcons
        name={focused ? "head-cog" : "head-cog-outline"}
        size={25}
        color={focused ? "#fff" : "rgba(255,255,255,0.38)"}
      />
    ),
  },
  {
    name: "history",
    label: "History",
    renderIcon: (focused) => (
      <Ionicons
        name={focused ? "time" : "time-outline"}
        size={24}
        color={focused ? "#fff" : "rgba(255,255,255,0.38)"}
      />
    ),
  },
];

/**
 * A single tab item with active-state animations and an optional badge dot.
 *
 * `hasBadge` is true for the Reframe tab when the user has a streak but hasn't
 * reflected today — used to surface the streak nudge without a notification.
 */
function TabItem({
  tab,
  isFocused,
  onPress,
  hasBadge,
}: {
  tab: TabDef;
  isFocused: boolean;
  onPress: () => void;
  hasBadge?: boolean;
}) {
  // Independent Animated.Values for spring/timing control on each property
  const dotScale = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const dotOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate the active dot when focus changes
    Animated.parallel([
      Animated.spring(dotScale, {
        toValue: isFocused ? 1 : 0,
        tension: 120,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(dotOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused]);

  const handlePress = () => {
    // Squish-and-bounce press feedback on the icon
    Animated.sequence([
      Animated.timing(iconScale, {
        toValue: 0.82,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.tabItem} hitSlop={10}>
      <Animated.View
        style={[styles.tabInner, { transform: [{ scale: iconScale }] }]}
      >
        {/* Active highlight pill — conditionally mounted (no animation needed) */}
        {isFocused && (
          <View style={styles.activeHighlight} />
        )}

        <View style={styles.iconWrap}>
          {tab.renderIcon(isFocused)}
          {/* Orange dot — visible when streak needs attention */}
          {hasBadge && <View style={styles.badge} />}
        </View>

        {/* Active indicator dot below the icon */}
        <Animated.View
          style={[
            styles.dot,
            { opacity: dotOpacity, transform: [{ scale: dotScale }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { currentStreak, reflectedToday } = useStreak();

  return (
    <View
      style={[
        styles.container,
        // Respect home indicator height on iPhone; use a minimum of 18 px
        { paddingBottom: Math.max(insets.bottom + 6, 18) },
      ]}
    >
      {/* Glassmorphic pill container */}
      <View style={styles.pillOuter}>
        {Platform.OS === "web" ? (
          // Web fallback: CSS backdrop-filter instead of BlurView
          <View style={[styles.pillFallback]}>
            <TabRow
              state={state}
              navigation={navigation}
              currentStreak={currentStreak}
              reflectedToday={reflectedToday}
            />
          </View>
        ) : (
          <BlurView intensity={75} tint="dark" style={styles.pill}>
            <TabRow
              state={state}
              navigation={navigation}
              currentStreak={currentStreak}
              reflectedToday={reflectedToday}
            />
          </BlurView>
        )}
        {/* Border rendered as a separate overlay because BlurView ignores
            borderWidth on some Android and Expo Web versions */}
        <View style={styles.pillBorder} pointerEvents="none" />
      </View>
    </View>
  );
}

/** Renders the row of `TabItem`s inside the pill. Extracted to avoid repeating
 *  the JSX in both the BlurView and fallback View branches above. */
function TabRow({
  state,
  navigation,
  currentStreak,
  reflectedToday,
}: {
  state: BottomTabBarProps["state"];
  navigation: BottomTabBarProps["navigation"];
  currentStreak: number;
  reflectedToday: boolean;
}) {
  return (
    <View style={styles.row}>
      {TABS.map((tab, index) => {
        const isFocused = state.index === index;
        // Show the streak badge only on the Reframe tab when action is needed
        const hasBadge =
          tab.name === "index" && currentStreak > 0 && !reflectedToday;

        return (
          <TabItem
            key={tab.name}
            tab={tab}
            isFocused={isFocused}
            hasBadge={hasBadge}
            onPress={() => {
              // Emit the tabPress event so screens can intercept if needed
              const event = navigation.emit({
                type: "tabPress",
                target: state.routes[index]?.key ?? tab.name,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    alignItems: "center",
    paddingTop: 10,
  },
  pillOuter: {
    position: "relative",
    borderRadius: 36,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
  },
  pill: {
    borderRadius: 36,
    overflow: "hidden",
  },
  pillFallback: {
    borderRadius: 36,
    backgroundColor: "rgba(28, 28, 32, 0.88)",
    ...Platform.select({
      web: {
        // @ts-ignore — CSS-only backdrop blur for web rendering
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      },
    }),
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tabItem: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2,
    position: "relative",
  },
  activeHighlight: {
    position: "absolute",
    width: 40,
    height: 36,
    top: 2,
    alignSelf: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FF9500",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
});
