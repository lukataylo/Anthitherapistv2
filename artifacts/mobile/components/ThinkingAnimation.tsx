import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

export function ThinkingAnimation() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0.4)).current;
  const ring2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const createDotAnim = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

    const createRingAnim = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1600,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0.4,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = createDotAnim(dot1, 0);
    const a2 = createDotAnim(dot2, 200);
    const a3 = createDotAnim(dot3, 400);
    const r1 = createRingAnim(ring1, 0);
    const r2 = createRingAnim(ring2, 800);

    a1.start();
    a2.start();
    a3.start();
    r1.start();
    r2.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      r1.stop();
      r2.stop();
    };
  }, [dot1, dot2, dot3, ring1, ring2]);

  return (
    <View style={styles.container}>
      <View style={styles.ringContainer}>
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ring1,
              transform: [
                {
                  scale: ring1.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [0.6, 1.4],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            {
              opacity: ring2.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0.6, 0],
              }),
              transform: [
                {
                  scale: ring2.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: [0.6, 1.6],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={styles.innerDot} />
      </View>

      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: d,
                transform: [
                  {
                    translateY: d.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -6],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <Text style={styles.text}>Analysing your thought...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 28,
  },
  ringContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.fear,
  },
  ring2: {
    borderColor: Colors.absolute,
  },
  innerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.belief,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.fear,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
  },
});
