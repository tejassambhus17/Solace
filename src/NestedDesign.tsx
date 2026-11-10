import React, { type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { spacing } from "./layout";
import { artGradient, useTheme } from "./theme";
import { AppText, coverImageStyle } from "./ui";

type SceneTone = "lavender" | "sage" | "peach";

export function SceneIntro({
  image,
  title,
  description,
  meta,
  children,
  tone = "lavender",
  style,
}: {
  image: ImageSourcePropType;
  title: string;
  description?: string;
  meta?: string;
  children?: ReactNode;
  tone?: SceneTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, resolved } = useTheme();
  const surface = colors[`${tone}Surface`];
  const light = resolved === "light";
  return (
    <View
      style={[
        styles.scene,
        {
          backgroundColor: light ? colors.surface : surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={light ? styles.daylightArtwork : styles.sceneArtwork}
      >
        <Image
          source={image}
          resizeMode="cover"
          resizeMethod={light ? "scale" : "resize"}
          fadeDuration={0}
          accessible={false}
          style={coverImageStyle}
        />
        {!light && (
          <View
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                `linear-gradient(180deg, transparent 22%, ${surface}55 53%, ${surface} 100%)`,
              ),
            ]}
          />
        )}
      </View>
      <View style={[styles.sceneContent, light && styles.daylightContent]}>
        <AppText
          variant="display"
          accessibilityRole="header"
          style={styles.sceneTitle}
        >
          {title}
        </AppText>
        {description && (
          <AppText
            color={light ? colors.muted : colors.text}
            style={styles.sceneDescription}
          >
            {description}
          </AppText>
        )}
        {meta && (
          <AppText variant="label" color={colors[`${tone}Text`]}>
            {meta}
          </AppText>
        )}
        {children}
      </View>
    </View>
  );
}

export function EditorialSection({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={styles.sectionTitle}
      >
        {title}
      </AppText>
      {description && <AppText color={colors.muted}>{description}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: spacing.section,
  },
  sceneArtwork: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 142,
  },
  daylightArtwork: { height: 126, overflow: "hidden" },
  sceneContent: {
    paddingTop: 100,
    paddingHorizontal: spacing.card + 4,
    paddingBottom: spacing.card + 4,
    gap: spacing.compact,
  },
  daylightContent: { paddingTop: spacing.card },
  sceneTitle: { fontSize: 38, lineHeight: 41 },
  sceneDescription: { fontSize: 14, lineHeight: 21 },
  section: { gap: 4, marginBottom: spacing.row },
  sectionTitle: { fontSize: 27, lineHeight: 31 },
});
