import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "../layout";
import { artGradient, useTheme } from "../theme";
import { AppText, Icon, coverImageStyle } from "../ui";

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [
          styles.back,
          {
            backgroundColor: pressed ? colors.surface2 : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Icon name="arrow-back" size={21} />
      </Pressable>
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
  header: { overflow: "hidden", paddingBottom: spacing.section + spacing.row },
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
  back: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
  },
  title: { marginTop: spacing.compact, fontSize: 35, lineHeight: 43 },
  subtitle: { marginTop: 4, maxWidth: 295 },
});
