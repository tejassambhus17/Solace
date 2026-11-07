import { useRef, type ComponentRef } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { spacing, useScreenGutter } from "../layout";
import { routes } from "../routes";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import { AppText, coverImageStyle, Icon, Screen } from "../ui";
import {
  wellnessToolGroups,
  type WellnessTool,
  type WellnessToolDestination,
} from "../wellness-tools";
import { ExploreFeatureHeader } from "./ExploreFeatureHeader";

const filters = [
  { id: "all", label: "All Tools", icon: null },
  { id: "relax", label: "Relax", icon: "sunny-outline" },
  { id: "move", label: "Move", icon: "walk-outline" },
  { id: "grow", label: "Grow", icon: "leaf-outline" },
] as const;

function ToolCard({
  tool,
  compact,
  onOpen,
}: {
  tool: WellnessTool;
  compact: boolean;
  onOpen: (destination: WellnessToolDestination) => void;
}) {
  const { colors } = useTheme();
  const accent = colors[`${tool.tone}Text`];
  const tint = colors[`${tool.tone}Surface`];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tool.title}
      accessibilityHint={tool.detail}
      onPress={() => onOpen(tool.destination)}
      style={({ pressed }) => [
        styles.tool,
        {
          backgroundColor: colors.surface,
          borderColor: pressed ? accent : colors.border,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.artWindow,
          compact && styles.artWindowCompact,
          { backgroundColor: colors.heroSurface },
        ]}
      >
        <Image
          accessible={false}
          source={tool.artwork}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
          style={[coverImageStyle, tool.flipArtwork && styles.flippedArt]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            artGradient(
              `linear-gradient(90deg, ${colors.surface}00 12%, ${colors.surface}20 35%, ${colors.surface} 55%)`,
            ),
          ]}
        />
      </View>
      <View style={[styles.iconRail, compact && styles.iconRailCompact]}>
        <View style={[styles.iconTile, { backgroundColor: tint }]}>
          <Icon name={tool.icon} size={19} color={accent} />
        </View>
      </View>
      <View style={styles.toolCopy}>
        <AppText variant="heading" style={styles.toolTitle}>
          {tool.title}
        </AppText>
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.toolDetail}
        >
          {tool.detail}
        </AppText>
      </View>
      <View style={[styles.arrow, { backgroundColor: tint }]}>
        <Icon name="chevron-forward" size={17} color={accent} />
      </View>
    </Pressable>
  );
}

function restoreOffset(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

export function WellnessToolsScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 370 || fontScale >= 1.2;
  const filter =
    filters.find(({ id }) => id === app.params.wellnessFilter)?.id ?? "all";
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(restoreOffset(app.params.wellnessY));
  const pendingOffset = useRef(offset.current);
  const visibleGroups = wellnessToolGroups.filter(
    (group) =>
      (filter === "all" || group.filter === filter) && group.tools.length,
  );

  function open(destination: WellnessToolDestination) {
    app.setParams({ wellnessFilter: filter, wellnessY: offset.current });
    app.navigate(destination.route, destination.params);
  }

  return (
    <Screen
      edgeToEdgeTop
      heroStatusBar={resolved === "dark" ? "light" : "dark"}
      style={styles.screen}
      scrollRef={scroll}
      onScroll={({ nativeEvent }) => {
        offset.current = Math.max(0, nativeEvent.contentOffset.y);
      }}
      onContentSizeChange={() => {
        if (!pendingOffset.current) return;
        scroll.current?.scrollTo({ y: pendingOffset.current, animated: false });
        pendingOffset.current = 0;
      }}
    >
      <ExploreFeatureHeader
        title="Wellness Tools"
        subtitle="A complete library of tools to help you pause, reset, and feel better."
        onBack={app.back}
      />
      <View
        style={[
          styles.body,
          { backgroundColor: colors.bg, paddingHorizontal: gutter },
        ]}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Filter wellness tools"
          style={styles.filters}
        >
          {filters.map(({ id, label, icon }) => {
            const selected = filter === id;
            const ink = selected ? colors.primaryText : colors.text;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => {
                  if (!selected)
                    app.setParams({
                      wellnessFilter: id,
                      wellnessY: offset.current,
                    });
                }}
                style={({ pressed }) => [
                  styles.filter,
                  compact && styles.filterCompact,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {!!icon && <Icon name={icon} size={15} color={ink} />}
                <AppText
                  variant="caption"
                  color={ink}
                  style={styles.filterLabel}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse all practices"
          accessibilityHint="Opens the complete Explore practice list."
          onPress={() => open({ route: routes.exploreCatalog })}
          style={({ pressed }) => [
            styles.browse,
            { backgroundColor: colors.sageSurface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="list-outline" color={colors.sageText} size={19} />
          <AppText
            variant="label"
            color={colors.sageText}
            style={styles.browseLabel}
          >
            Browse all practices
          </AppText>
          <Icon name="arrow-forward" color={colors.sageText} size={17} />
        </Pressable>

        {visibleGroups.map(({ title, icon, tools }) => (
          <View key={title} style={styles.group}>
            <View style={styles.groupHeading}>
              <Icon name={icon} color={colors.sageText} size={24} />
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={styles.groupTitle}
              >
                {title}
              </AppText>
            </View>
            <View style={styles.groupTools}>
              {tools.map((tool) => (
                <ToolCard
                  key={tool.title}
                  tool={tool}
                  compact={compact}
                  onOpen={open}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 0, paddingHorizontal: 0 },
  body: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.compact,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    marginBottom: spacing.row,
  },
  filter: {
    flexGrow: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: spacing.compact,
    borderRadius: 22,
    borderWidth: 1,
  },
  filterCompact: { flexBasis: "47%" },
  filterLabel: { flexShrink: 1, textAlign: "center" },
  browse: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    minHeight: 48,
  },
  browseLabel: { flex: 1, minWidth: 0 },
  group: { marginTop: spacing.section, gap: spacing.row },
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  groupTitle: { flex: 1, minWidth: 0, fontSize: 26, lineHeight: 30 },
  groupTools: { gap: spacing.compact + 2 },
  tool: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.row,
    overflow: "hidden",
  },
  artWindow: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "51%",
  },
  artWindowCompact: { width: 114 },
  flippedArt: { transform: [{ scaleX: -1 }] },
  iconRail: { flexShrink: 0, width: "24%", alignItems: "flex-end" },
  iconRailCompact: { width: 38 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  toolCopy: { flex: 1, minWidth: 0, gap: 4 },
  toolTitle: { fontSize: 23, lineHeight: 26 },
  toolDetail: { lineHeight: 18 },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.78 },
});
