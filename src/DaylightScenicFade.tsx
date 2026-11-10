import React from "react";
import { Image, StyleSheet, View } from "react-native";

const alphaFade = require("../assets/daylight-scenic-fade.png");
const heroBlend = require("../assets/daylight-hero-blend.png");

export function DaylightScenicFade({
  color,
  height,
}: {
  color: string;
  height: number;
}) {
  return (
    <View pointerEvents="none" style={[styles.edge, { bottom: 0, height }]}>
      <Image
        source={alphaFade}
        resizeMode="stretch"
        fadeDuration={0}
        style={[styles.mask, { tintColor: color }]}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export function DaylightHeroBlend({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={[styles.edge, styles.hero]}>
      <Image
        source={heroBlend}
        resizeMode="stretch"
        fadeDuration={0}
        style={[styles.mask, { tintColor: color }]}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Anchor to the outside edges even when the hero applies its own text padding.
  edge: { position: "absolute", left: 0, right: 0 },
  hero: { top: 0, bottom: 0 },
  mask: { width: "100%", height: "100%" },
});
