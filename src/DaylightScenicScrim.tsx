import React from "react";
import { Image, StyleSheet, View } from "react-native";

export const daylightPhotoInk = {
  title: "#FFFBF8",
  detail: "#F5EAF7",
};

const shade = "#231A2BB8";

export function DaylightScenicScrim({
  coverage,
  fadeThrough = 100,
}: {
  coverage: number;
  fadeThrough?: number;
}) {
  const readingEdge = `${coverage}%` as const;
  const clearEdge = `${100 - fadeThrough}%` as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The fill protects the copy without depending on the fade loading. */}
      <View style={[styles.reading, { width: readingEdge }]} />
      <View style={[styles.shoulder, { left: readingEdge, right: clearEdge }]}>
        <Image
          source={require("../assets/daylight-scenic-scrim.png")}
          style={styles.mask}
          resizeMode="stretch"
          fadeDuration={0}
          accessible={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reading: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: shade,
  },
  shoulder: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  mask: { width: "100%", height: "100%" },
});
