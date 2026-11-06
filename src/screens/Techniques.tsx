import React, { useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { spacing } from "../layout";
import { isRecordId, routes } from "../routes";
import { useApp } from "../store";
import {
  getTechnique,
  listTechniques,
  techniqueCategories,
  type Technique,
  type TechniqueCategory,
} from "../techniques";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon, Screen } from "../ui";

const artwork = {
  breathe: require("../../assets/redesign-explore-breathe.jpg"),
  ground: require("../../assets/redesign-explore-ground.jpg"),
  reflect: require("../../assets/redesign-explore-reflect.jpg"),
  sleep: require("../../assets/redesign-explore-sleep.jpg"),
};

function durationLabel(technique: Technique) {
  return `${technique.selfPaced ? "About " : ""}${technique.activity.durationSec / 60} min`;
}

export function TechniquesScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const category =
    techniqueCategories.find((item) => item === app.params.category) ?? "All";
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const restoreOffset = useRef(
    typeof app.params.y === "number" && Number.isFinite(app.params.y)
      ? Math.max(0, app.params.y)
      : 0,
  );
  function filter(next: TechniqueCategory) {
    if (next === category) return;
    app.setParams({ category: next, y: 0 });
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function open(technique: Technique) {
    app.setParams({ category, y: offset.current });
    app.navigate(routes.technique, { id: technique.id });
  }
  return (
    <Screen
      title="Guided techniques"
      back={app.back}
      scrollRef={scroll}
      onScroll={(event) => {
        offset.current = Math.max(0, event.nativeEvent.contentOffset.y);
      }}
      onContentSizeChange={() => {
        if (restoreOffset.current > 0) {
          scroll.current?.scrollTo({
            y: restoreOffset.current,
            animated: false,
          });
          restoreOffset.current = 0;
        }
      }}
    >
      <AppText color={colors.muted}>
        Short practices for moments when you need a little support.
      </AppText>
      <View accessibilityRole="radiogroup" style={styles.filters}>
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
                styles.filter,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <AppText
                variant="caption"
                color={selected ? colors.primaryText : colors.text}
              >
                {item}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.list}>
        {listTechniques(category).map((technique) => (
          <Pressable
            key={technique.id}
            accessibilityRole="button"
            accessibilityLabel={`${technique.title}, ${durationLabel(technique)}, ${technique.label}`}
            accessibilityHint={technique.description}
            onPress={() => open(technique)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
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
                style={styles.cover}
              />
            </View>
            <View style={styles.tileCopy}>
              <AppText variant="heading">{technique.title}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {technique.description}
              </AppText>
              <AppText variant="caption" color={colors.lavenderText}>
                {durationLabel(technique)} · {technique.label}
              </AppText>
            </View>
            <View style={styles.chevron}>
              <Icon name="chevron-forward" size={17} color={colors.muted} />
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

export function TechniqueDetailScreen() {
  const app = useApp();
  const { colors } = useTheme();
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
    <Screen title="Technique" back={app.back}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: colors.lavenderSurface,
            borderColor: colors.border,
          },
        ]}
      >
        <Image
          accessible={false}
          source={artwork[technique.artwork]}
          resizeMode="cover"
          style={styles.cover}
        />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {technique.title}
      </AppText>
      <AppText color={colors.muted} style={styles.description}>
        {technique.description}
      </AppText>
      <View style={styles.metadata}>
        <View
          style={[styles.badge, { backgroundColor: colors.lavenderSurface }]}
        >
          <Icon name="time-outline" size={16} color={colors.lavenderText} />
          <AppText variant="caption" color={colors.lavenderText}>
            {durationLabel(technique)}
          </AppText>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.sageSurface }]}>
          <Icon name="leaf-outline" size={16} color={colors.sageText} />
          <AppText variant="caption" color={colors.sageText}>
            {technique.label}
          </AppText>
        </View>
      </View>
      <Card style={styles.guidance}>
        <AppText variant="heading" accessibilityRole="header">
          What you’ll do
        </AppText>
        {technique.activity.steps.map((step, index) => (
          <View style={styles.step} key={step.title}>
            <View
              style={[
                styles.stepNumber,
                { backgroundColor: colors.lavenderSurface },
              ]}
            >
              <AppText variant="caption" color={colors.lavenderText}>
                {index + 1}
              </AppText>
            </View>
            <View style={styles.stepCopy}>
              <AppText variant="label">{step.title}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {step.instruction}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
      <Button
        title="Start practice"
        icon="play-outline"
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
  cover: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    marginVertical: spacing.section,
  },
  filter: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  list: { gap: spacing.row },
  tile: {
    minHeight: 108,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileArt: { width: "28%", maxWidth: 124 },
  tileCopy: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.row,
    paddingLeft: spacing.row,
    gap: 4,
  },
  chevron: { justifyContent: "center", paddingHorizontal: spacing.compact },
  hero: {
    width: "100%",
    aspectRatio: 1.8,
    overflow: "hidden",
    borderRadius: 23,
    borderWidth: 1,
    marginBottom: spacing.section,
  },
  description: { marginTop: spacing.compact },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    marginTop: spacing.row,
    marginBottom: spacing.section,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  guidance: { gap: spacing.row },
  step: { flexDirection: "row", alignItems: "flex-start", gap: spacing.row },
  stepNumber: {
    minWidth: 27,
    minHeight: 27,
    padding: 3,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCopy: { flex: 1, gap: 3 },
  action: { marginTop: spacing.section },
});
