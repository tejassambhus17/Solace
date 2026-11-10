import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "./theme";
import { useReducedMotion } from "./Companion";
import type { MomentEnvironment } from "./moments";

export const ENVIRONMENTS: {
  id: MomentEnvironment;
  title: string;
  short: string;
  description: string;
  sound: string;
  icon: string;
}[] = [
  {
    id: "forest",
    title: "Forest Sanctuary",
    short: "Forest",
    description: "A quiet place beneath the leaves.",
    sound: "Forest air",
    icon: "leaf-outline",
  },
  {
    id: "ocean",
    title: "Ocean Calm",
    short: "Ocean",
    description: "Room to soften with the tide.",
    sound: "Ocean hush",
    icon: "water-outline",
  },
  {
    id: "twilight",
    title: "Twilight Sky",
    short: "Twilight",
    description: "A softer sky at the edge of the day.",
    sound: "Twilight tones",
    icon: "moon-outline",
  },
];

/** Three small bundled environments, with one transform-driven animation each.
 * Scene motion pauses with the practice and honors the OS reduced-motion setting. */
export function EnvironmentScene({
  environment,
  active = false,
  children,
  style,
  scenic = false,
}: {
  environment: MomentEnvironment;
  active?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scenic?: boolean;
}) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const background =
    environment === "forest"
      ? dark
        ? "#111C18"
        : "#E7EBDD"
      : environment === "ocean"
        ? dark
          ? "#101D26"
          : "#E0EAF0"
        : dark
          ? "#191626"
          : "#EBE2ED";
  return (
    <View
      style={[
        {
          overflow: "hidden",
          backgroundColor: background,
          borderRadius: 28,
          minHeight: 160,
        },
        style,
      ]}
    >
      <EnvironmentArtwork
        key={environment}
        environment={environment}
        active={active}
        dark={dark}
        scenic={scenic}
      />
      {children}
    </View>
  );
}

const EnvironmentArtwork = React.memo(function EnvironmentArtwork({
  environment,
  active,
  dark,
  scenic,
}: {
  environment: MomentEnvironment;
  active: boolean;
  dark: boolean;
  scenic: boolean;
}) {
  const reduced = useReducedMotion();
  const [drift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      drift.setValue(0);
      return;
    }
    if (!active) return;
    const timing = {
      duration: 6500,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    };
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { ...timing, toValue: 1 }),
        Animated.timing(drift, { ...timing, toValue: 0 }),
      ]),
      { iterations: -1, resetBeforeIteration: false },
    );
    animation.start();
    return () => animation.stop();
  }, [active, drift, reduced]);
  const daytimeScene =
    !dark && scenic
      ? environment === "forest"
        ? require("../assets/redesign-guided-light.jpg")
        : environment === "twilight"
          ? require("../assets/redesign-explore-feature-light.jpg")
          : null
      : null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={StyleSheet.absoluteFill}
    >
      {daytimeScene ? (
        <Animated.Image
          source={daytimeScene}
          resizeMode="cover"
          resizeMethod="scale"
          fadeDuration={0}
          style={[
            StyleSheet.absoluteFill,
            {
              width: "100%",
              height: "100%",
              transform: [
                {
                  scale: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.045],
                  }),
                },
              ],
            },
          ]}
        />
      ) : environment === "forest" ? (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: dark ? 0.42 : 0.48,
                transform: [
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 7],
                    }),
                  },
                  { scale: 1.07 },
                ],
              },
            ]}
          >
            <Image
              source={require("../assets/botanical.png")}
              resizeMode="cover"
              style={{
                position: "absolute",
                width: "100%",
                height: "120%",
                right: "-24%",
                bottom: "-22%",
              }}
            />
          </Animated.View>
          <View
            style={{
              position: "absolute",
              top: -90,
              left: -100,
              width: 270,
              height: 270,
              borderRadius: 135,
              backgroundColor: dark ? "#C1CE9B" : "#FFF8D8",
              opacity: dark ? 0.035 : 0.35,
            }}
          />
        </>
      ) : environment === "ocean" ? (
        <>
          <View
            style={{
              position: "absolute",
              top: "18%",
              right: "18%",
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: dark ? "#CBD2C9" : "#FFF7DF",
              opacity: 0.64,
            }}
          />
          {[0, 1, 2].map((wave) => (
            <Animated.View
              key={wave}
              style={{
                position: "absolute",
                width: "165%",
                height: "52%",
                left: "-32%",
                bottom: `${-20 + wave * 12}%`,
                borderRadius: 170,
                borderWidth: 1,
                borderColor: dark ? "#4D7A83" : "#8CABAD",
                backgroundColor: dark
                  ? ["#172E39", "#1D3943", "#21434A"][wave]
                  : ["#C9DDDE", "#B5D0D3", "#A6C5CB"][wave],
                opacity: 0.65,
                transform: [
                  { rotate: wave % 2 ? "-7deg" : "7deg" },
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [wave % 2 ? -8 : 8, wave % 2 ? 8 : -8],
                    }),
                  },
                ],
              }}
            />
          ))}
        </>
      ) : (
        <>
          <Image
            source={require("../assets/dark-night.png")}
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              { width: "100%", height: "100%", opacity: dark ? 0.46 : 0.2 },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 0.75],
                }),
              },
            ]}
          >
            {[
              { x: 13, y: 18 },
              { x: 31, y: 31 },
              { x: 74, y: 14 },
              { x: 88, y: 42 },
              { x: 18, y: 67 },
            ].map((star, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: i % 2 ? 2 : 3,
                  height: i % 2 ? 2 : 3,
                  borderRadius: 3,
                  backgroundColor: dark ? "#ECE1D3" : "#685C7D",
                }}
              />
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
});
