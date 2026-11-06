import React, { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
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

const gestures = {
  idle: { rise: 4000, fall: 4600, scale: 1.015, turn: 0, lift: 0 },
  listening: { rise: 850, fall: 1000, scale: 1.065, turn: 0, lift: 0 },
  thinking: { rise: 1400, fall: 1700, scale: 1.02, turn: 5, lift: 0 },
  speaking: { rise: 500, fall: 700, scale: 1.04, turn: 0, lift: 0.018 },
  happy: { rise: 580, fall: 860, scale: 1.085, turn: 0, lift: 0.035 },
  breathing: { rise: 4000, fall: 6000, scale: 1.14, turn: 0, lift: 0 },
} satisfies Record<CompanionState, object>;

/** Solace's small petal companion. Its state belongs to the actual interaction,
 * never an inferred emotion or assessment of the person using the app. */
export function Companion({
  state = "idle",
  size = 120,
  phase,
  breathing,
  breathingProgress,
  soundLevel,
  animate = true,
}: {
  state?: CompanionState;
  size?: number;
  phase?: string;
  breathing?: { inhale: number; hold: number; exhale: number } | null;
  breathingProgress?: number;
  soundLevel?: number;
  animate?: boolean;
}) {
  const { resolved, colors } = useTheme();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(
    () => !AppState.currentState || AppState.currentState === "active",
  );
  const [motion] = useState(() => new Animated.Value(0));
  const gesture = gestures[state];
  const progress = state === "breathing" ? breathingProgress
    : state === "listening" ? soundLevel : undefined;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) =>
      setActive(next === "active"),
    );
    return () => subscription?.remove();
  }, []);
  useEffect(() => {
    motion.stopAnimation();
    if (reduced || !active || !animate) {
      motion.setValue(0);
      return;
    }
    if (progress !== undefined && Number.isFinite(progress)) {
      const animation = Animated.timing(motion, {
        toValue: Math.max(0, Math.min(1, progress)),
        duration: state === "listening" ? 125 : 240,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      });
      animation.start();
      return () => animation.stop();
    }
    motion.setValue(0);
    const cycle = Animated.sequence([
      Animated.timing(motion, {
        toValue: 1,
        duration: state === "breathing" && breathing?.inhale ? 1000 * breathing.inhale : gesture.rise,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }),
      ...(state === "breathing" && breathing?.hold
        ? [Animated.delay(breathing.hold * 1000)]
        : []),
      Animated.timing(motion, {
        toValue: 0,
        duration: state === "breathing" && breathing?.exhale ? 1000 * breathing.exhale : gesture.fall,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }),
    ]);
    const animation = state === "happy" ? cycle : Animated.loop(cycle, {
      iterations: state === "idle" ? 2 : -1,
    });
    animation.start();
    return () => animation.stop();
  }, [
    state,
    reduced,
    active,
    animate,
    gesture,
    motion,
    breathing?.inhale,
    breathing?.hold,
    breathing?.exhale,
    progress,
  ]);
  const { scale, rotate, lift, signal } = useMemo(() => ({
    scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, gesture.scale] }),
    rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${gesture.turn}deg`] }),
    lift: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -size * gesture.lift] }),
    signal: motion.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
  }), [gesture, motion, size]);
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
          transform: [{ scale }, { rotate }, { translateY: lift }],
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
      {size >= 64 && (state === "listening" || state === "speaking") && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            width: 18,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.primary,
            opacity: signal,
          }}
        />
      )}
    </View>
  );
}
