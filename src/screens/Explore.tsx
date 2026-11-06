import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
import { useReducedMotion } from "../Companion";
import { spacing, useScreenGutter } from "../layout";
import { routes } from "../routes";
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

const guidedTechniques: ExploreItem = {
  title: "Guided techniques",
  detail: "Short practices for stress, grounding, sleep, and focus.",
  icon: "compass-outline",
  categories: ["breathe", "reflect", "sleep", "focus"],
  destination: { route: routes.techniques },
};

const extraTools: ExploreItem[] = [
  {
    title: "Ambient Sound Mixer",
    detail: "Layer rain, waves, forest air, and soft wind.",
    icon: "musical-notes-outline",
    categories: ["sleep", "focus"],
    destination: { route: "ambient-mixer" },
  },
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
  guidedTechniques,
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

const browseAll = {
  title: "Browse all practices",
  detail: "See the complete practice library.",
  icon: "list-outline",
};

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
  last,
}: {
  item: Pick<ExploreItem, "title" | "detail" | "icon">;
  onPress: () => void;
  last?: boolean;
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
        last && styles.lastResult,
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

function ExploreDisclosure({
  title,
  description,
  icon,
  expanded,
  onChange,
  reduceMotion,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  expanded: boolean;
  onChange: (value: boolean) => void;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [animating, setAnimating] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animating) return;
    if (reduceMotion) {
      setAnimating(false);
      return;
    }
    if (expanded && !contentHeight) return;
    const transition = Animated.timing(height, {
      toValue: expanded ? contentHeight : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    transition.start(({ finished }) => {
      if (finished) setAnimating(false);
    });
    return () => transition.stop();
  }, [animating, contentHeight, expanded, height, reduceMotion]);

  function toggle() {
    if (!reduceMotion) {
      if (!animating) {
        height.setValue(expanded ? contentHeight : 0);
        if (!expanded) setContentHeight(0);
      }
      setAnimating(true);
    }
    onChange(!expanded);
  }

  return (
    <View
      style={[
        styles.disclosure,
        {
          backgroundColor: colors.surface,
          borderColor: expanded ? colors.lavender : colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={description}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={toggle}
        style={({ pressed }) => [
          styles.disclosureTrigger,
          expanded && { backgroundColor: colors.lavenderSurface },
          pressed && { backgroundColor: colors.surface2 },
        ]}
      >
        <View
          style={[
            styles.disclosureIcon,
            { backgroundColor: colors.lavenderSurface },
          ]}
        >
          <Icon name={icon} color={colors.lavenderText} size={21} />
        </View>
        <View style={styles.disclosureCopy}>
          <AppText variant="heading" style={styles.disclosureTitle}>
            {title}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {description}
          </AppText>
        </View>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          color={colors.muted}
          size={17}
        />
      </Pressable>
      {(expanded || animating) && (
        <Animated.View
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
          aria-hidden={!expanded}
          pointerEvents={expanded ? "auto" : "none"}
          style={animating && { height, overflow: "hidden" }}
        >
          <View
            onLayout={(event) =>
              setContentHeight(event.nativeEvent.layout.height)
            }
            style={[
              styles.disclosureContent,
              { borderTopColor: colors.border },
              animating && styles.disclosureMeasure,
            ]}
          >
            {children}
          </View>
        </Animated.View>
      )}
    </View>
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
      <AppText
        variant="label"
        color={selected ? colors.sageText : colors.text}
        style={styles.choiceLabel}
      >
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
  const gutter = useScreenGutter();
  const reducedMotion = useReducedMotion();
  const [bodyWidth, setBodyWidth] = useState(width);
  const availableWidth = bodyWidth - gutter * 2;
  const singleColumn = availableWidth < 320 || fontScale > 1.2;
  const stackedShortcuts = availableWidth < 330 || fontScale > 1.15;
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
  const [initialView] = useState(() => ({
    category,
    searchOpen,
    query,
    showAll,
    builderOpen,
    moreOpen,
    focus,
    duration,
    ...offsets.current,
  }));
  const libraryState = useRef<Omit<ExploreView, "x" | "y">>(null);
  const saveLibraryParams = useRef(app.setParams).current;
  useLayoutEffect(() => {
    libraryState.current = {
      category,
      searchOpen,
      query,
      showAll,
      builderOpen,
      moreOpen,
      focus,
      duration,
    };
  }, [
    category,
    searchOpen,
    query,
    showAll,
    builderOpen,
    moreOpen,
    focus,
    duration,
  ]);
  useEffect(
    () => () => {
      if (!libraryState.current) return;
      const view = { ...libraryState.current, ...offsets.current };
      if (
        Object.keys(view).some((key) => {
          const field = key as keyof ExploreView;
          return view[field] !== initialView[field];
        })
      ) {
        saveLibraryParams({ exploreView: view });
      }
    },
    [initialView, saveLibraryParams],
  );
  const practicePlan = createExplorePractice(focus, duration);
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
    const activity = createExplorePractice(
      destination.focus,
      destination.minutes,
    );
    app.navigate(routes.momentPlayer, {
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
  function browseCatalog() {
    setCategory("all");
    setQuery("");
    setSearchOpen(false);
    setShowAll(true);
    scroll.current?.scrollTo({ y: 0, animated: !reducedMotion });
  }
  return (
    <Screen
      edgeToEdgeTop
      heroStatusBar="light"
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
      <View
        style={[
          styles.hero,
          {
            paddingHorizontal: gutter,
            paddingTop: top + spacing.compact,
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
          <View style={styles.brand}>
            <LotusMark size={26} />
            <AppText
              variant="heading"
              color={overlayInk}
              style={styles.brandName}
            >
              Solace
            </AppText>
          </View>
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

      <View
        onLayout={(event) => setBodyWidth(event.nativeEvent.layout.width)}
        style={{ paddingHorizontal: gutter }}
      >
        <ScrollView
          ref={categoryRail}
          horizontal
          style={[styles.categoryViewport, { marginHorizontal: -gutter }]}
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
          contentContainerStyle={[
            styles.categoryRail,
            { paddingHorizontal: gutter },
          ]}
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
                    variant="label"
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
                  variant="body"
                  color={overlayInk}
                  style={[
                    styles.featureDescription,
                    singleColumn && styles.narrowFeatureDescription,
                  ]}
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
              <ExploreResult
                item={guidedTechniques}
                onPress={() => open(guidedTechniques.destination)}
              />
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
                <AppText variant="caption" color="#E6DAE8">
                  Choose a goal and build a three-day routine.
                </AppText>
              </View>
              <View style={styles.planAction}>
                <Icon name="arrow-forward" color="#2B1E28" size={18} />
              </View>
            </Pressable>

            <View style={styles.section}>
              <SectionHeading icon="grid-outline" title="Explore More" />
              <View
                style={[
                  styles.moreCards,
                  stackedShortcuts && styles.moreCardsStacked,
                ]}
              >
                {exploreShortcuts.map((card) => {
                  const tone = moreTones[card.tone];
                  const detail = card.detail;
                  return (
                    <Pressable
                      key={card.route}
                      accessibilityRole="button"
                      accessibilityLabel={card.title}
                      accessibilityHint={detail}
                      onPress={() => open({ route: card.route })}
                      style={({ pressed }) => [
                        styles.moreCard,
                        stackedShortcuts && styles.moreCardStacked,
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
                      <View style={stackedShortcuts && styles.sectionTitle}>
                        <AppText variant="heading" style={styles.moreTitle}>
                          {card.title}
                        </AppText>
                        <AppText variant="caption" color={colors.muted}>
                          {detail}
                        </AppText>
                      </View>
                      {stackedShortcuts && (
                        <Icon
                          name="chevron-forward"
                          color={colors.muted}
                          size={15}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.disclosures}>
                <ExploreDisclosure
                  title="More wellness tools"
                  description="Find guided activities, check-ins, and everyday tools."
                  icon="apps-outline"
                  expanded={moreOpen}
                  onChange={setMoreOpen}
                  reduceMotion={reducedMotion}
                >
                  <ExploreResult item={browseAll} onPress={browseCatalog} />
                  {extraTools.map((item, index) => (
                    <ExploreResult
                      key={item.title}
                      item={item}
                      last={index === extraTools.length - 1}
                      onPress={() => open(item.destination)}
                    />
                  ))}
                </ExploreDisclosure>
                <ExploreDisclosure
                  title="Build a timed practice"
                  description="Choose a focus and duration for a single session."
                  icon="timer-outline"
                  expanded={builderOpen}
                  onChange={setBuilderOpen}
                  reduceMotion={reducedMotion}
                >
                  <View style={styles.builderForm}>
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
                      style={[
                        styles.planPreview,
                        { borderColor: colors.border },
                      ]}
                    >
                      <AppText variant="label" accessibilityRole="header">
                        {practicePlan.title}
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
                      title="Start practice"
                      icon="play"
                      onPress={() => open({ focus, minutes: duration })}
                    />
                  </View>
                </ExploreDisclosure>
              </View>
            </View>
          </>
        )}
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
const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  pressed: { opacity: 0.72 },
  hero: {
    paddingBottom: spacing.section,
    overflow: "hidden",
  },
  heroHeader: { minHeight: 44, justifyContent: "space-between", gap: 2 },
  brand: {
    minHeight: 44,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
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
  heroCopy: { paddingTop: spacing.compact },
  heroTitle: { fontSize: 43, lineHeight: 45 },
  heroSubtitle: { fontSize: 17, lineHeight: 22, marginTop: 4, maxWidth: "78%" },
  categoryViewport: {
    marginTop: -spacing.compact,
    marginBottom: spacing.card,
    flexGrow: 0,
  },
  categoryRail: { gap: spacing.compact },
  category: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
  },
  categoryPill: {
    alignSelf: "stretch",
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
  },
  categoryLabel: { fontSize: 13, lineHeight: 18, textAlign: "center" },
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
    minHeight: 184,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
  },
  featureCopy: {
    alignItems: "flex-start",
    justifyContent: "center",
    flex: 1,
    paddingVertical: spacing.card,
    paddingHorizontal: spacing.card,
  },
  featureBadge: {
    backgroundColor: "#FFF6F232",
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  featureBadgeText: { fontSize: 11, lineHeight: 16, flexShrink: 1 },
  featureTitle: {
    alignSelf: "stretch",
    fontSize: 32,
    lineHeight: 36,
    marginTop: 5,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: "64%",
    marginTop: 4,
  },
  narrowFeatureDescription: { maxWidth: "84%" },
  featureAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: spacing.row,
  },
  featureActionLabel: { fontSize: 16, lineHeight: 21, flexShrink: 1 },
  section: { marginTop: spacing.section },
  sectionHeading: {
    minHeight: 32,
    gap: spacing.compact,
    marginBottom: spacing.compact,
  },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionTitleText: { fontSize: 23, lineHeight: 28 },
  headingAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 8,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  fullTile: { flexBasis: "100%" },
  tilePicture: {
    alignSelf: "stretch",
    width: "27%",
    maxWidth: 82,
  },
  tileCopy: { flex: 1, minWidth: 0, paddingVertical: spacing.compact },
  tileAction: {
    width: 25,
    height: 25,
    marginRight: 6,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5CFE94D",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B7A4C437",
  },
  tileLabel: { fontSize: 17, lineHeight: 19 },
  tileMeta: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  planBanner: {
    marginTop: spacing.section,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.row,
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
  planTitle: { fontSize: 22, lineHeight: 26 },
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
    gap: spacing.row,
    minHeight: 60,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastResult: { borderBottomWidth: 0 },
  disclosures: { gap: spacing.row, marginTop: spacing.row },
  disclosure: { borderRadius: 15, borderWidth: 1, overflow: "hidden" },
  disclosureTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    padding: spacing.row,
    minHeight: 70,
  },
  disclosureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disclosureCopy: { flex: 1, minWidth: 0, gap: 2 },
  disclosureTitle: { fontSize: 22, lineHeight: 26 },
  disclosureContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.card,
    paddingVertical: 4,
  },
  disclosureMeasure: { position: "absolute", left: 0, right: 0, top: 0 },
  builderForm: {
    paddingVertical: spacing.row,
    gap: spacing.row,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  planPreview: {
    paddingTop: spacing.row,
    gap: spacing.compact,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  choice: {
    minHeight: 48,
    maxWidth: "100%",
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  choiceLabel: { flexShrink: 1 },
  moreCards: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.compact,
  },
  moreCardsStacked: { flexDirection: "column" },
  moreCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.row,
    minHeight: 120,
    gap: spacing.compact,
  },
  moreCardStacked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    minHeight: 68,
  },
  moreTitle: { fontSize: 19, lineHeight: 22, marginBottom: 2 },
});
