import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  coverImageStyle,
  Icon,
  LotusMark,
  Row,
  Screen,
} from "../ui";

type Tone = "lavender" | "peach" | "sage";
type ProfileLink = {
  title: string;
  subtitle: string;
  icon: string;
  tone: Tone;
  route: string;
  params?: { section: "privacy" };
  badge?: { label: string; tone: Tone };
};

const profileArt = {
  light: {
    header: require("../../assets/profile-mountains-light.jpg"),
    footer: require("../../assets/profile-footer-light.jpg"),
  },
  dark: {
    header: require("../../assets/profile-mountains-dark.jpg"),
    footer: require("../../assets/profile-footer-dark.jpg"),
  },
};

const darkTones = {
  lavender: { surface: "#3C2D50", ink: "#E3B8F4" },
  peach: { surface: "#443039", ink: "#F5C5B0" },
  sage: { surface: "#283A39", ink: "#C2E8D4" },
};

export default function ProfileHome() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const { top } = useSafeAreaInsets();
  const dark = resolved === "dark";
  const compact = width < 390 || fontScale > 1.2;
  const stackHero = fontScale > 1.35;
  const avatar = app.user?.avatar;
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const avatarSize = compact ? 62 : 80;
  const canvas = dark ? "#0B0912" : colors.bg;
  const muted = dark ? "#DDCFDF" : colors.muted;
  const groupBorder = dark ? "#54465D" : colors.border;
  const hasReminders = app.data.reminders.some((reminder) => reminder.enabled);
  const memoryCount = app.data.memories.length;
  const groups: { title: string; icon: string; links: ProfileLink[] }[] = [
    {
      title: "Personalize Solace",
      icon: "leaf-outline",
      links: [
        {
          title: "Gentle reminders",
          subtitle: "Set reminders for mindful pauses.",
          icon: "notifications-outline",
          tone: "peach",
          route: "reminders",
          badge: {
            label: hasReminders ? "On" : "Off",
            tone: hasReminders ? "sage" : "lavender",
          },
        },
        {
          title: "What Solace remembers",
          subtitle: "Review and manage your AI memory.",
          icon: "bulb-outline",
          tone: "lavender",
          route: "memory",
          badge: {
            label: `${memoryCount} ${memoryCount === 1 ? "item" : "items"}`,
            tone: "lavender",
          },
        },
        {
          title: "Appearance & preferences",
          subtitle: "Theme, sound, haptics, and accessibility.",
          icon: "color-palette-outline",
          tone: "sage",
          route: "settings",
        },
      ],
    },
    {
      title: "Privacy & Support",
      icon: "shield-checkmark-outline",
      links: [
        {
          title: "Privacy & data",
          subtitle: "View, export, or delete your data.",
          icon: "lock-closed-outline",
          tone: "sage",
          route: "account",
          params: { section: "privacy" },
        },
        {
          title: "Find human support",
          subtitle: "Helpful resources when you need them.",
          icon: "heart-outline",
          tone: "peach",
          route: "support",
        },
        {
          title: "About Solace",
          subtitle: "Learn more about the app, purpose, and safety.",
          icon: "information-circle-outline",
          tone: "lavender",
          route: "about",
        },
      ],
    },
  ];

  const toneFor = (tone: Tone) =>
    dark
      ? darkTones[tone]
      : { surface: colors[`${tone}Surface`], ink: colors[`${tone}Text`] };

  return (
    <Screen
      edgeToEdge
      style={[styles.screen, { paddingTop: top + 5 }]}
      contentContainerStyle={{ backgroundColor: canvas }}
    >
      <View style={{ paddingHorizontal: gutter }}>
        <BotanicalBackdrop
          style={[styles.botanical, { opacity: dark ? 0.23 : 0.49 }]}
        />
        <Row style={styles.masthead}>
          <LotusMark size={29} />
          <AppText variant="heading" style={styles.brand}>
            Solace
          </AppText>
        </Row>
        <Row
          style={[
            styles.hero,
            stackHero && styles.stackedHero,
            {
              backgroundColor: dark ? "#21182B" : colors.heroSurface,
              borderColor: dark ? "#776582" : colors.heroBorder,
            },
          ]}
        >
          <Image
            source={profileArt[resolved].header}
            style={coverImageStyle}
            resizeMode="cover"
            fadeDuration={0}
            accessible={false}
            accessibilityIgnoresInvertColors
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundImage: dark
                  ? "linear-gradient(90deg, #1C1527 0%, #1C152799 54%, #1C152700 91%)"
                  : "linear-gradient(90deg, #FAEEE5 0%, #FAEEE5C7 55%, #FAEEE500 92%)",
              },
            ]}
          />
          <View
            style={[
              styles.avatar,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                borderColor: dark ? "#927F9C" : colors.heroBorder,
                backgroundColor: dark
                  ? colors.surface2
                  : colors.lavenderSurface,
              },
            ]}
          >
            <Icon name="person-outline" size={31} color={colors.lavenderText} />
            {avatar && avatar !== failedAvatar && (
              <Image
                key={avatar}
                accessibilityLabel="Your profile photo"
                source={{ uri: avatar }}
                resizeMode="cover"
                fadeDuration={0}
                onError={() => setFailedAvatar(avatar)}
                style={coverImageStyle}
              />
            )}
          </View>
          <View style={stackHero ? styles.stackedNameBlock : styles.nameBlock}>
            <AppText
              variant="title"
              accessibilityRole="header"
              style={styles.name}
            >
              {app.user?.name || "Your space"}
            </AppText>
            <AppText color={colors.text} style={styles.subtitle}>
              Your space, your pace.
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Profile"
              accessibilityHint="Change your name or profile photo"
              onPress={() => app.navigate("account")}
              style={({ pressed }) => [
                styles.editTarget,
                pressed && styles.pressed,
              ]}
            >
              <Row
                style={[
                  styles.editPill,
                  { backgroundColor: dark ? "#F5C8B6" : "#E1E8D1" },
                ]}
              >
                <AppText
                  variant="label"
                  color={dark ? "#2B1D2A" : colors.text}
                  style={styles.editLabel}
                >
                  Edit Profile
                </AppText>
                <Icon
                  name="arrow-forward"
                  size={16}
                  color={dark ? "#2B1D2A" : colors.text}
                />
              </Row>
            </Pressable>
          </View>
        </Row>
        {groups.map((group) => (
          <View key={group.title} style={styles.section}>
            <Row style={styles.groupHeading}>
              <Icon name={group.icon} size={19} color={colors.sageText} />
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={styles.groupTitle}
              >
                {group.title}
              </AppText>
            </Row>
            <View
              style={[
                styles.group,
                {
                  backgroundColor: dark ? "#1A1624" : colors.surface,
                  backgroundImage: dark
                    ? "linear-gradient(148deg, #211B2C 0%, #181421 100%)"
                    : undefined,
                  borderColor: groupBorder,
                },
              ]}
            >
              {group.links.map((link, index) => {
                const tone = toneFor(link.tone);
                const badgeTone = link.badge && toneFor(link.badge.tone);
                const badge = link.badge && badgeTone && (
                  <AppText
                    variant="label"
                    color={badgeTone.ink}
                    style={[
                      styles.badge,
                      compact && styles.badgeInline,
                      { backgroundColor: badgeTone.surface },
                    ]}
                  >
                    {link.badge.label}
                  </AppText>
                );

                return (
                  <React.Fragment key={link.title}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: dark ? "#514258" : colors.border },
                        ]}
                      />
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={link.title}
                      accessibilityValue={
                        link.badge ? { text: link.badge.label } : undefined
                      }
                      accessibilityHint={link.subtitle}
                      onPress={() => app.navigate(link.route, link.params)}
                      style={({ pressed }) => [
                        styles.link,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.linkIcon,
                          { backgroundColor: tone.surface },
                        ]}
                      >
                        <Icon name={link.icon} color={tone.ink} size={21} />
                      </View>
                      <View style={styles.linkCopy}>
                        <AppText variant="heading" style={styles.linkTitle}>
                          {link.title}
                        </AppText>
                        <AppText
                          variant="caption"
                          color={muted}
                          style={styles.linkSubtitle}
                        >
                          {link.subtitle}
                        </AppText>
                        {compact && badge}
                      </View>
                      {!compact && badge}
                      <Icon name="chevron-forward" size={14} color={muted} />
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.footer, { paddingHorizontal: gutter }]}>
        <Image
          source={profileArt[resolved].footer}
          style={coverImageStyle}
          resizeMode="cover"
          fadeDuration={0}
          accessible={false}
          accessibilityIgnoresInvertColors
          pointerEvents="none"
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(180deg, ${canvas} 0%, ${canvas}00 35%, ${canvas}00 80%, ${canvas} 100%)`,
            },
          ]}
        />
        <LotusMark size={33} />
        <AppText variant="heading" style={styles.footerQuote}>
          Your pace is enough.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  botanical: { width: 185, height: 128, right: -41, top: -20 },
  masthead: {
    minHeight: 48,
    gap: spacing.compact,
    marginBottom: spacing.compact,
  },
  brand: { fontSize: 24, lineHeight: 28 },
  hero: {
    minHeight: 136,
    padding: spacing.card,
    gap: spacing.row,
    borderRadius: 19,
    borderWidth: 1,
    overflow: "hidden",
  },
  stackedHero: { flexDirection: "column", alignItems: "flex-start" },
  avatar: {
    flexShrink: 0,
    overflow: "hidden",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nameBlock: { flex: 1, minWidth: 0 },
  stackedNameBlock: { alignSelf: "stretch" },
  name: { fontSize: 32, lineHeight: 38 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  editTarget: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 48,
    justifyContent: "center",
  },
  editPill: {
    gap: spacing.compact,
    paddingHorizontal: spacing.row,
    paddingVertical: 4,
    minHeight: 36,
    borderRadius: 18,
  },
  editLabel: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  pressed: { opacity: 0.72 },
  section: { marginTop: spacing.section },
  groupHeading: { gap: spacing.compact, marginBottom: spacing.compact },
  groupTitle: { flex: 1, fontSize: 22, lineHeight: 26 },
  group: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: spacing.row,
    paddingVertical: 4,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    gap: spacing.row,
    paddingVertical: spacing.compact,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCopy: { flex: 1, minWidth: 0, gap: 3 },
  linkTitle: { fontSize: 19, lineHeight: 23 },
  linkSubtitle: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  badge: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 13,
    paddingHorizontal: spacing.compact,
    paddingVertical: 3,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  badgeInline: { alignSelf: "flex-start" },
  footer: {
    overflow: "hidden",
    minHeight: 138,
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
    alignItems: "center",
    gap: spacing.compact,
  },
  footerQuote: {
    textAlign: "center",
    fontSize: 25,
    lineHeight: 29,
    fontStyle: "italic",
  },
});
