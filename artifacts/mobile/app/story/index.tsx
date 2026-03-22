/**
 * Story tab — Chapter map + game modals.
 *
 * Displays the vertical chapter map and hosts the mini-game modals
 * (carried over from the old history screen) so games can still be
 * launched when chapters include "practice" activity pages.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";
import { useHistory } from "@/context/HistoryContext";
import { Colors } from "@/constants/colors";
import { ChapterMap } from "@/components/ChapterMap";
import { SortTowerGame } from "@/components/SortTowerGame";
import { RocketGame } from "@/components/RocketGame";
import { ThoughtCheckGame } from "@/components/ThoughtCheckGame";
import { SailGame } from "@/components/SailGame";
import { RewordGame } from "@/components/RewordGame";
import { GameIntroScreen, type GameIntroDef } from "@/components/GameIntroScreen";

const GAME_INTROS: Record<string, GameIntroDef> = {
  "sort-tower": {
    id: "sort-tower",
    name: "Sort Tower",
    icon: "layers",
    aim: "Build a tower by quickly sorting words into distorted or positive categories.",
    mechanics: [
      "Swipe LEFT to classify a word as a cognitive distortion.",
      "Swipe RIGHT to classify a word as a healthy, positive thought.",
      "Every correct sort adds a floor to your tower — aim for the spire!",
    ],
    accentColor: "#1E4A6E",
    bg: "#0C1E2E",
  },
  "rocket-reframe": {
    id: "rocket-reframe",
    name: "Rocket Reframe",
    icon: "rocket",
    aim: "Keep your rocket airborne by choosing the best reframe before gravity wins.",
    mechanics: [
      "A distorted word appears — pick the healthier replacement from two options.",
      "A correct answer boosts the rocket upward; a wrong answer costs a life.",
      "Answer fast for bonus points — speed matters!",
    ],
    accentColor: "#00557A",
    bg: "#020D1A",
  },
  "reality-check": {
    id: "reality-check",
    name: "Reality Check",
    icon: "checkmark-circle-outline",
    aim: "Train your awareness by deciding whether each thought is distorted or healthy.",
    mechanics: [
      "Read the thought shown on screen.",
      "Tap DISTORTED if it contains cognitive distortions, or HEALTHY if it is balanced.",
      "Wrong answers reveal an explanation so you learn — and cost you a life.",
    ],
    accentColor: "#007A62",
    bg: "#001A14",
  },
  "mind-voyage": {
    id: "mind-voyage",
    name: "Mind Voyage",
    icon: "boat-outline",
    aim: "Sail across the sea by pinpointing the exact distorted word in each thought.",
    mechanics: [
      "One word in each thought is highlighted — decide if it is an ERROR or VALID.",
      "Every correct answer advances your sailboat toward the far shore.",
      "Wrong answers show why the word is or isn't distorted, teaching as you go.",
    ],
    accentColor: "#00B5AA",
    bg: "#002E2A",
  },
  reword: {
    id: "reword",
    name: "Reword",
    icon: "swap-horizontal-outline",
    aim: "Pick the best word to replace a cognitive distortion from three options.",
    mechanics: [
      "A distorted word sits at the root — three possible reframes branch below it.",
      "Tap the one that best softens the distortion without replacing it with another.",
      "Build combos with consecutive correct answers for a score multiplier.",
    ],
    accentColor: "#8A2050",
    bg: "#160A1C",
  },
};

function openGameById(
  id: string,
  setters: {
    setPracticeVisible: (v: boolean) => void;
    setRocketVisible: (v: boolean) => void;
    setThoughtCheckVisible: (v: boolean) => void;
    setSailVisible: (v: boolean) => void;
    setRewordVisible: (v: boolean) => void;
  }
) {
  if (id === "sort-tower") setters.setPracticeVisible(true);
  if (id === "rocket-reframe") setters.setRocketVisible(true);
  if (id === "reality-check") setters.setThoughtCheckVisible(true);
  if (id === "mind-voyage") setters.setSailVisible(true);
  if (id === "reword") setters.setRewordVisible(true);
}

export default function StoryScreen() {
  const { entries } = useHistory();
  const params = useLocalSearchParams<{ game?: string }>();

  const [practiceVisible, setPracticeVisible] = useState(false);
  const [rocketVisible, setRocketVisible] = useState(false);
  const [thoughtCheckVisible, setThoughtCheckVisible] = useState(false);
  const [sailVisible, setSailVisible] = useState(false);
  const [rewordVisible, setRewordVisible] = useState(false);
  const [introGameId, setIntroGameId] = useState<string | null>(null);

  const introGame = introGameId ? GAME_INTROS[introGameId] ?? null : null;

  const gameSetters = {
    setPracticeVisible,
    setRocketVisible,
    setThoughtCheckVisible,
    setSailVisible,
    setRewordVisible,
  };

  // Auto-open game from deep link / navigation param
  useEffect(() => {
    if (params.game) {
      const id = params.game;
      if (GAME_INTROS[id]) {
        setIntroGameId(id);
      } else {
        openGameById(id, gameSetters);
      }
    }
  }, [params.game]);

  const handleIntroPlay = useCallback(() => {
    const id = introGameId;
    setIntroGameId(null);
    if (id) openGameById(id, gameSetters);
  }, [introGameId]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Game intro */}
      {introGame && (
        <GameIntroScreen
          {...introGame}
          visible={!!introGame}
          onPlay={handleIntroPlay}
          onClose={() => setIntroGameId(null)}
        />
      )}

      {/* Game modals */}
      <SortTowerGame
        visible={practiceVisible}
        entries={entries}
        onClose={() => setPracticeVisible(false)}
      />
      <RocketGame
        visible={rocketVisible}
        entries={entries}
        onClose={() => setRocketVisible(false)}
      />
      <ThoughtCheckGame
        visible={thoughtCheckVisible}
        entries={entries}
        onClose={() => setThoughtCheckVisible(false)}
      />
      <SailGame
        visible={sailVisible}
        entries={entries}
        onClose={() => setSailVisible(false)}
      />
      <RewordGame
        visible={rewordVisible}
        entries={entries}
        onClose={() => setRewordVisible(false)}
      />

      <ChapterMap />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
