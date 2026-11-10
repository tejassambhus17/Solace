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
import { webRadioProps } from "../radio-keyboard";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import { AppText, coverImageStyle, Icon, IconButton, Screen } from "../ui";
import {
  wellnessToolGroups,
  type WellnessTool,
  type WellnessToolDestination,
} from "../wellness-tools";

const filters = [
  { id: "all", label: "All Tools", icon: null },
  { id: "relax", label: "Relax", icon: "sunny-outline" },
  { id: "move", label: "Move", icon: "walk-outline" },
  { id: "grow", label: "Grow", icon: "leaf-outline" },
] as const;

function ToolCard({
  tool,
  compact,
  featured,
  onOpen,
}: {
  tool: WellnessTool;
  compact: boolean;
  featured?: boolean;
  onOpen: (destination: WellnessToolDestination) => void;
}) {
  const { colors, resolved } = useTheme();
  const accent = colors[`${tool.tone}Text`];
  const light = resolved === "light";
  const artwork =
    light && tool.destination.route === "ambient-mixer" && featured
      ? require("../../assets/redesign-explore-feature-light.jpg")
      : light && tool.destination.route === "assessments"
        ? require("../../assets/redesign-explore-reflect.jpg")
        : tool.artwork;
  if (featured)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tool.title}
        accessibilityHint={tool.detail}
        onPress={() => onOpen(tool.destination)}
        style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
      >
        <Image
          accessible={false}
          source={artwork}
          resizeMode="cover"
          resizeMethod={light ? "scale" : "resize"}
          fadeDuration={0}
          style={[coverImageStyle, tool.flipArtwork && styles.flippedArt]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            light ? daylightFeaturedScrim : featuredScrim,
          ]}
        />
        <View style={styles.featuredBody}>
          <View style={styles.toolCopy}>
            <AppText variant="heading" color={sceneInk}>
              {tool.title}
            </AppText>
            <AppText variant="caption" color={sceneInk}>
              {tool.detail}
            </AppText>
          </View>
          <View style={styles.sceneArrow}>
            <Icon name="arrow-forward" color={sceneInk} size={18} />
          </View>
        </View>
      </Pressable>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tool.title}
      accessibilityHint={tool.detail}
      onPress={() => onOpen(tool.destination)}
      style={({ pressed }) => [
        compact ? styles.toolCompact : styles.tool,
        {
          backgroundColor: compact ? undefined : colors.surface,
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
          source={artwork}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={0}
          style={[coverImageStyle, tool.flipArtwork && styles.flippedArt]}
        />
      </View>
      <View style={[styles.toolCopy, !compact && styles.gridCopy]}>
        <View style={styles.toolTitleRow}>
          <AppText variant="heading" style={styles.toolTitle}>
            {tool.title}
          </AppText>
          <Icon name="arrow-forward" size={15} color={accent} />
        </View>
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.toolDetail}
        >
          {tool.detail}
        </AppText>
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
  const feature = visibleGroups[0]?.tools[0];

  function open(destination: WellnessToolDestination) {
    app.setParams({ wellnessFilter: filter, wellnessY: offset.current });
    app.navigate(destination.route, destination.params);
  }

  return (
    <Screen
      variant="nested"
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
      <View
        style={[
          styles.body,
          { backgroundColor: colors.bg, paddingHorizontal: gutter },
        ]}
      >
        <IconButton
          name="chevron-back"
          label="Back"
          onPress={app.back}
          appearance="outlined"
          size={48}
        />
        <View style={styles.intro}>
          <AppText variant="display" accessibilityRole="header">
            Wellness Tools
          </AppText>
          <AppText color={colors.muted}>
            Find a practice to rest, move, or make sense of your day.
          </AppText>
        </View>
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
                {...webRadioProps(selected)}
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
                    borderColor: selected
                      ? resolved === "light"
                        ? colors.accent
                        : colors.primary
                      : colors.border,
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

        {visibleGroups.map(({ title, icon, tools }) => {
          const spotlight = tools[0] === feature;
          const rest = spotlight ? tools.slice(1) : tools;
          return (
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
              {spotlight && feature && (
                <ToolCard
                  tool={feature}
                  compact={compact}
                  featured
                  onOpen={open}
                />
              )}
              <View
                style={[
                  styles.groupTools,
                  !compact && rest.length > 1 && styles.toolGrid,
                ]}
              >
                {rest.map((tool) => (
                  <ToolCard
                    key={tool.title}
                    tool={tool}
                    compact={compact || rest.length === 1}
                    onOpen={open}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const sceneInk = "#FFF5FF";
const featuredScrim = artGradient(
  "linear-gradient(100deg, #150F24ED 0%, #150F24BE 48%, #150F2436 100%)",
);
const daylightFeaturedScrim = artGradient(
  "linear-gradient(100deg, #291C37ED 0%, #291C37AA 44%, #291C3733 72%, transparent 100%)",
);

const styles = StyleSheet.create({
  screen: { paddingTop: 0, paddingHorizontal: 0 },
  body: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.screenTop,
  },
  intro: {
    gap: spacing.compact,
    marginTop: spacing.row,
    marginBottom: spacing.card,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    marginBottom: spacing.row,
  },
  filter: {
    flexGrow: 1,
    minHeight: 48,
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
  group: { marginTop: spacing.section, gap: spacing.row },
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  groupTitle: { flex: 1, minWidth: 0, fontSize: 26, lineHeight: 30 },
  groupTools: { gap: spacing.compact },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  featured: {
    minHeight: 142,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: "#1D142F",
  },
  featuredBody: {
    padding: spacing.card,
    paddingTop: 46,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.row,
  },
  sceneArrow: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DEC7F26A",
    backgroundColor: "#DEC7F22F",
    borderRadius: 20,
  },
  tool: {
    width: "48.5%",
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  toolCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.compact,
  },
  artWindow: { height: 78, overflow: "hidden" },
  artWindowCompact: { width: 66, height: 58, borderRadius: 11 },
  flippedArt: { transform: [{ scaleX: -1 }] },
  toolCopy: { flex: 1, minWidth: 0, gap: 4 },
  gridCopy: { padding: spacing.row },
  toolTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
  },
  toolTitle: { flex: 1, minWidth: 0, fontSize: 23, lineHeight: 26 },
  toolDetail: { lineHeight: 18 },
  pressed: { opacity: 0.78 },
});
