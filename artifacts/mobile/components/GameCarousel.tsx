import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CARD_W = 168;
const CARD_H = 208;
const ICON_BOX = 52;

type GameDef = {
  id: string;
  name: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  patternColor: string;
  patternType: "chevrons" | "arcs" | "grid" | "rings";
  available: boolean;
};

const GAMES: GameDef[] = [
  {
    id: "sort-tower",
    name: "Sort Tower",
    category: "STACKING",
    icon: "layers",
    bg: "#0C1E2E",
    patternColor: "#1E4A6E",
    patternType: "chevrons",
    available: true,
  },
  {
    id: "reframe-word",
    name: "Word Reframe",
    category: "COGNITION",
    icon: "aperture",
    bg: "#150D26",
    patternColor: "#3A1F6A",
    patternType: "arcs",
    available: false,
  },
  {
    id: "thought-map",
    name: "Thought Map",
    category: "MAPPING",
    icon: "git-network-outline",
    bg: "#0D2015",
    patternColor: "#1A5C30",
    patternType: "grid",
    available: false,
  },
  {
    id: "pattern-break",
    name: "Pattern Break",
    category: "AWARENESS",
    icon: "infinite-outline",
    bg: "#1F1208",
    patternColor: "#6E3A10",
    patternType: "rings",
    available: false,
  },
];

function ChevronsPattern({ color }: { color: string }) {
  const items = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      items.push(
        <View
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            top: row * 38 - 20,
            left: col * 38 - 10,
            width: 28,
            height: 28,
            borderTopWidth: 2,
            borderRightWidth: 2,
            borderColor: color,
            opacity: 0.22,
            transform: [{ rotate: "45deg" }],
          }}
        />
      );
    }
  }
  return <>{items}</>;
}

function ArcsPattern({ color }: { color: string }) {
  const arcs = [
    { size: 280, bottom: -120, right: -120, opacity: 0.18, bw: 1.5 },
    { size: 200, bottom: -80, right: -80, opacity: 0.28, bw: 1.5 },
    { size: 130, bottom: -40, right: -40, opacity: 0.38, bw: 1 },
    { size: 70,  bottom: -5,  right: -5,  opacity: 0.45, bw: 1 },
  ];
  return (
    <>
      {arcs.map((a, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            bottom: a.bottom,
            right: a.right,
            width: a.size,
            height: a.size,
            borderRadius: a.size / 2,
            borderWidth: a.bw,
            borderColor: color,
            opacity: a.opacity,
          }}
        />
      ))}
    </>
  );
}

function GridPattern({ color }: { color: string }) {
  const lines = [];
  for (let i = 0; i < 8; i++) {
    lines.push(
      <View
        key={`v${i}`}
        style={{
          position: "absolute",
          top: -20,
          bottom: -20,
          left: i * 26 - 4,
          width: 1,
          backgroundColor: color,
          opacity: 0.2,
        }}
      />,
      <View
        key={`h${i}`}
        style={{
          position: "absolute",
          left: -10,
          right: -10,
          top: i * 30 - 10,
          height: 1,
          backgroundColor: color,
          opacity: 0.2,
        }}
      />
    );
  }
  return <>{lines}</>;
}

function RingsPattern({ color }: { color: string }) {
  const rings = [
    { size: 220, cx: 20, cy: 140, opacity: 0.14, bw: 10 },
    { size: 140, cx: 60, cy: 160, opacity: 0.18, bw: 8 },
    { size: 80,  cx: 90, cy: 170, opacity: 0.22, bw: 5 },
  ];
  return (
    <>
      {rings.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: r.cy - r.size / 2,
            left: r.cx - r.size / 2,
            width: r.size,
            height: r.size,
            borderRadius: r.size / 2,
            borderWidth: r.bw,
            borderColor: color,
            opacity: r.opacity,
          }}
        />
      ))}
    </>
  );
}

function Pattern({
  type,
  color,
}: {
  type: GameDef["patternType"];
  color: string;
}) {
  if (type === "chevrons") return <ChevronsPattern color={color} />;
  if (type === "arcs") return <ArcsPattern color={color} />;
  if (type === "grid") return <GridPattern color={color} />;
  return <RingsPattern color={color} />;
}

function GameCard({
  game,
  onPress,
}: {
  game: GameDef;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={game.available ? onPress : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: game.bg },
        pressed && game.available && styles.cardPressed,
        !game.available && styles.cardLocked,
      ]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Pattern type={game.patternType} color={game.patternColor} />
      </View>

      {!game.available && (
        <View style={styles.soonPill}>
          <Text style={styles.soonText}>SOON</Text>
        </View>
      )}

      <View style={styles.iconWrap}>
        <Ionicons
          name={game.icon}
          size={24}
          color={game.available ? "#fff" : "rgba(255,255,255,0.35)"}
        />
      </View>

      <View style={styles.cardBottom}>
        <Text
          style={[
            styles.gameName,
            !game.available && styles.gameNameLocked,
          ]}
        >
          {game.name}
        </Text>
        <Text style={styles.gameCategory}>{game.category}</Text>
      </View>
    </Pressable>
  );
}

export function GameCarousel({
  onGamePress,
}: {
  onGamePress: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>GAMES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
        snapToInterval={CARD_W + 12}
        snapToAlignment="start"
      >
        {GAMES.map((g) => (
          <GameCard key={g.id} game={g} onPress={() => onGamePress(g.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 4,
  },
  heading: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 2.5,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: "hidden",
    padding: 16,
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardLocked: {
    opacity: 0.6,
  },
  soonPill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soonText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
  },
  iconWrap: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: ICON_BOX / 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  cardBottom: {
    gap: 3,
  },
  gameName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  gameNameLocked: {
    color: "rgba(255,255,255,0.5)",
  },
  gameCategory: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
