import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "../layout";
import { useGuardedBack } from "../navigation-reset";
import { artGradient, useTheme } from "../theme";
import { AppText, IconButton, coverImageStyle } from "../ui";

const landscapes = {
  light: require("../../assets/profile-mountains-light.jpg"),
  dark: require("../../assets/profile-mountains-dark.jpg"),
};
const foliage = require("../../assets/botanical-compact.png");

export function ExploreFeatureHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const gutter = useScreenGutter();
  const goBack = useGuardedBack(onBack);
  return (
    <View
      style={[
        styles.header,
        { paddingTop: top + spacing.compact, paddingHorizontal: gutter },
      ]}
    >
      <View pointerEvents="none" style={styles.landscape}>
        <Image
          source={landscapes[resolved]}
          style={coverImageStyle}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
          accessible={false}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            artGradient(
              `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg}D9 25%, ${colors.bg}38 66%, ${colors.bg} 100%)`,
            ),
          ]}
        />
      </View>
      <Image
        source={foliage}
        resizeMode="contain"
        resizeMethod="resize"
        fadeDuration={0}
        accessible={false}
        pointerEvents="none"
        style={[
          styles.foliage,
          { top: top - 29, opacity: resolved === "dark" ? 0.44 : 0.73 },
        ]}
      />
      <IconButton
        appearance="outlined"
        name="chevron-back"
        label="Back"
        onPress={goBack}
        size={48}
      />
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <AppText color={colors.text} style={styles.subtitle}>
        {subtitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { overflow: "hidden", paddingBottom: spacing.section },
  landscape: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 156,
  },
  foliage: {
    position: "absolute",
    right: -24,
    width: 161,
    height: 110,
    transform: [{ rotate: "-8deg" }],
  },
  title: { marginTop: spacing.compact, fontSize: 35, lineHeight: 43 },
  subtitle: { marginTop: 4, maxWidth: 295 },
});
