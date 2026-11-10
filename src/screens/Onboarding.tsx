import React, { useEffect } from "react";
import {
  BackHandler,
  Image,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { spacing, useScreenGutter } from "../layout";
import type { WalkthroughAction } from "../onboarding-state";
import { useTheme } from "../theme";
import { AppText, Button, IconButton } from "../ui";
import { OnboardingLayout } from "./OnboardingLayout";

const arrival = {
  light: require("../../assets/redesign-explore-feature-light.jpg"),
  dark: require("../../assets/today-twilight-lotus.jpg"),
};

type Feature = {
  title: string;
  description: string;
  light: ImageSourcePropType;
  dark?: ImageSourcePropType;
};

const features: readonly Feature[] = [
  {
    title: "Talk with Solace",
    description: "Chat with your AI companion by text or voice.",
    light: require("../../assets/redesign-chat-scene-light.jpg"),
    dark: require("../../assets/solace-companion-twilight.jpg"),
  },
  {
    title: "Reflect privately",
    description: "Give your thoughts a place in your journal.",
    light: require("../../assets/redesign-explore-reflect.jpg"),
    dark: require("../../assets/solace-journal-twilight.jpg"),
  },
  {
    title: "Find your calm",
    description: "Take a guided pause that fits your day.",
    light: require("../../assets/redesign-explore-breathe.jpg"),
    dark: require("../../assets/redesign-explore-feature-dark.jpg"),
  },
  {
    title: "Grow at your pace",
    description: "Build small habits and see your progress.",
    light: require("../../assets/habits-garden-sprout.jpg"),
  },
];

export function OnboardingScreen({
  onFinish,
  onBack,
  finishing = false,
  error,
}: {
  onFinish: (action: WalkthroughAction) => void;
  onBack?: () => void;
  finishing?: boolean;
  error?: string;
}) {
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const stack = width < 320 || fontScale > 1.25;
  const contentWidth = Math.min(width, 480) - 2 * gutter;
  const featureImageHeight = Math.round(
    stack ? contentWidth / 2.8 : (contentWidth - spacing.row) / 4,
  );
  const surface = resolved === "dark" ? colors.surface : colors.bg;

  useEffect(() => {
    if (!onBack) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onBack]);

  function tile(feature: Feature) {
    return (
      <View
        key={feature.title}
        style={[
          styles.tile,
          { backgroundColor: surface, borderColor: colors.border },
        ]}
      >
        <Image
          source={
            resolved === "dark"
              ? (feature.dark ?? feature.light)
              : feature.light
          }
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="cover"
          style={[styles.tileImage, { height: featureImageHeight }]}
        />
        <View style={styles.tileCopy}>
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={styles.tileTitle}
          >
            {feature.title}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {feature.description}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <OnboardingLayout
      testID="onboarding-screen"
      leading={
        onBack && (
          <IconButton name="chevron-back" label="Go back" onPress={onBack} />
        )
      }
      trailing={
        !onBack && (
          <Button
            title="Log in"
            variant="ghost"
            onPress={() => onFinish("skip")}
            disabled={finishing}
            style={styles.login}
          />
        )
      }
      footer={
        <>
          {!!error && (
            <AppText
              variant="caption"
              accessibilityRole="alert"
              color={colors.danger}
            >
              {error}
            </AppText>
          )}
          <Button
            title={onBack ? "Done" : "Get started"}
            icon={onBack ? undefined : "arrow-forward"}
            onPress={() => onFinish("complete")}
            loading={finishing}
          />
        </>
      }
    >
      <Image
        source={arrival[resolved]}
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        resizeMode="cover"
        style={[
          styles.hero,
          {
            height: Math.round(contentWidth / 2.55),
            backgroundColor: colors.heroSurface,
          },
        ]}
      />
      <View style={styles.intro}>
        <AppText
          variant="display"
          accessibilityRole="header"
          style={styles.title}
        >
          A little space for you.
        </AppText>
        <AppText color={colors.muted} style={styles.description}>
          Pause, reflect, and find support at your own pace.
        </AppText>
      </View>
      <View style={styles.featureGrid}>
        {[features.slice(0, 2), features.slice(2)].map((row) => (
          <View
            key={row[0].title}
            style={[styles.featureRow, stack && styles.stacked]}
          >
            {row.map(tile)}
          </View>
        ))}
      </View>
      <AppText variant="caption" color={colors.muted} style={styles.note}>
        Solace offers everyday wellness support. For therapy, turn to a
        qualified professional.
      </AppText>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  login: { minWidth: 52, minHeight: 48, paddingHorizontal: 8 },
  hero: { width: "100%", borderRadius: 18 },
  intro: { gap: 6, marginTop: spacing.card, marginBottom: spacing.card },
  title: {
    fontSize: 41,
    lineHeight: Platform.OS === "android" ? 49 : 45,
    letterSpacing: -0.8,
  },
  description: { maxWidth: 345 },
  featureGrid: { gap: spacing.row },
  featureRow: { flexDirection: "row", gap: spacing.row },
  stacked: { flexDirection: "column" },
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  tileImage: { width: "100%" },
  tileCopy: { gap: 4, padding: spacing.row },
  tileTitle: {
    fontSize: 22,
    lineHeight: Platform.OS === "android" ? 27 : 24,
    letterSpacing: -0.25,
  },
  note: { marginTop: spacing.card },
});
