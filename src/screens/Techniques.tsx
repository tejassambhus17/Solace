import React, { useRef } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "../layout";
import { webRadioProps } from "../radio-keyboard";
import { isRecordId, routes } from "../routes";
import { useApp } from "../store";
import { techniqueArtwork } from "../technique-artwork";
import {
  getTechnique,
  listTechniques,
  techniqueCategories,
  type Technique,
  type TechniqueCategory,
} from "../techniques";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  Button,
  coverImageStyle,
  Icon,
  IconButton,
  NestedState,
  Screen,
} from "../ui";

const artworkOrder = ["breathe", "ground", "sleep", "reflect"] as const;

function durationLabel(technique: Technique) {
  return `${technique.selfPaced ? "About " : ""}${technique.activity.durationSec / 60} min`;
}

function paceLabel(technique: Technique) {
  return technique.selfPaced ? "Self-paced" : "Timed";
}

function restoredOffset(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function TechniquesScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { top } = useSafeAreaInsets();
  const gutter = useScreenGutter();
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
  const [lead, ...remaining] = list;
  return (
    <Screen
      edgeToEdgeTop
      variant="nested"
      heroStatusBar={dark ? "light" : "dark"}
      style={{ paddingTop: top + spacing.screenTop }}
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
      <IconButton
        name="chevron-back"
        label="Go back"
        onPress={app.back}
        appearance="outlined"
        size={48}
      />
      <View style={styles.catalogHeader}>
        <AppText variant="display" accessibilityRole="header">
          Guided techniques
        </AppText>
        <AppText color={colors.muted}>
          Short practices for moments when you need a little support.
        </AppText>
      </View>
      <ScrollView
        ref={chips}
        accessibilityRole="radiogroup"
        accessibilityLabel="Filter guided techniques"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters, { paddingHorizontal: gutter }]}
        style={{ marginHorizontal: -gutter, marginBottom: spacing.card }}
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
              {...webRadioProps(selected)}
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
                        : colors.lavenderText
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
      {lead && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${lead.title}, ${durationLabel(lead)}, ${paceLabel(lead)}, ${lead.label}`}
          accessibilityHint={lead.description}
          onPress={() => open(lead)}
          style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
        >
          <Image
            accessible={false}
            source={techniqueArtwork[lead.artwork]}
            resizeMode="cover"
            resizeMethod={dark ? "resize" : "scale"}
            fadeDuration={0}
            style={coverImageStyle}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              dark ? sceneScrim : daylightSceneScrim,
            ]}
          />
          <View style={styles.leadBody}>
            <View style={styles.tileCopy}>
              <AppText variant="title" color={sceneInk}>
                {lead.title}
              </AppText>
              <AppText color={sceneInk} variant="caption">
                {durationLabel(lead)} · {paceLabel(lead)}
              </AppText>
            </View>
            <View style={styles.sceneArrow}>
              <Icon name="arrow-forward" size={20} color={sceneInk} />
            </View>
          </View>
        </Pressable>
      )}
      <View style={styles.list}>
        {remaining.length > 0 && (
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={styles.listTitle}
          >
            {category === "All"
              ? "Explore the library"
              : `More for ${category.toLowerCase()}`}
          </AppText>
        )}
        {remaining.map((technique) => (
          <Pressable
            key={technique.id}
            accessibilityRole="button"
            accessibilityLabel={`${technique.title}, ${durationLabel(technique)}, ${paceLabel(technique)}, ${technique.label}`}
            accessibilityHint={technique.description}
            onPress={() => open(technique)}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: colors.border },
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
                source={techniqueArtwork[technique.artwork]}
                resizeMode="cover"
                fadeDuration={0}
                style={coverImageStyle}
              />
            </View>
            <View style={styles.tileCopy}>
              <AppText variant="heading" style={styles.tileTitle}>
                {technique.title}
              </AppText>
              <AppText
                variant="caption"
                color={colors.lavenderText}
                style={styles.tileMeta}
              >
                {durationLabel(technique)} · {paceLabel(technique)}
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
  const { height, fontScale } = useWindowDimensions();
  const dark = resolved === "dark";
  const artworkHeight = Math.min(268, Math.max(176, height * 0.34));
  const opening = useRef(false);
  const technique = getTechnique(app.params.id);
  if (!technique) {
    return (
      <Screen variant="nested" title="Technique" back={app.back}>
        <NestedState
          title="Practice unavailable"
          description="Choose another practice from the techniques library."
          icon="compass-outline"
        >
          <Button
            title="Browse techniques"
            onPress={() => app.navigate(routes.techniques)}
          />
        </NestedState>
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
      variant="nested"
      heroStatusBar={dark ? "light" : "dark"}
      style={{ paddingTop: top + spacing.row }}
    >
      <View style={[styles.detailHero, { minHeight: artworkHeight }]}>
        <Image
          accessible={false}
          source={techniqueArtwork[technique.artwork]}
          resizeMode="cover"
          resizeMethod={dark ? "resize" : "scale"}
          fadeDuration={0}
          style={coverImageStyle}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            dark ? sceneScrim : daylightSceneScrim,
          ]}
        />
        <View style={styles.detailBack}>
          <IconButton
            name="chevron-back"
            label="Go back"
            onPress={app.back}
            appearance="outlined"
            size={48}
          />
        </View>
        <AppText
          variant={fontScale > 1.35 ? "title" : "display"}
          color={sceneInk}
          accessibilityRole="header"
          style={styles.detailTitle}
        >
          {technique.title}
        </AppText>
      </View>
      <View style={[styles.metadata, { borderColor: colors.border }]}>
        {(
          [
            ["time-outline", durationLabel(technique)],
            [
              technique.selfPaced ? "hand-left-outline" : "hourglass-outline",
              paceLabel(technique),
            ],
            ["leaf-outline", technique.label],
          ] as const
        ).map(([icon, label]) => (
          <View
            key={label}
            style={[
              styles.badge,
              !dark && styles.daylightBadge,
              !dark && { backgroundColor: colors.lavenderSurface },
            ]}
          >
            <Icon name={icon} size={15} color={colors.lavenderText} />
            <AppText variant="caption">{label}</AppText>
          </View>
        ))}
      </View>
      <AppText color={colors.muted} style={styles.description}>
        {technique.description}
      </AppText>
      <View style={styles.guidance}>
        <AppText variant="heading" accessibilityRole="header">
          What you’ll do
        </AppText>
        {[
          ...technique.activity.steps.map((step) => step.title),
          ...(technique.activity.type === "breathing"
            ? ["Keep a comfortable pace"]
            : []),
        ].map((step, index) => (
          <View
            style={[styles.step, { borderColor: colors.border }]}
            key={step}
          >
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
            <AppText variant="caption" style={{ flex: 1 }}>
              {step}
            </AppText>
          </View>
        ))}
      </View>
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

const sceneInk = "#FFF5FF";
const sceneScrim = artGradient(
  "linear-gradient(180deg, #160F2A0A 10%, #160F2A10 32%, #180F2CD9 75%, #130C22F5 100%)",
);
const daylightSceneScrim = artGradient(
  "linear-gradient(180deg, transparent 38%, #281B3560 62%, #24192BE8 91%, #24192BF6 100%)",
);

const styles = StyleSheet.create({
  daylightBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  catalogHeader: {
    gap: spacing.compact,
    marginTop: spacing.row,
    marginBottom: spacing.row,
  },
  filters: { alignItems: "center", gap: spacing.compact },
  filterTouch: { justifyContent: "center", minHeight: 48 },
  filter: {
    minHeight: 34,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  pressed: { opacity: 0.75 },
  lead: {
    minHeight: 178,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: "#221631",
  },
  leadBody: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.row,
    padding: spacing.card,
    paddingTop: 62,
  },
  sceneArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBCEFF30",
    borderColor: "#EBCEFF56",
    borderWidth: 1,
  },
  list: { marginTop: spacing.section },
  listTitle: { marginBottom: spacing.compact },
  tile: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.compact,
  },
  tileArt: { width: 68, height: 57, borderRadius: 11, overflow: "hidden" },
  tileCopy: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    gap: 1,
  },
  tileTitle: { fontSize: 23, lineHeight: 28 },
  tileMeta: { marginTop: 3 },
  chevron: { justifyContent: "center", paddingHorizontal: spacing.compact },
  detailHero: {
    overflow: "hidden",
    borderRadius: 22,
    justifyContent: "space-between",
    backgroundColor: "#221631",
    padding: spacing.card,
  },
  detailBack: { alignSelf: "flex-start" },
  detailTitle: { marginTop: 52 },
  description: { marginTop: spacing.row },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    marginTop: spacing.compact,
    paddingVertical: spacing.compact,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingRight: spacing.compact,
    paddingVertical: 5,
  },
  guidance: { marginTop: spacing.section, gap: 2 },
  step: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.compact,
  },
  stepNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  action: { marginTop: spacing.section },
});
