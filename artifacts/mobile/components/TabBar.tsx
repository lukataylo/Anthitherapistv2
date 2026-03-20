import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStreak } from "@/context/StreakContext";

const TABS: Array<{
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  {
    name: "index",
    icon: "create-outline",
    iconActive: "create",
    label: "Reframe",
  },
  {
    name: "history",
    icon: "time-outline",
    iconActive: "time",
    label: "History",
  },
];

function TabItem({
  tab,
  isFocused,
  onPress,
  badge,
}: {
  tab: (typeof TABS)[0];
  isFocused: boolean;
  onPress: () => void;
  badge?: "active" | "inactive";
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 8 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.tabItem} hitSlop={8}>
      <Animated.View style={[styles.tabInner, animStyle]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={isFocused ? tab.iconActive : tab.icon}
            size={24}
            color={isFocused ? "#fff" : "rgba(255,255,255,0.35)"}
          />
          {badge ? (
            <View style={[
              styles.badge,
              { backgroundColor: badge === "active" ? "#FF9500" : "rgba(255,255,255,0.25)" },
            ]} />
          ) : null}
        </View>
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? "#fff" : "rgba(255,255,255,0.35)" },
          ]}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { currentStreak, reflectedToday } = useStreak();

  const getBadge = (tabName: string): "active" | "inactive" | undefined => {
    if (tabName === "index" && currentStreak > 0) {
      return reflectedToday ? "active" : "inactive";
    }
    return undefined;
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      <View style={styles.bar}>
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;
          return (
            <TabItem
              key={tab.name}
              tab={tab}
              isFocused={isFocused}
              badge={getBadge(tab.name)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  bar: {
    flexDirection: "row",
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
});
