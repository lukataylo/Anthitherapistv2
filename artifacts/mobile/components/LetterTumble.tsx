import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface LetterTumbleProps {
  word: string;
  onComplete: () => void;
}

const CELEBRATE_COLORS = ["#00FFFF", "#FF00FF", "#9B5CF6", "#FFE500", "#00E5A0", "#FF5B5B"];

export function LetterTumble({ word, onComplete }: LetterTumbleProps) {
  const letters = word.toUpperCase().split("");
  const anims = useRef(
    letters.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.5),
      rotate: new Animated.Value(0),
    }))
  ).current;

  const finalX = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<"scatter" | "converge" | "done">(
    "scatter"
  );

  useEffect(() => {
    const letterWidth = 32;
    const totalWidth = letters.length * letterWidth;
    const startX = -totalWidth / 2;

    Animated.parallel(
      anims.map((anim, i) => {
        const randX = (Math.random() - 0.5) * SCREEN_W * 0.9;
        const randY = (Math.random() - 0.5) * SCREEN_H * 0.7;
        const randSize = 0.8 + Math.random() * 1.5;
        const randRot = (Math.random() - 0.5) * 720;

        return Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(anim.x, {
            toValue: randX,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.spring(anim.y, {
            toValue: randY,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: randSize,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: randRot,
            duration: 600,
            useNativeDriver: true,
          }),
        ]);
      })
    ).start(() => {
      setPhase("converge");

      setTimeout(() => {
        Animated.parallel(
          anims.map((anim, i) => {
            const targetX = startX + i * letterWidth + letterWidth / 2;

            return Animated.parallel([
              Animated.spring(anim.x, {
                toValue: targetX,
                friction: 7,
                tension: 60,
                useNativeDriver: true,
              }),
              Animated.spring(anim.y, {
                toValue: 0,
                friction: 7,
                tension: 60,
                useNativeDriver: true,
              }),
              Animated.spring(anim.scale, {
                toValue: 1.8,
                friction: 7,
                tension: 60,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotate, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
            ]);
          })
        ).start(() => {
          setPhase("done");
          setTimeout(onComplete, 800);
        });
      }, 600);
    });
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {anims.map((anim, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.letter,
            {
              color:
                CELEBRATE_COLORS[i % CELEBRATE_COLORS.length],
              opacity: anim.opacity,
              transform: [
                { translateX: anim.x },
                { translateY: anim.y },
                { scale: anim.scale },
                {
                  rotate: anim.rotate.interpolate({
                    inputRange: [-720, 720],
                    outputRange: ["-720deg", "720deg"],
                  }),
                },
              ],
            },
          ]}
        >
          {letters[i]}
        </Animated.Text>
      ))}
      {phase === "done" && (
        <View style={styles.glowWord}>
          <Text style={styles.finalWord}>{word.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,15,0.95)",
    zIndex: 100,
  },
  letter: {
    position: "absolute",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  glowWord: {
    alignItems: "center",
  },
  finalWord: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.success,
    letterSpacing: 4,
  },
});
