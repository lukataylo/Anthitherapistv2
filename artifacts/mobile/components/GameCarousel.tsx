/**
 * GameCarousel — horizontally scrollable row of mini-game launcher cards.
 *
 * Displayed at the top of the History screen, above the entry feed. Each card
 * launches a different CBT-themed mini-game modal (managed in history.tsx).
 *
 * ## Game catalogue
 *
 * Five games are currently available. Each entry in `GAMES` describes:
 *  - `id`          — used by the parent's `handleGamePress` to select which modal to open
 *  - `name`        — displayed on the card
 *  - `category`    — therapy skill category (STACKING, REFRAMING, AWARENESS, LANGUAGE)
 *  - `icon`        — Ionicons glyph name
 *  - `bg`          — deep dark card background (each game has a distinct hue)
 *  - `patternColor`— the colour of the decorative background pattern
 *  - `patternType` — which SVG-style pattern to render ("chevrons"|"arcs"|"grid"|"rings")
 *  - `available`   — if false, an overlay "SOON" pill is shown and the card is non-interactive
 *
 * ## Decorative patterns
 *
 * Each game card has a unique low-opacity geometric background pattern to give
 * the cards a premium "game cartridge" look without requiring image assets.
 * All four pattern types are pure View compositions:
 *
 *  - **ChevronsPattern** — a 5×5 grid of 45° rotated squares (stacking metaphor)
 *  - **ArcsPattern** — four concentric quarter-circles from the bottom-right corner
 *    (radar/trajectory metaphor for Rocket Reframe)
 *  - **GridPattern** — evenly spaced horizontal and vertical lines (analysis metaphor)
 *  - **RingsPattern** — three thick rings offset from center (sonar/awareness metaphor)
 *
 * Patterns are clipped by the card's `overflow: "hidden"` so they extend
 * past the card edges without escaping the rounded rectangle.
 *
 * ## Snap scrolling
 *
 * The `ScrollView` uses `snapToInterval` (card width + gap = 168 + 12 = 180 px)
 * and `decelerationRate="fast"` so the scroll always lands with a card flush
 * at the left edge, making it clear there are more cards to the right.
 *
 * ## Locked cards
 *
 * Setting `available: false` dims the card (60% opacity) and disables its
 * press handler. A "SOON" pill in the top-right corner communicates intent.
 * This is a forward-compatibility placeholder — future games can be listed
 * here before they're implemented.
 */

import React, { useState } from "react";
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

/**
 * The full catalogue of mini-games rendered in the carousel.
 * Order here determines the visual left-to-right order in the UI.
 */
const GAMES: GameDef[] = [
  {
    id: "rocket-reframe",
    name: "Rocket Reframe",
    category: "REFRAMING",
    icon: "rocket",
    bg: "#020D1A",
    patternColor: "#00557A",
    patternType: "arcs",
    available: true,
  },
  {
    id: "reality-check",
    name: "Reality Check",
    category: "AWARENESS",
    icon: "checkmark-circle-outline",
    bg: "#001A14",
    patternColor: "#007A62",
    patternType: "grid",
    available: true,
  },
  {
    id: "mind-voyage",
    name: "Mind Voyage",
    category: "AWARENESS",
    icon: "boat-outline",
    bg: "#002E2A",
    patternColor: "#00B5AA",
    patternType: "rings",
    available: true,
  },
  {
    id: "reword",
    name: "Reword",
    category: "LANGUAGE",
    icon: "swap-horizontal-outline",
    bg: "#160A1C",
    patternColor: "#8A2050",
    patternType: "chevrons",
    available: true,
  },
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
];

/** 5×5 grid of 45°-rotated squares, clipped by the card's overflow. */
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

/** Four concentric quarter-circle arcs emanating from the bottom-right corner. */
function ArcsPattern({ color }: { color: string }) {
  const arcs = [
    { size: 280, bottom: -120, right: -120, opacity: 0.18, bw: 1.5 },
    { size: 200, bottom: -80,  right: -80,  opacity: 0.28, bw: 1.5 },
    { size: 130, bottom: -40,  right: -40,  opacity: 0.38, bw: 1   },
    { size: 70,  bottom: -5,   right: -5,   opacity: 0.45, bw: 1   },
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

/** Regular grid of horizontal and vertical hairlines. */
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

/** Three thick concentric rings offset from the card's lower-left area. */
function RingsPattern({ color }: { color: string }) {
  const rings = [
    { size: 220, cx: 20,  cy: 140, opacity: 0.14, bw: 10 },
    { size: 140, cx: 60,  cy: 160, opacity: 0.18, bw: 8  },
    { size: 80,  cx: 90,  cy: 170, opacity: 0.22, bw: 5  },
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

/** Selects the correct pattern component by `type` string. */
function Pattern({
  type,
  color,
}: {
  type: GameDef["patternType"];
  color: string;
}) {
  if (type === "chevrons") return <ChevronsPattern color={color} />;
  if (type === "arcs")     return <ArcsPattern color={color} />;
  if (type === "grid")     return <GridPattern color={color} />;
  return <RingsPattern color={color} />;
}

/** A single game card: dark background, decorative pattern, icon, name, category label. */
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
      accessibilityLabel={game.available ? `${game.name} — ${game.category}` : `${game.name} — coming soon`}
      accessibilityRole="button"
      accessibilityHint={game.available ? `Launch the ${game.name} game` : undefined}
    >
      {/* Pattern layer — pointer-events disabled so it doesn't absorb taps */}
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
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>GAMES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={styles.scrollOuter}
        nestedScrollEnabled
        decelerationRate="fast"
        snapToInterval={CARD_W + 12}
        snapToAlignment="start"
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const idx = Math.round(x / (CARD_W + 12));
          setActiveIdx(Math.max(0, Math.min(idx, GAMES.length - 1)));
        }}
        scrollEventThrottle={16}
      >
        {GAMES.map((g) => (
          <GameCard key={g.id} game={g} onPress={() => onGamePress(g.id)} />
        ))}
      </ScrollView>
      {/* Scroll-position dots */}
      <View style={styles.dots}>
        {GAMES.map((g, i) => (
          <View
            key={g.id}
            style={[
              styles.dot,
              i === activeIdx ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 24,
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
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 2,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  dotInactive: {
    width: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
