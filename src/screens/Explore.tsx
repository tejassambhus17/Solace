import React, { useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  createExplorePractice,
  exploreShortcuts,
  practiceDurations,
  practiceFocuses,
  type PracticeFocus,
} from "../explore-practices";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Button,
  coverImageStyle,
  Icon,
  LotusMark,
  Row,
  Screen,
} from "../ui";

const categories = [
  { id: "all", label: "All", icon: null },
  { id: "breathe", label: "Breathe", icon: "leaf-outline" },
  { id: "reflect", label: "Reflect", icon: "pencil-outline" },
  { id: "sleep", label: "Sleep", icon: "moon-outline" },
  { id: "focus", label: "Focus", icon: "locate-outline" },
  { id: "move", label: "Move", icon: "body-outline" },
] as const;

type Category = (typeof categories)[number]["id"];
type Duration = (typeof practiceDurations)[number];
type PracticeDestination =
  | { route: string; params?: Record<string, string | number> }
  | { focus: PracticeFocus; minutes: Duration; title?: string };
type ExploreItem = {
  title: string;
  detail: string;
  icon: string;
  categories: Exclude<Category, "all">[];
  destination: PracticeDestination;
};
type FeaturedTile = ExploreItem & {
  tile: {
    meta: string;
    image: ImageSourcePropType;
    base: string;
    actionIcon?: string;
  };
};

type ExploreView = {
  category: Category;
  searchOpen: boolean;
  query: string;
  showAll: boolean;
  builderOpen: boolean;
  moreOpen: boolean;
  focus: PracticeFocus;
  duration: Duration;
  x: number;
  y: number;
};

const exploreArt = {
  sceneLight: require("../../assets/redesign-explore-scene-light.jpg"),
  sceneDark: require("../../assets/today-twilight-lotus.jpg"),
  featureLight: require("../../assets/redesign-explore-feature-light.jpg"),
  featureDark: require("../../assets/redesign-explore-feature-dark.jpg"),
  breathe: require("../../assets/redesign-explore-breathe.jpg"),
  ground: require("../../assets/redesign-explore-ground.jpg"),
  reflect: require("../../assets/redesign-explore-reflect.jpg"),
  sleep: require("../../assets/redesign-explore-sleep.jpg"),
  plan: require("../../assets/today-explore-guided.jpg"),
};

const featured: ExploreItem = {
  title: "Calm Your Mind",
  detail: "A short guided pause to slow down and reset.",
  icon: "sparkles-outline",
  categories: ["breathe"],
  destination: { focus: "breathe", minutes: 5 },
};

const forYou: FeaturedTile[] = [
  {
    title: "Breath Reset",
    detail: "Take three minutes to follow a comfortable breathing rhythm.",
    icon: "cloud-outline",
    categories: ["breathe"],
    destination: { route: "breathing", params: { durationSec: 180 } },
    tile: {
      meta: "3 min · Breathing",
      image: exploreArt.breathe,
      base: "#231C2A",
    },
  },
  {
    title: "Five Senses",
    detail: "A five-minute grounding practice to notice what’s around you.",
    icon: "hand-left-outline",
    categories: ["focus"],
    destination: { focus: "ground", minutes: 5, title: "Five Senses" },
    tile: {
      meta: "5 min · Grounding",
      image: exploreArt.ground,
      base: "#202420",
    },
  },
  {
    title: "Quick Reflection",
    detail: "A private place to write down a thought.",
    icon: "pencil-outline",
    categories: ["reflect", "focus"],
    destination: { route: "reflection" },
    tile: {
      meta: "≈4 min · Journaling",
      image: exploreArt.reflect,
      base: "#2C212C",
      actionIcon: "pencil-outline",
    },
  },
  {
    title: "Sleep Wind Down",
    detail: "A ten-minute practice to wind down toward rest.",
    icon: "moon-outline",
    categories: ["sleep"],
    destination: { focus: "rest", minutes: 10, title: "Sleep Wind Down" },
    tile: {
      meta: "10 min · Relaxation",
      image: exploreArt.sleep,
      base: "#201B32",
    },
  },
];

const extraTools: ExploreItem[] = [
  {
    title: "Solace Moments",
    detail: "Choose a guided activity for how you feel.",
    icon: "sparkles-outline",
    categories: ["breathe", "reflect", "focus"],
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
    categories: ["focus"],
    destination: { route: "resources" },
  },
  {
    title: "Sleep Wind-Down Guide",
    detail: "Four gentle steps to try at your own pace.",
    icon: "moon-outline",
    categories: ["sleep"],
    destination: { route: "sleep" },
  },
  {
    title: "Five-Senses Exercise",
    detail: "Go one sense at a time without a timer.",
    icon: "hand-left-outline",
    categories: ["focus"],
    destination: { route: "grounding" },
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
    categories: ["reflect"],
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
  ...exploreShortcuts.map((card): ExploreItem => ({
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
      style={coverImageStyle}
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
  action,
}: {
  icon: string;
  title: string;
  action?: { label: string; onPress: () => void; expanded?: boolean };
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.sectionHeading}>
      <Icon name={icon} color={colors.text} size={21} />
      <View style={styles.sectionTitle}>
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.sectionTitleText}
        >
          {title}
        </AppText>
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
  const { top } = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 350 || fontScale > 1.2;
  const restored = app.params?.exploreView as ExploreView | undefined;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const categoryRail = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef({ x: restored?.x ?? 0, y: restored?.y ?? 0 });
  const restoreOffsets = useRef({ ...offsets.current });
  const [category, setCategory] = useState(restored?.category ?? "all");
  const [searchOpen, setSearchOpen] = useState(restored?.searchOpen ?? false);
  const [focusSearch, setFocusSearch] = useState(false);
  const [query, setQuery] = useState(restored?.query ?? "");
  const [showAll, setShowAll] = useState(restored?.showAll ?? false);
  const [builderOpen, setBuilderOpen] = useState(
    restored?.builderOpen ?? false,
  );
  const [moreOpen, setMoreOpen] = useState(restored?.moreOpen ?? false);
  const [focus, setFocus] = useState(restored?.focus ?? "breathe");
  const [duration, setDuration] = useState<Duration>(restored?.duration ?? 5);
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
    // Save the view on this stack entry, so leaving Explore discards it.
    const exploreView: ExploreView = {
      category,
      searchOpen,
      query,
      showAll,
      builderOpen,
      moreOpen,
      focus,
      duration,
      ...offsets.current,
    };
    app.setParams({ exploreView });
    if ("route" in destination) {
      app.navigate(destination.route, destination.params);
      return;
    }
    const activity = createExplorePractice(
      destination.focus,
      destination.minutes,
    );
    app.navigate("moment-player", {
      activity: destination.title
        ? { ...activity, title: destination.title }
        : activity,
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
    setFocusSearch(!searchOpen);
    setSearchOpen(!searchOpen);
  }
  return (
    <Screen
      edgeToEdgeTop
      scrollRef={scroll}
      onScroll={(event) => {
        offsets.current.y = Math.max(0, event.nativeEvent.contentOffset.y);
      }}
      onContentSizeChange={() => {
        const y = restoreOffsets.current.y;
        if (y > 0) {
          scroll.current?.scrollTo({ y, animated: false });
          restoreOffsets.current.y = 0;
        }
      }}
      style={styles.screen}
    >
      <StatusBar style="light" />
      <View
        style={[
          styles.hero,
          {
            paddingTop: top + 3,
            backgroundColor: dark ? "#191528" : "#545071",
          },
        ]}
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
                "linear-gradient(90deg, #11101BCD 0%, #17132350 49%, #18132600 80%)",
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(180deg, ${colors.bg}00 67%, ${colors.bg} 100%)`,
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
              variant="heading"
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
              onPress={() => open({ route: "toolkit" })}
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
          <AppText
            variant="heading"
            color={overlayInk}
            style={styles.heroSubtitle}
          >
            What would help you today?
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView
          ref={categoryRail}
          horizontal
          style={styles.categoryViewport}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(event) => {
            offsets.current.x = Math.max(0, event.nativeEvent.contentOffset.x);
          }}
          onContentSizeChange={() => {
            const x = restoreOffsets.current.x;
            if (x > 0) {
              categoryRail.current?.scrollTo({ x, animated: false });
              restoreOffsets.current.x = 0;
            }
          }}
          contentContainerStyle={styles.categoryRail}
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
                  pressed && styles.pressed,
                ]}
              >
                <Row
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: selected
                        ? dark
                          ? "#D6B7F0"
                          : colors.lavenderSurface
                        : dark
                          ? "#18151EDD"
                          : colors.surface,
                      borderColor: selected
                        ? colors.lavender
                        : dark
                          ? "#514456"
                          : colors.border,
                    },
                  ]}
                >
                  {item.icon && (
                    <Icon
                      name={item.icon}
                      color={selected && dark ? "#24172F" : colors.text}
                      size={15}
                    />
                  )}
                  <AppText
                    variant="heading"
                    color={
                      selected
                        ? dark
                          ? "#24172F"
                          : colors.lavenderText
                        : colors.text
                    }
                    style={styles.categoryLabel}
                  >
                    {item.label}
                  </AppText>
                </Row>
              </Pressable>
            );
          })}
        </ScrollView>

        {searchOpen && (
          <View
            style={[
              styles.searchField,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Icon name="search-outline" color={colors.muted} size={19} />
            <TextInput
              autoFocus={focusSearch}
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
                {
                  backgroundColor: dark ? "#2B263D" : "#5C4D68",
                  borderColor: dark ? "#63546C" : "#DED0DC",
                },
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
                      "linear-gradient(90deg, #17131FE6 0%, #211A2A9C 43%, #302B4200 81%)",
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
                    FEATURED MOMENT · 5 MIN
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
                <AppText
                  variant="heading"
                  color={overlayInk}
                  style={styles.featureDescription}
                >
                  {featured.detail}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start Moment, Calm Your Mind, 5 minutes"
                  onPress={() => open(featured.destination)}
                  style={({ pressed }) => [
                    styles.featureAction,
                    { backgroundColor: "#FFDBB9" },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="play" size={15} color="#2B1E28" />
                  <AppText
                    variant="heading"
                    color="#2B1E28"
                    style={styles.featureActionLabel}
                  >
                    Start Moment
                  </AppText>
                  <Icon name="arrow-forward" size={15} color="#2B1E28" />
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading icon="leaf-outline" title="Recommended for You" />
              <View style={styles.tiles}>
                {forYou.map((item) => (
                  <Pressable
                    key={item.title}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    accessibilityHint={item.tile.meta.replace("≈", "About ")}
                    onPress={() => open(item.destination)}
                    style={({ pressed }) => [
                      styles.tile,
                      singleColumn && styles.fullTile,
                      {
                        backgroundColor: item.tile.base,
                        borderColor: dark ? "#514256" : "#6B596D",
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.tilePicture} pointerEvents="none">
                      <DecorativeImage source={item.tile.image} />
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundImage: `linear-gradient(90deg, ${item.tile.base}00 24%, ${item.tile.base} 100%)`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.tileCopy}>
                      <AppText
                        variant="heading"
                        color={overlayInk}
                        style={styles.tileLabel}
                      >
                        {item.title}
                      </AppText>
                      <AppText
                        variant="caption"
                        color="#E9DBEA"
                        style={styles.tileMeta}
                      >
                        {item.tile.meta}
                      </AppText>
                    </View>
                    <View style={styles.tileAction}>
                      <Icon
                        name={item.tile.actionIcon ?? "play"}
                        color={overlayInk}
                        size={11}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create Your Wellness Plan"
          accessibilityHint="Opens your editable three-day plan"
          onPress={() => open({ route: "plan" })}
          style={({ pressed }) => [
            styles.planBanner,
            pressed && styles.pressed,
          ]}
        >
          <View pointerEvents="none" style={styles.planPicture}>
            <DecorativeImage source={exploreArt.plan} />
            <View style={[StyleSheet.absoluteFill, styles.planScrim]} />
          </View>
          <View style={styles.planIcon}>
            <Icon name="calendar-outline" color={overlayInk} size={23} />
          </View>
          <View style={styles.sectionTitle}>
            <AppText
              variant="heading"
              color={overlayInk}
              style={styles.planTitle}
            >
              Create Your Wellness Plan
            </AppText>
            <AppText
              variant="caption"
              color="#E6DAE8"
              style={styles.planDetail}
            >
              Choose a goal and build a gentle daily routine.
            </AppText>
          </View>
          <View style={styles.planAction}>
            <Icon name="arrow-forward" color="#2B1E28" size={18} />
          </View>
        </Pressable>

        <View style={styles.section}>
          <SectionHeading icon="grid-outline" title="Explore More" />
          <View
            style={[styles.moreCards, singleColumn && styles.moreCardsStacked]}
          >
            {exploreShortcuts.map((card) => {
              const tone = moreTones[card.tone];
              const detail = moreDescriptions[card.route];
              return (
                <Pressable
                  key={card.route}
                  accessibilityRole="button"
                  accessibilityLabel={card.title}
                  accessibilityHint={detail}
                  onPress={() => open({ route: card.route })}
                  style={({ pressed }) => [
                    styles.moreCard,
                    singleColumn && styles.fullTile,
                    {
                      backgroundColor: dark
                        ? tone.surface
                        : colors[`${card.tone}Surface`],
                      borderColor: dark ? tone.border : colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={card.icon}
                    color={dark ? tone.ink : colors[`${card.tone}Text`]}
                    size={25}
                  />
                  <AppText variant="heading" style={styles.moreTitle}>
                    {card.title}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={dark ? "#D8CCD8" : colors.muted}
                    style={styles.moreDetail}
                  >
                    {detail}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen }}
            aria-expanded={moreOpen}
            onPress={() => setMoreOpen(!moreOpen)}
            style={({ pressed }) => [
              styles.moreAction,
              styles.moreToolsAction,
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
          {moreOpen && (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCategory("all");
                  setQuery("");
                  setSearchOpen(false);
                  setShowAll(true);
                  scroll.current?.scrollTo({ y: 0 });
                }}
                style={({ pressed }) => [
                  styles.moreAction,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="label" color={colors.primary}>
                  Browse all practices
                </AppText>
                <Icon name="chevron-forward" color={colors.primary} size={15} />
              </Pressable>
              {extraTools.map((item) => (
                <ExploreResult
                  key={item.title}
                  item={item}
                  onPress={() => open(item.destination)}
                />
              ))}
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: builderOpen }}
            aria-expanded={builderOpen}
            onPress={() => setBuilderOpen(!builderOpen)}
            style={({ pressed }) => [
              styles.moreAction,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="label" color={colors.primary}>
              Build a timed practice
            </AppText>
            <Icon
              name={builderOpen ? "chevron-up" : "chevron-down"}
              color={colors.primary}
              size={15}
            />
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
      </View>
    </Screen>
  );
}

const overlayInk = "#FFF8F1";
const moreTones = {
  lavender: { surface: "#252039", border: "#554766", ink: "#DEBBFF" },
  sage: { surface: "#1D2B2A", border: "#435453", ink: "#CBE6DD" },
  peach: { surface: "#33242B", border: "#765259", ink: "#FFD0A6" },
};
const moreDescriptions = {
  plan: "Three days of gentle practice",
  toolkit: "Simple tools for balance and calm",
  checkin: "Track your mood and wellbeing",
};
const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 18 },
  pressed: { opacity: 0.72 },
  hero: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    overflow: "hidden",
  },
  heroHeader: { minHeight: 44, justifyContent: "space-between", gap: 2 },
  brand: {
    minHeight: 44,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brandName: { fontSize: 21, lineHeight: 25 },
  heroActions: { gap: 1, marginRight: -3 },
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
    backgroundColor: "#FFF4F02E",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { paddingLeft: 2 },
  heroTitle: { fontSize: 43, lineHeight: 45 },
  heroSubtitle: { fontSize: 15, lineHeight: 20, marginTop: 2, maxWidth: "75%" },
  body: { paddingHorizontal: 10 },
  categoryViewport: { marginTop: -11, marginBottom: 8, flexGrow: 0 },
  categoryRail: { flexGrow: 1, gap: 4 },
  category: {
    flexGrow: 1,
    minHeight: 44,
    minWidth: 42,
    justifyContent: "center",
  },
  categoryPill: {
    alignSelf: "stretch",
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 4,
    gap: 3,
    borderWidth: 1,
    borderRadius: 16,
  },
  categoryLabel: { fontSize: 12, lineHeight: 15, textAlign: "center" },
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
  feature: {
    minHeight: 142,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
  },
  featureCopy: {
    alignItems: "flex-start",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  featureBadge: {
    backgroundColor: "#FFF6F232",
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 3,
  },
  featureBadgeText: { fontSize: 9.5, lineHeight: 14 },
  featureTitle: {
    alignSelf: "stretch",
    fontSize: 29,
    lineHeight: 32,
    marginTop: 3,
  },
  featureDescription: {
    fontSize: 15,
    lineHeight: 17,
    maxWidth: "55%",
    marginTop: 3,
  },
  featureAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginTop: 4,
  },
  featureActionLabel: { fontSize: 16, lineHeight: 21, flexShrink: 1 },
  section: { marginTop: 10 },
  sectionHeading: {
    minHeight: 33,
    gap: 8,
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionTitleText: { fontSize: 19, lineHeight: 23 },
  headingAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 8,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  fullTile: { flexBasis: "100%" },
  tilePicture: {
    alignSelf: "stretch",
    width: "29%",
  },
  tileCopy: { flex: 1, minWidth: 0, paddingVertical: 5 },
  tileAction: {
    width: 22,
    height: 22,
    marginRight: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5CFE94D",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B7A4C437",
  },
  tileLabel: { fontSize: 13.5, lineHeight: 16 },
  tileMeta: { fontSize: 9.5, lineHeight: 12, marginTop: 2 },
  planBanner: {
    marginTop: 14,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#A48A96",
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#342831",
  },
  planPicture: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "68%",
  },
  planScrim: {
    backgroundImage:
      "linear-gradient(90deg, #342831 0%, #342831BA 37%, #2F24334D 100%)",
  },
  planIcon: {
    width: 37,
    height: 37,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#F5D8F220",
  },
  planTitle: { fontSize: 19, lineHeight: 22 },
  planDetail: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  planAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFDBB9",
    alignItems: "center",
    justifyContent: "center",
  },
  catalog: { paddingBottom: 6 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  moreCards: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  moreCardsStacked: { flexWrap: "wrap" },
  moreCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    paddingTop: 10,
    minHeight: 96,
    gap: 2,
  },
  moreTitle: { fontSize: 14, lineHeight: 17, marginTop: 4 },
  moreDetail: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  moreAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    marginTop: 7,
  },
  moreToolsAction: { marginTop: 32 },
});
