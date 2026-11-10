import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DaylightHeroBlend, DaylightScenicFade } from "../DaylightScenicFade";
import { spacing, useScreenGutter } from "../layout";
import { MainTabHeader, useMainTabHeaderInsets } from "../SolaceBrandHeader";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  coverImageStyle,
  Icon,
  Row,
  Screen,
} from "../ui";

const choices = [
  {
    mode: "companion",
    title: "Talk with Solace",
    description: "A caring AI companion to listen and guide.",
    dark: require("../../assets/solace-companion-twilight.jpg"),
    light: require("../../assets/redesign-chat-scene-light.jpg"),
  },
  {
    mode: "journal",
    title: "My Journal",
    description: "A private space to write and reflect.",
    dark: require("../../assets/solace-journal-twilight.jpg"),
    light: require("../../assets/redesign-explore-reflect.jpg"),
  },
] as const;

export function SolaceHome() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const headerInsets = useMainTabHeaderInsets();
  const { height } = useWindowDimensions();
  const [focused, setFocused] = useState<string | null>(null);
  const gutter = useScreenGutter();
  const compact = height < 700;
  const dark = resolved === "dark";
  const heroArtwork = dark
    ? require("../../assets/today-twilight-lotus.jpg")
    : require("../../assets/redesign-today-scene-light.jpg");
  return (
    <Screen
      edgeToEdgeTop
      heroStatusBar={dark ? "light" : "dark"}
      style={styles.screen}
    >
      <View
        style={[
          styles.hero,
          !dark && [styles.lightHero, { backgroundColor: colors.bg }],
          headerInsets,
          {
            marginHorizontal: -gutter,
            minHeight: (compact ? 194 : dark ? 264 : 240) + top,
          },
        ]}
      >
        <Image
          source={heroArtwork}
          accessible={false}
          resizeMode="cover"
          style={coverImageStyle}
        />
        {dark ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                `linear-gradient(180deg, #17142BBA 0%, #17142B50 40%, #17142B28 62%, ${colors.bg} 100%)`,
              ),
            ]}
          />
        ) : (
          <DaylightHeroBlend color={colors.bg} />
        )}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MainTabHeader color={dark ? "#FFF4EF" : colors.text} />
        </View>
        <View style={styles.intro}>
          <AppText
            variant="display"
            accessibilityRole="header"
            color={dark ? "#FFF4EF" : colors.text}
            style={styles.title}
          >
            Solace
          </AppText>
          <AppText
            color={dark ? "#F3EAF6" : colors.text}
            style={styles.subtitle}
          >
            Your space to talk, reflect, and feel lighter.
          </AppText>
        </View>
      </View>
      <View style={[styles.choices, !dark && styles.lightChoices]}>
        {choices.map((choice) => (
          <Pressable
            key={choice.mode}
            accessibilityRole="button"
            accessibilityLabel={choice.title}
            accessibilityHint={choice.description}
            onPress={() => app.switchSolaceMode(choice.mode)}
            onFocus={() => setFocused(choice.mode)}
            onBlur={() => setFocused(null)}
            style={({ pressed }) => [
              styles.card,
              compact && styles.compactCard,
              !dark && styles.lightCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  focused === choice.mode
                    ? colors.lavenderText
                    : dark
                      ? colors.heroBorder
                      : `${colors.lavenderText}55`,
                opacity: pressed ? 0.84 : 1,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={
                dark
                  ? styles.cardArt
                  : [styles.lightCardArt, compact && styles.compactLightArt]
              }
            >
              <Image
                source={choice[resolved]}
                accessible={false}
                resizeMode="cover"
                resizeMethod={dark ? undefined : "scale"}
                style={
                  !dark && choice.mode === "journal"
                    ? styles.lightJournalArt
                    : coverImageStyle
                }
              />
              {dark ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    artGradient(
                      `linear-gradient(180deg, ${colors.surface}00 24%, ${colors.surface}62 49%, ${colors.surface}F2 73%, ${colors.surface} 100%)`,
                    ),
                  ]}
                />
              ) : (
                <DaylightScenicFade color={colors.surface} height={18} />
              )}
            </View>
            <Row style={styles.cardContent}>
              <View style={styles.cardText}>
                <AppText variant="heading" style={styles.cardTitle}>
                  {choice.title}
                </AppText>
                <AppText color={colors.muted} style={styles.cardDescription}>
                  {choice.description}
                </AppText>
              </View>
              <View
                style={[
                  styles.arrow,
                  {
                    backgroundColor: colors.lavenderAction,
                  },
                ]}
              >
                <Icon
                  name="arrow-forward"
                  size={21}
                  color={colors.lavenderActionText}
                />
              </View>
            </Row>
          </Pressable>
        ))}
      </View>
      {!compact && (
        <View
          pointerEvents="none"
          style={[styles.ornament, { marginHorizontal: -gutter }]}
        >
          <BotanicalBackdrop
            variant="footer"
            style={{
              bottom: -36,
              right: -36,
              width: 168,
              height: 118,
              opacity: dark ? 0.32 : 0.24,
            }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 0 },
  hero: {
    overflow: "hidden",
    paddingBottom: 15,
    justifyContent: "space-between",
    gap: 14,
  },
  lightHero: { paddingBottom: spacing.section },
  intro: { gap: 4, maxWidth: 210 },
  title: { fontSize: 46, lineHeight: 49 },
  subtitle: { fontSize: 16, lineHeight: 22, maxWidth: 180 },
  choices: { gap: spacing.row, paddingBottom: 8 },
  lightChoices: { marginTop: spacing.compact },
  card: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "flex-end",
    paddingTop: 68,
    minHeight: 194,
  },
  compactCard: { paddingTop: 60, minHeight: 152 },
  lightCard: { paddingTop: 0, minHeight: 0 },
  lightCardArt: { height: 122, overflow: "hidden" },
  lightJournalArt: {
    position: "absolute",
    top: -16,
    left: 0,
    width: "100%",
    aspectRatio: 1,
  },
  compactLightArt: { height: 98 },
  ornament: { height: 52, overflow: "hidden" },
  cardArt: { position: "absolute", top: 0, left: 0, right: 0, bottom: 34 },
  cardContent: { padding: 15, gap: 10, alignItems: "flex-end" },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 28, lineHeight: 31 },
  cardDescription: { fontSize: 14, lineHeight: 19 },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
