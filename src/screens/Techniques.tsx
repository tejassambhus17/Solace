import React, { useRef } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "../layout";
import { isRecordId, routes } from "../routes";
import { useApp } from "../store";
import {
  getTechnique,
  listTechniques,
  techniqueCategories,
  type Technique,
  type TechniqueCategory,
} from "../techniques";
import { artGradient, useTheme } from "../theme";
import { AppText, Button, coverImageStyle, Icon, Screen } from "../ui";

const artwork = {
  breathe: require("../../assets/guided-breathe.jpg"),
  ground: require("../../assets/guided-ground.jpg"),
  reflect: require("../../assets/guided-reflect.jpg"),
  sleep: require("../../assets/guided-rest.jpg"),
};
const artworkOrder = ["breathe", "ground", "sleep", "reflect"] as const;

function durationLabel(technique: Technique) {
  return `${technique.selfPaced ? "About " : ""}${technique.activity.durationSec / 60} min`;
}

function restoredOffset(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function TechniqueHeader({ title, back }: { title: string; back: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={back}
        style={styles.back}
      >
        <Icon name="chevron-back" size={24} />
      </Pressable>
      <AppText
        variant="title"
        accessibilityRole="header"
        style={styles.headerTitle}
      >
        {title}
      </AppText>
    </View>
  );
}

export function TechniquesScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const gutter = spacing.card;
  const dark = resolved === "dark";
  const category =
    techniqueCategories.find((item) => item === app.params.category) ?? "All";
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const chips = useRef<React.ElementRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const chipOffset = useRef(0);
  const restoreScroll = useRef(restoredOffset(app.params.y));
  const restoreChip = useRef(restoredOffset(app.params.chipX));
  function filter(next: TechniqueCategory) {
    if (next === category) return;
    app.setParams({ category: next, y: 0 });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function open(technique: Technique) {
    app.setParams({ category, y: offset.current, chipX: chipOffset.current });
    app.navigate(routes.technique, { id: technique.id });
  }
  const results = listTechniques(category);
  const highlights = artworkOrder.flatMap(
    (kind) => results.find((entry) => entry.artwork === kind) ?? [],
  );
  const list =
    category === "All"
      ? [
          ...highlights,
          ...results.filter((entry) => !highlights.includes(entry)),
        ]
      : results;
  return (
    <Screen
      edgeToEdgeTop
      heroStatusBar={dark ? "light" : "dark"}
      style={{ paddingTop: top + 17, paddingHorizontal: gutter }}
      scrollRef={scroll}
      onScroll={(event) => {
        offset.current = Math.max(0, event.nativeEvent.contentOffset.y);
      }}
      onContentSizeChange={() => {
        if (!restoreScroll.current) return;
        scroll.current?.scrollTo({ y: restoreScroll.current, animated: false });
        restoreScroll.current = 0;
      }}
    >
      <View pointerEvents="none" style={styles.botanicalFrame}>
        <Image
          accessible={false}
          source={require("../../assets/botanical-compact.png")}
          resizeMode="contain"
          fadeDuration={0}
          style={[styles.botanical, { opacity: dark ? 0.58 : 0.24 }]}
        />
      </View>
      <TechniqueHeader title="Guided techniques" back={app.back} />
      <AppText color={colors.muted} style={styles.subtitle}>
        Short practices for moments when you need a little support.
      </AppText>
      <ScrollView
        ref={chips}
        accessibilityRole="radiogroup"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters, { paddingHorizontal: gutter }]}
        style={{ marginHorizontal: -gutter, marginTop: 20, marginBottom: 16 }}
        onScroll={(event) => {
          chipOffset.current = Math.max(0, event.nativeEvent.contentOffset.x);
        }}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (!restoreChip.current) return;
          chips.current?.scrollTo({ x: restoreChip.current, animated: false });
          restoreChip.current = 0;
        }}
      >
        {techniqueCategories.map((item) => {
          const selected = category === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => filter(item)}
              style={({ pressed }) => [
                styles.filterTouch,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.filter,
                  {
                    backgroundColor: selected
                      ? dark
                        ? "#D3A8F2"
                        : colors.lavenderSurface
                      : colors.surface,
                    borderColor: selected
                      ? dark
                        ? "#E3BDF6"
                        : colors.lavender
                      : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={
                    selected
                      ? dark
                        ? "#21152C"
                        : colors.lavenderText
                      : colors.text
                  }
                >
                  {item}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.list}>
        {list.map((technique) => (
          <Pressable
            key={technique.id}
            accessibilityRole="button"
            accessibilityLabel={`${technique.title}, ${durationLabel(technique)}, ${technique.label}`}
            accessibilityHint={technique.description}
            onPress={() => open(technique)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.tileArt,
                { backgroundColor: colors.lavenderSurface },
              ]}
            >
              <Image
                accessible={false}
                source={artwork[technique.artwork]}
                resizeMode="cover"
                fadeDuration={0}
                style={coverImageStyle}
              />
            </View>
            <View style={styles.tileCopy}>
              <AppText variant="heading" style={styles.tileTitle}>
                {technique.title}
              </AppText>
              <AppText variant="caption" color={colors.muted}>
                {technique.description}
              </AppText>
            </View>
            <View style={styles.chevron}>
              <Icon name="arrow-forward" size={17} color={colors.text} />
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

export function TechniqueDetailScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const gutter = useScreenGutter();
  const dark = resolved === "dark";
  const opening = useRef(false);
  const technique = getTechnique(app.params.id);
  if (!technique) {
    return (
      <Screen title="Technique" back={app.back}>
        <AppText color={colors.muted}>This practice is unavailable.</AppText>
        <Button
          title="Browse techniques"
          onPress={() => app.navigate(routes.techniques)}
          style={styles.action}
        />
      </Screen>
    );
  }
  const conversationId = isRecordId(app.params.conversationId)
    ? app.params.conversationId
    : undefined;
  const source =
    conversationId || app.params.source === "chat"
      ? "chat"
      : app.params.source === "journal"
        ? "journal"
        : "explore";
  return (
    <Screen
      edgeToEdgeTop
      heroStatusBar={dark ? "light" : "dark"}
      style={{ paddingTop: top + 12, flexGrow: 1 }}
    >
      <View
        pointerEvents="none"
        style={[styles.hero, { backgroundColor: colors.bg, height: top + 282 }]}
      >
        <Image
          accessible={false}
          source={artwork[technique.artwork]}
          resizeMode="cover"
          fadeDuration={0}
          style={coverImageStyle}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            artGradient(
              `linear-gradient(180deg, ${dark ? "#151222E8" : "#FBF0E8F5"} 0%, ${dark ? "#1512221A" : "#FBF0E833"} 29%, #15122200 52%, ${colors.bg} 100%)`,
            ),
          ]}
        />
      </View>
      <View
        style={[
          styles.heroHeader,
          { marginHorizontal: -gutter, paddingHorizontal: gutter },
        ]}
      >
        <TechniqueHeader title="Technique" back={app.back} />
      </View>
      <View style={styles.detailIntro}>
        <AppText variant="title" accessibilityRole="header">
          {technique.title}
        </AppText>
        <AppText color={colors.muted} style={styles.description}>
          {technique.description}
        </AppText>
      </View>
      <View style={styles.metadata}>
        {(
          [
            ["time-outline", durationLabel(technique)],
            ["stats-chart-outline", "Beginner"],
            ["leaf-outline", technique.label],
          ] as const
        ).map(([icon, label]) => (
          <View
            key={label}
            style={[
              styles.badge,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Icon
              name={icon}
              size={15}
              color={icon === "leaf-outline" ? colors.accent : colors.muted}
            />
            <AppText variant="caption">{label}</AppText>
          </View>
        ))}
      </View>
      <View
        style={[
          styles.guidance,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText variant="heading" accessibilityRole="header">
          What you’ll do
        </AppText>
        {[
          ...technique.activity.steps.map((step) => step.title),
          ...(technique.activity.type === "breathing"
            ? ["Keep a comfortable pace"]
            : []),
        ].map((step) => (
          <View style={styles.step} key={step}>
            <View
              style={[
                styles.stepNumber,
                { backgroundColor: colors.lavenderSurface },
              ]}
            >
              <Icon name="checkmark" size={14} color={colors.lavenderText} />
            </View>
            <AppText variant="caption" style={{ flex: 1 }}>
              {step}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.actionSpace} />
      <Button
        title="Start practice"
        icon="play"
        style={styles.action}
        onPress={() => {
          if (opening.current) return;
          opening.current = true;
          app.navigate(routes.momentPlayer, {
            techniqueId: technique.id,
            source,
            ...(conversationId ? { conversationId } : {}),
          });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerTitle: {
    flex: 1,
    fontSize: 34,
    lineHeight: Platform.OS === "android" ? 43 : 38,
  },
  back: { width: 44, minHeight: 44, justifyContent: "center", marginLeft: -9 },
  subtitle: { marginLeft: 42, marginTop: 5, maxWidth: 240, paddingRight: 10 },
  botanicalFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 145,
    overflow: "hidden",
  },
  botanical: {
    position: "absolute",
    top: -58,
    right: -30,
    width: 150,
    height: 185,
    transform: [{ rotate: "17deg" }],
  },
  filters: { alignItems: "center", gap: spacing.compact },
  filterTouch: { justifyContent: "center", minHeight: 44 },
  filter: {
    minHeight: 34,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  pressed: { opacity: 0.75 },
  list: { gap: 10 },
  tile: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileArt: { width: "37%", maxWidth: 156, overflow: "hidden" },
  tileCopy: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 9,
    paddingLeft: 11,
    gap: 1,
  },
  tileTitle: { fontSize: 25, lineHeight: Platform.OS === "android" ? 32 : 28 },
  chevron: { justifyContent: "center", paddingHorizontal: spacing.compact },
  hero: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden" },
  heroHeader: { minHeight: 47 },
  detailIntro: { marginTop: 173 },
  description: { marginTop: 4 },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    marginTop: 20,
    marginBottom: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  guidance: { gap: 11, borderWidth: 1, borderRadius: 18, padding: 16 },
  step: { minHeight: 31, flexDirection: "row", alignItems: "center", gap: 10 },
  stepNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  action: { marginTop: spacing.row },
  actionSpace: { flexGrow: 1 },
});
