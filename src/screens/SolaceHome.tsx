import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, coverImageStyle, Icon, LotusMark, Row, Screen } from "../ui";

const choices = [
  {
    mode: "companion",
    title: "Talk with Solace",
    description: "An AI companion to listen and help you find your next step.",
    image: require("../../assets/today-twilight-lotus.jpg"),
  },
  {
    mode: "journal",
    title: "My Journal",
    description:
      "A private space to write, reflect, or sort through your thoughts.",
    image: require("../../assets/redesign-explore-reflect.jpg"),
  },
] as const;

export function SolaceHome() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const dark = resolved === "dark";
  return (
    <Screen>
      <View
        style={[
          styles.hero,
          compact && styles.compactHero,
          { backgroundColor: dark ? "#1E172A" : colors.heroSurface },
        ]}
      >
        <Image
          source={
            dark
              ? require("../../assets/today-twilight-lotus.jpg")
              : require("../../assets/redesign-today-scene-light.jpg")
          }
          accessible={false}
          resizeMode="cover"
          style={coverImageStyle}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? "#19122780" : "#22291D7A" },
          ]}
        />
        <View
          style={[
            styles.heroCopy,
            { paddingTop: Math.min(top, 14) + spacing.card },
          ]}
        >
          <Row style={styles.brand}>
            <LotusMark size={29} />
            <AppText variant="heading" color="#FFF7E9">
              Solace
            </AppText>
          </Row>
          <AppText
            variant="display"
            accessibilityRole="header"
            color="#FFF7E9"
            style={styles.title}
          >
            Make a little space.
          </AppText>
          <AppText color="#FFF7E9" style={styles.heroSubtitle}>
            Talk through what’s on your mind or write in a quiet space of your
            own.
          </AppText>
        </View>
      </View>
      <View style={styles.choices}>
        {choices.map((choice) => (
          <Pressable
            key={choice.mode}
            accessibilityRole="button"
            accessibilityLabel={choice.title}
            accessibilityHint={choice.description}
            onPress={() => app.switchSolaceMode(choice.mode)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.83 : 1,
              },
            ]}
          >
            <Image
              source={choice.image}
              accessible={false}
              resizeMode="cover"
              style={[styles.cardArt, compact && styles.compactArt]}
            />
            <Row style={styles.cardContent}>
              <View style={styles.cardText}>
                <AppText variant="heading">{choice.title}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {choice.description}
                </AppText>
              </View>
              <View
                style={[
                  styles.arrow,
                  {
                    backgroundColor:
                      choice.mode === "journal"
                        ? colors.lavenderSurface
                        : colors.peachSurface,
                  },
                ]}
              >
                <Icon
                  name="arrow-forward"
                  color={
                    choice.mode === "journal"
                      ? colors.lavenderText
                      : colors.peachText
                  }
                />
              </View>
            </Row>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    overflow: "hidden",
    minHeight: 225,
    justifyContent: "flex-end",
  },
  heroCopy: {
    paddingHorizontal: spacing.card,
    paddingBottom: spacing.card,
    gap: 5,
  },
  compactHero: { minHeight: 185 },
  brand: { gap: 7 },
  title: { maxWidth: 255 },
  heroSubtitle: { maxWidth: 260 },
  choices: { marginTop: spacing.card, gap: spacing.card },
  card: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardArt: { width: "100%", height: 114 },
  compactArt: { height: 72 },
  cardContent: { padding: spacing.card, gap: spacing.compact },
  cardText: { flex: 1, gap: 3 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
