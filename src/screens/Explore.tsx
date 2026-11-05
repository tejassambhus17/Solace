import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import {
  createExplorePractice,
  practiceDurations,
  practiceFocuses,
  type PracticeFocus,
} from "../explore-practices";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Icon, LotusMark, Row, Screen } from "../ui";

const categories = [
  { id: "all", label: "All", icon: "grid-outline" },
  { id: "breathe", label: "Breathe", icon: "cloud-outline" },
  { id: "reflect", label: "Reflect", icon: "pencil-outline" },
  { id: "relax", label: "Relax", icon: "moon-outline" },
  { id: "focus", label: "Focus", icon: "locate-outline" },
  { id: "move", label: "Move", icon: "body-outline" },
] as const;

type Category = (typeof categories)[number]["id"];
type Duration = (typeof practiceDurations)[number];
type PracticeDestination =
  | { route: string; params?: Record<string, string | number> }
  | { focus: PracticeFocus; minutes: Duration };
type ExploreItem = {
  title: string;
  detail: string;
  icon: string;
  categories: Exclude<Category, "all">[];
  destination: PracticeDestination;
};
type FeaturedTile = ExploreItem & {
  tile: { title: string; image: ImageSourcePropType; base: string };
};

const exploreArt = {
  sceneLight: require("../../assets/redesign-explore-scene-light.jpg"),
  sceneDark: require("../../assets/redesign-explore-scene-dark.jpg"),
  featureLight: require("../../assets/redesign-explore-feature-light.jpg"),
  featureDark: require("../../assets/redesign-explore-feature-dark.jpg"),
  breathe: require("../../assets/redesign-explore-breathe.jpg"),
  ground: require("../../assets/redesign-explore-ground.jpg"),
  reflect: require("../../assets/redesign-explore-reflect.jpg"),
  sleep: require("../../assets/redesign-explore-sleep.jpg"),
};

const featured: ExploreItem = {
  title: "Calm Your Mind",
  detail: "A 5-minute guided journey to slow down, breathe, and reset.",
  icon: "sparkles-outline",
  categories: ["breathe", "relax"],
  destination: { focus: "breathe", minutes: 5 },
};

const forYou: FeaturedTile[] = [
  {
    title: "3-Min Breath Reset",
    detail: "Take three minutes to follow a comfortable breathing rhythm.",
    icon: "cloud-outline",
    categories: ["breathe", "relax"],
    destination: { route: "breathing", params: { durationSec: 180 } },
    tile: {
      title: "3-Min\nBreath Reset",
      image: exploreArt.breathe,
      base: "#655477",
    },
  },
  {
    title: "Grounding in 5 Senses",
    detail: "Notice what’s around you, one sense at a time.",
    icon: "hand-left-outline",
    categories: ["focus", "relax"],
    destination: { route: "grounding" },
    tile: {
      title: "Grounding\nin 5 Senses",
      image: exploreArt.ground,
      base: "#505C49",
    },
  },
  {
    title: "Quick Reflection",
    detail: "A private place to write down a thought.",
    icon: "pencil-outline",
    categories: ["reflect", "focus"],
    destination: { route: "reflection" },
    tile: {
      title: "Quick\nReflection",
      image: exploreArt.reflect,
      base: "#68536F",
    },
  },
  {
    title: "Sleep Wind Down",
    detail: "Four gentle steps to wind down toward rest.",
    icon: "moon-outline",
    categories: ["relax"],
    destination: { route: "sleep" },
    tile: {
      title: "Sleep\nWind Down",
      image: exploreArt.sleep,
      base: "#313959",
    },
  },
];

const moreCards = [
  {
    title: "Guided Programs",
    detail: "Small steps for the next three days.",
    icon: "map-outline",
    route: "plan",
    tone: "lavender",
  },
  {
    title: "Wellness Toolkit",
    detail: "The practices and guides you’ve saved.",
    icon: "file-tray-outline",
    route: "toolkit",
    tone: "sage",
  },
  {
    title: "Check-Ins",
    detail: "Notice and record how you feel.",
    icon: "bar-chart-outline",
    route: "checkin",
    tone: "peach",
  },
] as const;

const extraTools: ExploreItem[] = [
  {
    title: "Solace Moments",
    detail: "Choose a guided activity for how you feel.",
    icon: "sparkles-outline",
    categories: ["breathe", "reflect", "relax", "focus"],
    destination: { route: "moments" },
  },
  {
    title: "Gentle Movement",
    detail: "A three-minute movement practice at your own pace.",
    icon: "body-outline",
    categories: ["move"],
    destination: { focus: "move", minutes: 3 },
  },
  {
    title: "Guides & Resources",
    detail: "Browse sleep, stress, connection, and other guides.",
    icon: "book-outline",
    categories: ["relax", "focus"],
    destination: { route: "resources" },
  },
  {
    title: "Reflective Check-Ins",
    detail: "Short mood, worry, and self-compassion questionnaires.",
    icon: "clipboard-outline",
    categories: ["reflect"],
    destination: { route: "assessments" },
  },
  {
    title: "Daily Affirmation",
    detail: "A kind thought to keep close.",
    icon: "heart-outline",
    categories: ["reflect", "relax"],
    destination: { route: "affirmation" },
  },
  {
    title: "Daily Challenge",
    detail: "One small, gentle action for today.",
    icon: "sunny-outline",
    categories: ["focus"],
    destination: { route: "challenge" },
  },
];

const catalog: ExploreItem[] = [
  featured,
  ...forYou,
  ...extraTools,
  ...moreCards.map((card): ExploreItem => ({
    title: card.title,
    detail: card.detail,
    icon: card.icon,
    categories: [],
    destination: { route: card.route },
  })),
];

function DecorativeImage({ source }: { source: ImageSourcePropType }) {
  return (
    <Image
      source={source}
      style={styles.image}
      resizeMode="cover"
      resizeMethod="resize"
      fadeDuration={0}
      pointerEvents="none"
      accessible={false}
      accessibilityIgnoresInvertColors
    />
  );
}

function IconAction({
  icon,
  label,
  onPress,
  expanded,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={onPress}
      style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}
    >
      <View style={styles.heroIcon}>
        <Icon name={icon} color={overlayInk} size={19} />
      </View>
    </Pressable>
  );
}

function SectionHeading({
  icon,
  title,
  detail,
  action,
}: {
  icon: string;
  title: string;
  detail?: string;
  action?: { label: string; onPress: () => void; expanded?: boolean };
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.sectionHeading}>
      <Icon name={icon} color={colors.text} size={21} />
      <View style={styles.sectionTitle}>
        <AppText
          variant="label"
          accessibilityRole="header"
          style={styles.sectionTitleText}
        >
          {title}
        </AppText>
        {detail && (
          <AppText
            variant="caption"
            color={colors.muted}
            style={styles.sectionDetail}
          >
            {detail}
          </AppText>
        )}
      </View>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: action.expanded }}
          aria-expanded={action.expanded}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.headingAction,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="caption" color={colors.muted}>
            {action.label}
          </AppText>
          <Icon
            name={action.expanded ? "chevron-up" : "chevron-forward"}
            color={colors.muted}
            size={13}
          />
        </Pressable>
      )}
    </Row>
  );
}

function ExploreResult({
  item,
  onPress,
}: {
  item: ExploreItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={item.detail}
      onPress={onPress}
      style={({ pressed }) => [
        styles.result,
        { borderBottomColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={item.icon} color={colors.primary} size={21} />
      <View style={styles.sectionTitle}>
        <AppText variant="label">{item.title}</AppText>
        <AppText variant="caption" color={colors.muted}>
          {item.detail}
        </AppText>
      </View>
      <Icon name="chevron-forward" color={colors.muted} size={15} />
    </Pressable>
  );
}

function Choice({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.sageSurface : colors.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          color={selected ? colors.sageText : colors.muted}
          size={16}
        />
      )}
      <AppText variant="label" color={selected ? colors.sageText : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ExploreScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const [category, setCategory] = useState<Category>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [focus, setFocus] = useState<PracticeFocus>("breathe");
  const [duration, setDuration] = useState<Duration>(5);
  const practicePlan = builderOpen
    ? createExplorePractice(focus, duration)
    : null;
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = catalog.filter((item) => {
    const text = `${item.title} ${item.detail}`.toLowerCase();
    return (
      (category === "all" || item.categories.includes(category)) &&
      terms.every((term) => text.includes(term))
    );
  });
  const searching = searchOpen && terms.length > 0;
  const showCatalog = searching || showAll || category !== "all";
  const categoryLabel = categories.find((item) => item.id === category)?.label;
  function open(destination: PracticeDestination) {
    if ("route" in destination) {
      app.navigate(destination.route, destination.params);
      return;
    }
    app.navigate("moment-player", {
      activity: createExplorePractice(destination.focus, destination.minutes),
      provider: "offline",
      source: "explore",
    });
  }
  function toggleSearch() {
    if (searchOpen) {
      setQuery("");
    } else {
      setCategory("all");
      setShowAll(false);
    }
    setSearchOpen(!searchOpen);
  }
  return (
    <Screen style={styles.screen}>
      <View
        style={[styles.hero, { backgroundColor: dark ? "#24213C" : "#545071" }]}
      >
        <DecorativeImage
          source={dark ? exploreArt.sceneDark : exploreArt.sceneLight}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage:
                "linear-gradient(90deg, #25223DCC 0%, #29264177 51%, #29264100 82%)",
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(180deg, ${colors.bg}00 74%, ${colors.bg} 100%)`,
            },
          ]}
        />
        <Row style={styles.heroHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to previous screen"
            onPress={app.back}
            style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
          >
            <Icon name="chevron-back" color={overlayInk} size={13} />
            <LotusMark size={26} />
            <AppText
              variant="label"
              color={overlayInk}
              style={styles.brandName}
            >
              Solace
            </AppText>
          </Pressable>
          <Row style={styles.heroActions}>
            <IconAction
              icon={searchOpen ? "close" : "search-outline"}
              label={searchOpen ? "Close practice search" : "Search practices"}
              onPress={toggleSearch}
              expanded={searchOpen}
            />
            <IconAction
              icon="bookmark-outline"
              label="Open saved wellness toolkit"
              onPress={() => app.navigate("toolkit")}
            />
          </Row>
        </Row>
        <View style={styles.heroCopy}>
          <AppText
            variant="title"
            accessibilityRole="header"
            color={overlayInk}
            style={styles.heroTitle}
          >
            Explore
          </AppText>
          <AppText color={overlayInk} style={styles.heroSubtitle}>
            Discover guided experiences, tools, and practices for your everyday
            wellbeing.
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        <View
          style={styles.categoryRail}
          accessibilityRole="radiogroup"
          accessibilityLabel="Practice categories"
        >
          {categories.map((item) => {
            const selected = category === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => {
                  setCategory(item.id);
                  setShowAll(false);
                }}
                style={({ pressed }) => [
                  styles.category,
                  {
                    backgroundColor: selected
                      ? colors.lavenderSurface
                      : colors.surface,
                    borderColor: selected ? colors.lavender : colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  name={item.icon}
                  color={selected ? colors.lavenderText : colors.text}
                  size={18}
                />
                <AppText
                  variant="label"
                  color={selected ? colors.lavenderText : colors.text}
                  style={styles.categoryLabel}
                >
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {searchOpen && (
          <View
            style={[
              styles.searchField,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Icon name="search-outline" color={colors.muted} size={19} />
            <TextInput
              autoFocus
              accessibilityLabel="Find a practice or wellness tool"
              placeholder="Find a practice or tool"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              returnKeyType="search"
              maxLength={120}
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
        )}

        {showCatalog ? (
          <View style={styles.catalog}>
            <SectionHeading
              icon={searching ? "search-outline" : "leaf-outline"}
              title={
                searching
                  ? "Search Results"
                  : category === "all"
                    ? "All Practices"
                    : categoryLabel || "Practices"
              }
              action={
                showAll
                  ? {
                      label: "Show Less",
                      expanded: true,
                      onPress: () => setShowAll(false),
                    }
                  : undefined
              }
            />
            <AppText
              variant="caption"
              accessibilityLiveRegion="polite"
              color={colors.muted}
            >
              {results.length
                ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                : "No results. Try a different search or choose All."}
            </AppText>
            {results.map((item) => (
              <ExploreResult
                key={item.title}
                item={item}
                onPress={() => open(item.destination)}
              />
            ))}
          </View>
        ) : (
          <>
            <View
              style={[
                styles.feature,
                { backgroundColor: dark ? "#2B263D" : "#5C4D68" },
              ]}
            >
              <DecorativeImage
                source={dark ? exploreArt.featureDark : exploreArt.featureLight}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundImage:
                      "linear-gradient(90deg, #272139CC 0%, #2D263DB3 36%, #302B420F 78%)",
                  },
                ]}
              />
              <View style={styles.featureCopy}>
                <Row style={styles.featureBadge}>
                  <Icon name="sparkles-outline" color="#F5D4A0" size={13} />
                  <AppText
                    variant="caption"
                    color={overlayInk}
                    style={styles.featureBadgeText}
                  >
                    Solace Moment
                  </AppText>
                </Row>
                <AppText
                  variant="title"
                  color={overlayInk}
                  accessibilityRole="header"
                  style={styles.featureTitle}
                >
                  {featured.title}
                </AppText>
                <AppText color={overlayInk} style={styles.featureDescription}>
                  {featured.detail}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start Moment, Calm Your Mind, 5 minutes"
                  onPress={() => open(featured.destination)}
                  style={({ pressed }) => [
                    styles.featureAction,
                    { backgroundColor: dark ? colors.primary : "#FFF6EC" },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name="play"
                    size={15}
                    color={dark ? colors.primaryText : "#26252B"}
                  />
                  <AppText
                    variant="label"
                    color={dark ? colors.primaryText : "#26252B"}
                  >
                    Start Moment
                  </AppText>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading
                icon="leaf-outline"
                title="For You Today"
                action={{
                  label: "See All",
                  expanded: false,
                  onPress: () => setShowAll(true),
                }}
              />
              <View style={styles.tiles}>
                {forYou.map((item) => (
                  <Pressable
                    key={item.title}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => open(item.destination)}
                    style={({ pressed }) => [
                      styles.tile,
                      { backgroundColor: item.tile.base },
                      pressed && styles.pressed,
                    ]}
                  >
                    <DecorativeImage source={item.tile.image} />
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundImage:
                            "linear-gradient(180deg, #211D3300 30%, #262138D9 100%)",
                        },
                      ]}
                    />
                    <View style={styles.tilePlay}>
                      <Icon name="play" color={overlayInk} size={10} />
                    </View>
                    <AppText
                      variant="label"
                      color={overlayInk}
                      style={styles.tileLabel}
                    >
                      {item.tile.title}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        <View style={styles.builder}>
          <SectionHeading
            icon="locate-outline"
            title="Build Your Practice"
            detail="Create a simple, personalized wellbeing routine."
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Build Your Practice"
            accessibilityState={{ expanded: builderOpen }}
            aria-expanded={builderOpen}
            onPress={() => setBuilderOpen(!builderOpen)}
            style={({ pressed }) => [
              styles.builderStrip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.builderPicture}>
              <DecorativeImage source={exploreArt.breathe} />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundImage: `linear-gradient(90deg, ${colors.surface}00 40%, ${colors.surface} 100%)`,
                  },
                ]}
              />
            </View>
            {(
              [
                ["locate-outline", "Choose\nYour Focus"],
                ["time-outline", "Set\nDuration"],
                ["sparkles-outline", "Get Your\nPlan"],
              ] as const
            ).map(([icon, label], index) => (
              <React.Fragment key={label}>
                {index > 0 && (
                  <Icon name="chevron-forward" color={colors.muted} size={11} />
                )}
                <View style={styles.builderStep}>
                  <Icon name={icon} color={colors.sageText} size={17} />
                  <AppText variant="label" style={styles.builderStepLabel}>
                    {label}
                  </AppText>
                </View>
              </React.Fragment>
            ))}
            <View
              style={[
                styles.builderAction,
                { backgroundColor: colors.primary },
              ]}
            >
              <Icon
                name={builderOpen ? "chevron-up" : "arrow-forward"}
                color={colors.primaryText}
                size={18}
              />
            </View>
          </Pressable>
          {practicePlan && (
            <View
              style={[
                styles.builderForm,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <AppText variant="label" accessibilityRole="header">
                Choose your focus
              </AppText>
              <View
                style={styles.choices}
                accessibilityRole="radiogroup"
                accessibilityLabel="Practice focus"
              >
                {(Object.keys(practiceFocuses) as PracticeFocus[]).map(
                  (key) => (
                    <Choice
                      key={key}
                      label={practiceFocuses[key].label}
                      icon={practiceFocuses[key].icon}
                      selected={focus === key}
                      onPress={() => setFocus(key)}
                    />
                  ),
                )}
              </View>
              <AppText variant="label" accessibilityRole="header">
                Set duration
              </AppText>
              <View
                style={styles.choices}
                accessibilityRole="radiogroup"
                accessibilityLabel="Practice duration"
              >
                {practiceDurations.map((minutes) => (
                  <Choice
                    key={minutes}
                    label={`${minutes} min`}
                    selected={duration === minutes}
                    onPress={() => setDuration(minutes)}
                  />
                ))}
              </View>
              <AppText variant="caption" color={colors.muted}>
                {practicePlan.description}
              </AppText>
              <View
                style={[styles.planPreview, { borderColor: colors.border }]}
              >
                <AppText variant="label" accessibilityRole="header">
                  Your practice plan
                </AppText>
                {practicePlan.steps.map((step, index) => (
                  <Row key={step.title} style={{ gap: 8 }}>
                    <AppText variant="caption" color={colors.sageText}>
                      {index + 1}
                    </AppText>
                    <AppText variant="caption" style={{ flex: 1 }}>
                      {step.title}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {`${Math.floor(step.durationSec / 60)}:${String(step.durationSec % 60).padStart(2, "0")}`}
                    </AppText>
                  </Row>
                ))}
              </View>
              <Button
                title={`Start ${duration}-minute practice`}
                icon="play"
                onPress={() => open({ focus, minutes: duration })}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeading icon="grid-outline" title="More to Explore" />
          <View style={styles.moreCards}>
            {moreCards.map((card) => (
              <Pressable
                key={card.route}
                accessibilityRole="button"
                accessibilityLabel={card.title}
                accessibilityHint={card.detail}
                onPress={() => app.navigate(card.route)}
                style={({ pressed }) => [
                  styles.moreCard,
                  {
                    backgroundColor: colors[`${card.tone}Surface`],
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  name={card.icon}
                  color={colors[`${card.tone}Text`]}
                  size={22}
                />
                <AppText variant="label" style={styles.moreTitle}>
                  {card.title}
                </AppText>
                <AppText
                  variant="caption"
                  color={colors.muted}
                  style={styles.moreDetail}
                >
                  {card.detail}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen }}
            aria-expanded={moreOpen}
            onPress={() => setMoreOpen(!moreOpen)}
            style={({ pressed }) => [
              styles.moreAction,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="label" color={colors.primary}>
              More wellness tools
            </AppText>
            <Icon
              name={moreOpen ? "chevron-up" : "chevron-down"}
              color={colors.primary}
              size={15}
            />
          </Pressable>
          {moreOpen &&
            extraTools.map((item) => (
              <ExploreResult
                key={item.title}
                item={item}
                onPress={() => open(item.destination)}
              />
            ))}
        </View>
      </View>
    </Screen>
  );
}

const overlayInk = "#FFF8F1";
const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  pressed: { opacity: 0.72 },
  hero: {
    minHeight: 174,
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 30,
    overflow: "hidden",
  },
  heroHeader: { justifyContent: "space-between", gap: 2 },
  brand: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  brandName: { fontSize: 14, lineHeight: 19 },
  heroActions: { gap: 0, marginRight: -3 },
  iconTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: "#FFF4F031",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { marginTop: 1 },
  heroTitle: { fontSize: 36, lineHeight: 39 },
  heroSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4, maxWidth: 220 },
  body: { paddingHorizontal: 16, paddingBottom: 3 },
  categoryRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: -12,
    marginBottom: 17,
  },
  category: {
    flex: 1,
    minWidth: 42,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 16,
  },
  categoryLabel: { fontSize: 10, lineHeight: 13, textAlign: "center" },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 45,
    marginBottom: 13,
    borderWidth: 1,
    borderRadius: 13,
  },
  searchInput: {
    flex: 1,
    minHeight: 45,
    paddingVertical: 6,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  feature: { minHeight: 153, borderRadius: 15, overflow: "hidden" },
  featureCopy: {
    alignItems: "flex-start",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  featureBadge: {
    backgroundColor: "#FFF6F232",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  featureBadgeText: { fontSize: 10, lineHeight: 14 },
  featureTitle: { fontSize: 29, lineHeight: 31, marginTop: 3 },
  featureDescription: {
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 190,
    marginTop: 4,
  },
  featureAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    marginTop: 7,
  },
  section: { marginTop: 9 },
  sectionHeading: { minHeight: 33, gap: 8, marginBottom: 5 },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionTitleText: { fontSize: 17, lineHeight: 23 },
  sectionDetail: { fontSize: 11, lineHeight: 16 },
  headingAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 8,
  },
  tiles: { flexDirection: "row", gap: 7 },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 87,
    justifyContent: "flex-end",
    paddingTop: 29,
    paddingHorizontal: 6,
    paddingBottom: 7,
    borderRadius: 13,
    overflow: "hidden",
  },
  tilePlay: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#201C35A0",
  },
  tileLabel: { fontSize: 11, lineHeight: 14 },
  catalog: { paddingBottom: 6 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  builder: { marginTop: 13 },
  builderStrip: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "stretch",
    paddingRight: 7,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  builderPicture: { width: "21%", minHeight: 56, overflow: "hidden" },
  builderStep: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
    minWidth: 0,
    paddingVertical: 5,
  },
  builderStepLabel: { fontSize: 9, lineHeight: 11, textAlign: "center" },
  builderAction: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  builderForm: {
    marginTop: 9,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 9,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  planPreview: {
    paddingTop: 9,
    gap: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  choice: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  moreCards: { flexDirection: "row", alignItems: "stretch", gap: 7 },
  moreCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    paddingTop: 10,
    minHeight: 81,
    gap: 2,
  },
  moreTitle: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  moreDetail: { fontSize: 10, lineHeight: 13 },
  moreAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    marginTop: 7,
  },
});
