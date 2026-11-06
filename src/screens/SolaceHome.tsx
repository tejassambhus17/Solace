import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "../layout";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  coverImageStyle,
  Icon,
  LotusMark,
  Row,
  Screen,
} from "../ui";

const choices = [
  {
    mode: "companion",
    title: "Talk with Solace",
    description: "A caring AI companion to listen, support, and guide you.",
    dark: require("../../assets/solace-companion-twilight.jpg"),
    light: require("../../assets/redesign-chat-scene-light.jpg"),
  },
  {
    mode: "journal",
    title: "My Journal",
    description: "A private space to write, reflect, and sort your thoughts.",
    dark: require("../../assets/solace-journal-twilight.jpg"),
    light: require("../../assets/redesign-explore-reflect.jpg"),
  },
] as const;

export function SolaceHome() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const gutter = useScreenGutter();
  const compact = height < 700;
  const dark = resolved === "dark";
  const heroArtwork = dark
    ? require("../../assets/today-twilight-lotus.jpg")
    : require("../../assets/redesign-today-scene-light.jpg");
  return (
    <Screen edgeToEdgeTop heroStatusBar="light" style={styles.screen}>
      <View
        style={[
          styles.hero,
          {
            marginHorizontal: -gutter,
            minHeight: (compact ? 204 : 264) + top,
            paddingTop: top + 15,
            paddingHorizontal: gutter,
          },
        ]}
      >
        <Image
          source={heroArtwork}
          accessible={false}
          resizeMode="cover"
          style={coverImageStyle}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            artGradient(
              dark
                ? `linear-gradient(180deg, #17142BBA 0%, #17142B50 40%, #17142B28 62%, ${colors.bg} 100%)`
                : `linear-gradient(180deg, #27382AB5 0%, #27382A00 30%, ${colors.bg}D8 58%, ${colors.bg} 100%)`,
            ),
          ]}
        />
        <Row style={styles.brand}>
          <LotusMark size={27} />
          <AppText variant="heading" color="#FFF4EF" style={styles.brandName}>
            Solace
          </AppText>
        </Row>
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
      <View style={styles.choices}>
        <BotanicalBackdrop
          variant="footer"
          style={{
            bottom: -77,
            right: -42,
            width: 200,
            height: 142,
            opacity: dark ? 0.38 : 0.3,
          }}
        />
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
                minHeight: compact ? 161 : 194,
                backgroundColor: colors.surface,
                borderColor: colors.heroBorder,
                opacity: pressed ? 0.84 : 1,
              },
            ]}
          >
            <View pointerEvents="none" style={styles.cardArt}>
              <Image
                source={choice[resolved]}
                accessible={false}
                resizeMode="cover"
                style={coverImageStyle}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  artGradient(
                    `linear-gradient(180deg, ${colors.surface}00 24%, ${colors.surface}62 49%, ${colors.surface}F2 79%, ${colors.surface} 100%)`,
                  ),
                ]}
              />
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
                    backgroundColor: dark ? colors.peach : colors.peachSurface,
                  },
                ]}
              >
                <Icon
                  name="arrow-forward"
                  size={21}
                  color={dark ? colors.primaryText : colors.peachText}
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
  screen: { paddingTop: 0 },
  hero: {
    overflow: "hidden",
    paddingBottom: 15,
    justifyContent: "space-between",
    gap: 14,
  },
  brand: { gap: 6 },
  brandName: { fontSize: 24, lineHeight: 28 },
  intro: { gap: 4, maxWidth: 210 },
  title: { fontSize: 46, lineHeight: 49 },
  subtitle: { fontSize: 16, lineHeight: 22, maxWidth: 180 },
  choices: { gap: spacing.row, paddingBottom: 8 },
  card: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "flex-end",
    paddingTop: 68,
  },
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
