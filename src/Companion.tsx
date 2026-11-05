import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  View,
} from "react-native";
import { useTheme } from "./theme";

export type CompanionState =
  "idle" | "listening" | "thinking" | "speaking" | "happy" | "breathing";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let current = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => current && setReduced(enabled))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

const descriptions: Record<CompanionState, string> = {
  idle: "Solace is here with you",
  listening: "Solace is listening to your recording",
  thinking: "Solace is preparing a response",
  speaking: "Solace is reading the response aloud",
  happy: "Your Moment is complete",
  breathing: "Follow a comfortable breathing rhythm",
};

/** Solace's small petal companion. Its state belongs to the actual interaction,
 * never an inferred emotion or assessment of the person using the app. */
export function Companion({
  state = "idle",
  size = 120,
  phase,
  breathing,
  breathingProgress,
}: {
  state?: CompanionState;
  size?: number;
  phase?: string;
  breathing?: { inhale: number; hold: number; exhale: number } | null;
  breathingProgress?: number;
}) {
  const { resolved, colors } = useTheme();
  const reduced = useReducedMotion();
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    motion.stopAnimation();
    if (reduced) {
      motion.setValue(0);
      return;
    }
    if (state === "breathing" && breathingProgress !== undefined) {
      const animation = Animated.timing(motion, {
        toValue: Math.max(0, Math.min(1, breathingProgress)),
        duration: 240,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      });
      animation.start();
      return () => animation.stop();
    }
    motion.setValue(0);
    const duration =
      state === "breathing"
        ? 1000 * (breathing?.inhale || 4)
        : state === "idle"
          ? 5000
          : state === "thinking"
            ? 1400
            : state === "happy"
              ? 650
              : 700;
    const cycle = Animated.sequence([
      Animated.timing(motion, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }),
      ...(state === "breathing" && breathing?.hold
        ? [Animated.delay(breathing.hold * 1000)]
        : []),
      Animated.timing(motion, {
        toValue: 0,
        duration:
          state === "breathing" ? 1000 * (breathing?.exhale || 6) : duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }),
    ]);
    const animation = state === "happy" ? cycle : Animated.loop(cycle);
    animation.start();
    return () => animation.stop();
  }, [
    state,
    reduced,
    breathing?.inhale,
    breathing?.hold,
    breathing?.exhale,
    breathingProgress,
  ]);
  const scale = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [
      1,
      state === "breathing"
        ? 1.14
        : state === "happy"
          ? 1.1
          : state === "idle"
            ? 1.012
            : 1.035,
    ],
  });
  const rotate = motion.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", state === "thinking" ? "7deg" : "0deg"],
  });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={phase || descriptions[state]}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ scale }, { rotate }],
        }}
      >
        <Image
          source={
            resolved === "dark"
              ? require("../assets/dark-petal.png")
              : require("../assets/petal.png")
          }
          accessible={false}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: size * 0.56,
            left: size * 0.415,
            width: size * 0.17,
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", gap: size * 0.075 }}>
            {[0, 1].map((eye) => (
              <View
                key={eye}
                style={{
                  width: Math.max(3, size * 0.024),
                  height: Math.max(
                    3,
                    size *
                      (state === "happy" || state === "breathing"
                        ? 0.012
                        : 0.032),
                  ),
                  borderRadius: 4,
                  backgroundColor: "#33251F",
                  opacity: 0.72,
                }}
              />
            ))}
          </View>
          {state === "happy" && (
            <View
              style={{
                marginTop: size * 0.025,
                width: size * 0.055,
                height: size * 0.025,
                borderBottomWidth: 1.5,
                borderBottomColor: "#33251F",
                borderRadius: size * 0.04,
              }}
            />
          )}
        </View>
      </Animated.View>
      {(state === "listening" || state === "speaking") && (
        <View
          pointerEvents="none"
          style={{
            flexDirection: "row",
            gap: 4,
            position: "absolute",
            bottom: 0,
          }}
        >
          {[0.5, 1, 0.7, 1, 0.5].map((height, index) => (
            <Animated.View
              key={index}
              style={{
                width: 3,
                height: 14 * height,
                borderRadius: 2,
                backgroundColor: colors.primary,
                transform: [
                  {
                    scaleY: motion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
