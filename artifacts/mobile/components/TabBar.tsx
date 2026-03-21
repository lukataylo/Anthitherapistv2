import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStreak } from "@/context/StreakContext";

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabDef = {
  name: string;
  renderIcon: (focused: boolean) => React.ReactNode;
  label: string;
};

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

// ─── Animated tab item ────────────────────────────────────────────────────────

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
  const iconScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
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
        {/* Active highlight pill behind icon */}
        {isFocused && (
          <View style={styles.activeHighlight} />
        )}

        {/* Icon */}
        <View style={styles.iconWrap}>
          {tab.renderIcon(isFocused)}
          {hasBadge && <View style={styles.badge} />}
        </View>

        {/* Label */}
        <Text style={[styles.label, isFocused && styles.labelFocused]}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main tab bar ─────────────────────────────────────────────────────────────

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { currentStreak, reflectedToday } = useStreak();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + 6, 18) },
      ]}
    >
      {/* Glassmorphic pill */}
      <View style={styles.pillOuter}>
        {Platform.OS === "web" ? (
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
        {/* Border overlay (BlurView ignores borderWidth on some platforms) */}
        <View style={styles.pillBorder} pointerEvents="none" />
      </View>
    </View>
  );
}

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
        const hasBadge =
          tab.name === "index" && currentStreak > 0 && !reflectedToday;

        return (
          <TabItem
            key={tab.name}
            tab={tab}
            isFocused={isFocused}
            hasBadge={hasBadge}
            onPress={() => {
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    // Drop shadow
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
    // Web glass blur
    ...Platform.select({
      web: {
        // @ts-ignore
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
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.38)",
  },
  labelFocused: {
    color: "#fff",
  },
});
