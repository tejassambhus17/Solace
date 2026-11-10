import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { DaylightScenicFade } from "../DaylightScenicFade";
import { DaylightScenicScrim, daylightPhotoInk } from "../DaylightScenicScrim";
import { spacing, useScreenGutter } from "../layout";
import { webRadioProps } from "../radio-keyboard";
import { routes } from "../routes";
import {
  createExplorePractice,
  exploreShortcuts,
  practiceDurations,
  type PracticeFocus,
} from "../explore-practices";
import { exploreWellnessTools } from "../wellness-tools";
import {
  wellnessGoalPriority,
  wellnessRecommendations,
} from "../wellness-recommendations";
import type { WellnessGoal } from "../../server/src/wellness-goals";
import { MainTabHeader, useMainTabHeaderInsets } from "../SolaceBrandHeader";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  coverImageStyle,
  Icon,
  IconButton,
  NestedState,
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
type RouteDestination = { route: string; params?: Record<string, unknown> };
type PracticeDestination =
  | RouteDestination
  | { focus: PracticeFocus; minutes: Duration; title?: string };
type ExploreItem = {
  title: string;
  detail: string;
  icon: string;
  categories: readonly Exclude<Category, "all">[];
  destination: PracticeDestination;
};
type CardTone = (typeof exploreShortcuts)[number]["tone"];
type Recommendation = ExploreItem & {
  goal: WellnessGoal;
  destination: RouteDestination;
  tile: {
    meta: string;
    image: ImageSourcePropType;
    tone: CardTone;
    actionIcon?: string;
    topCrop?: boolean;
  };
};

type ExploreView = {
  category: Category;
  searchOpen: boolean;
  query: string;
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
  habits: require("../../assets/today-explore-toolkit.jpg"),
  focus: require("../../assets/today-quick-focus.jpg"),
};

const featured: ExploreItem = {
  title: "Calm Your Mind",
  detail: "A short guided pause to slow down and reset.",
  icon: "sparkles-outline",
  categories: ["breathe"],
  destination: { focus: "breathe", minutes: 5 },
};

function momentDestination(
  focus: PracticeFocus,
  minutes: Duration,
  title?: string,
): RouteDestination {
  const activity = createExplorePractice(focus, minutes);
  return {
    route: routes.momentPlayer,
    params: {
      activity: title ? { ...activity, title } : activity,
      provider: "offline",
      source: "explore",
    },
  };
}

const forYou: Recommendation[] = [
  {
    goal: "calm",
    title: "Breath Reset",
    detail: "Take three minutes to follow a comfortable breathing rhythm.",
    icon: "cloud-outline",
    categories: ["breathe"],
    destination: { route: routes.breathing, params: { durationSec: 180 } },
    tile: {
      meta: "3 min · Breathing",
      image: exploreArt.breathe,
      tone: "lavender",
    },
  },
  {
    goal: "calm",
    title: "Five Senses",
    detail: "A five-minute grounding practice to notice what’s around you.",
    icon: "hand-left-outline",
    categories: ["focus"],
    destination: momentDestination("ground", 5, "Five Senses"),
    tile: {
      meta: "5 min · Grounding",
      image: exploreArt.ground,
      tone: "sage",
    },
  },
  {
    goal: "feelings",
    title: "Quick Reflection",
    detail: "A private place to write down a thought.",
    icon: "pencil-outline",
    categories: ["reflect", "focus"],
    destination: { route: "reflection" },
    tile: {
      meta: "≈4 min · Journaling",
      image: exploreArt.reflect,
      tone: "peach",
      actionIcon: "pencil-outline",
      topCrop: true,
    },
  },
  {
    goal: "sleep",
    title: "Sleep Wind Down",
    detail: "A ten-minute practice to wind down toward rest.",
    icon: "moon-outline",
    categories: ["sleep"],
    destination: momentDestination("rest", 10, "Sleep Wind Down"),
    tile: {
      meta: "10 min · Relaxation",
      image: exploreArt.sleep,
      tone: "lavender",
      topCrop: true,
    },
  },
];
const wellnessExtras: Recommendation[] = [
  {
    goal: "habits",
    title: "Healthy Habit Builder",
    detail: "Plan small habits and see your garden grow.",
    icon: "leaf-outline",
    categories: [],
    destination: { route: routes.habits },
    tile: {
      meta: "Habits & Garden",
      image: exploreArt.habits,
      tone: "sage",
      actionIcon: "chevron-forward",
    },
  },
  {
    goal: "focus",
    title: wellnessRecommendations.focus.title,
    detail: wellnessRecommendations.focus.description,
    icon: "locate-outline",
    categories: ["focus"],
    destination: {
      route: routes.timedPractice,
      params: wellnessRecommendations.focus.params,
    },
    tile: { meta: "5 min · Focus", image: exploreArt.focus, tone: "lavender" },
  },
];

function personalizedRecommendationRows(goals: unknown) {
  const priority = wellnessGoalPriority(goals, new Date());
  const preferred = priority.flatMap(
    (goal) =>
      [...forYou, ...wellnessExtras].find((item) => item.goal === goal) ?? [],
  );
  const items = [
    ...preferred,
    ...forYou.filter((item) => !preferred.includes(item)),
  ];
  return items
    .filter((_, index) => index % 2 === 0)
    .map((_, index) => items.slice(index * 2, index * 2 + 2));
}
const recommendationTitleLine = 24;

const shortcutDescriptions = {
  [routes.guidedPrograms]: "Gentle multi-day plans.",
  toolkit: "Your saved practices.",
  checkin: "Understand how you feel.",
};

export const exploreCardArrivalRoutes = new Set<string>([
  routes.techniques,
  routes.habits,
  routes.wellnessTools,
  routes.timedPractice,
  routes.wellnessPlan,
  ...forYou.map(({ destination }) => destination.route),
  ...exploreShortcuts.map(({ route }) => route),
]);

const guidedTechniques: ExploreItem = {
  title: "Guided techniques",
  detail: "Short practices for stress, grounding, sleep, and focus.",
  icon: "compass-outline",
  categories: ["breathe", "reflect", "sleep", "focus"],
  destination: { route: routes.techniques },
};

const catalog: (ExploreItem & {
  tile?: Recommendation["tile"];
  artwork?: ImageSourcePropType;
  tone?: CardTone;
})[] = [
  featured,
  guidedTechniques,
  ...forYou,
  ...exploreWellnessTools,
  ...exploreShortcuts.map((card): ExploreItem => ({
    title: card.title,
    detail: card.detail,
    icon: card.icon,
    categories: [],
    destination: { route: card.route },
  })),
];

const exploreEntries = [
  {
    title: "Wellness Tools",
    subtitle: "Discover calming sounds, guided exercises, and everyday tools.",
    icon: "leaf-outline",
    tone: "sage",
    route: routes.wellnessTools,
    image: {
      light: require("../../assets/redesign-guided-light.jpg"),
      dark: require("../../assets/redesign-guided-dark.jpg"),
    },
  },
  {
    title: "Build a Timed Practice",
    subtitle: "Choose your focus and duration for a guided session.",
    icon: "timer-outline",
    tone: "lavender",
    route: routes.timedPractice,
    image: {
      light: exploreArt.breathe,
      dark: require("../../assets/today-twilight-stones.jpg"),
    },
  },
] as const;

function DecorativeImage({
  source,
  topCrop = false,
  scene = false,
}: {
  source: ImageSourcePropType;
  topCrop?: boolean;
  scene?: boolean;
}) {
  const { resolved } = useTheme();
  return (
    <Image
      source={source}
      style={
        topCrop
          ? [
              styles.recommendationTopImage,
              resolved === "light" && styles.daylightTopCrop,
            ]
          : coverImageStyle
      }
      resizeMode="cover"
      resizeMethod={resolved === "light" && scene ? "scale" : "resize"}
      fadeDuration={0}
      pointerEvents="none"
      accessible={false}
      accessibilityIgnoresInvertColors
    />
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

function WellnessFeatureCard({
  title,
  subtitle,
  icon,
  image,
  tone,
  compact,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  image: ImageSourcePropType;
  tone: "lavender" | "sage";
  compact: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tint =
    tone === "lavender" ? colors.lavenderSurface : colors.sageSurface;
  const ink = tone === "lavender" ? colors.lavenderText : colors.sageText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wellnessCard,
        compact && styles.wellnessCardCompact,
        {
          backgroundColor: pressed ? tint : colors.surface,
          borderColor: pressed ? ink : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.wellnessArt,
          compact && styles.wellnessArtCompact,
          { backgroundColor: tint },
        ]}
      >
        <DecorativeImage source={image} />
        <View style={[styles.wellnessIcon, { backgroundColor: tint }]}>
          <Icon name={icon} size={15} color={ink} />
        </View>
      </View>
      <View style={styles.wellnessCopy}>
        <AppText
          variant="heading"
          style={[styles.wellnessTitle, compact && styles.wellnessTitleCompact]}
        >
          {title}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {subtitle}
        </AppText>
      </View>
      <Icon name="chevron-forward" size={17} color={ink} />
    </Pressable>
  );
}

function RecommendationCard({
  item,
  stacked,
  titleMinHeight,
  onPress,
}: {
  item: Pick<Recommendation, "title" | "icon" | "tile">;
  stacked: boolean;
  titleMinHeight: number;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const { meta, image, tone, actionIcon = "play" } = item.tile;
  const tint = colors[`${tone}Surface`];
  const ink = colors[`${tone}Text`];
  const action = (
    <View
      style={[
        styles.recommendationAction,
        !stacked && styles.recommendationPictureAction,
        { backgroundColor: tint },
      ]}
    >
      <Icon name={actionIcon} size={13} color={ink} />
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={meta.replace("≈", "About ")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recommendationCard,
        stacked ? styles.recommendationListCard : styles.recommendationGridCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.recommendationPicture,
          resolved === "light" && !stacked && styles.daylightRecommendationArt,
          stacked && styles.recommendationThumb,
          { backgroundColor: tint },
        ]}
      >
        <Icon name={item.icon} size={20} color={ink} />
        <DecorativeImage
          source={image}
          topCrop={!stacked && item.tile.topCrop}
          scene={!stacked}
        />
        {!stacked && action}
      </View>
      <View
        style={
          stacked
            ? styles.recommendationListCopy
            : styles.recommendationGridCopy
        }
      >
        <AppText
          variant="heading"
          style={[
            styles.recommendationTitle,
            !stacked && { minHeight: titleMinHeight },
          ]}
        >
          {item.title}
        </AppText>
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.recommendationMeta}
        >
          {meta}
        </AppText>
      </View>
      {stacked && action}
    </Pressable>
  );
}

function ExploreDestinationCard({
  shortcut,
  onPress,
}: {
  shortcut: (typeof exploreShortcuts)[number];
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { icon, route, tone } = shortcut;
  const title = route === "checkin" ? "Reflective Check-ins" : shortcut.title;
  const detail = shortcutDescriptions[route];
  const tint = colors[`${tone}Surface`];
  const ink = colors[`${tone}Text`];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destinationCard,
        {
          backgroundColor: pressed ? tint : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.destinationIcon, { backgroundColor: tint }]}>
        <Icon name={icon} color={ink} size={20} />
      </View>
      <View style={styles.wellnessCopy}>
        <AppText variant="heading" style={styles.destinationTitle}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {detail}
        </AppText>
      </View>
      <Icon name="chevron-forward" color={ink} size={17} />
    </Pressable>
  );
}

function DaylightExploreEntry({
  title,
  subtitle,
  icon,
  image,
  tone,
  stacked,
  plan,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  image: ImageSourcePropType;
  tone: "lavender" | "sage";
  stacked: boolean;
  plan?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tint = colors[`${tone}Surface`];
  const ink = colors[`${tone}Text`];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={plan ? "Opens your editable three-day plan" : subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        styles.daylightEntry,
        plan && styles.daylightPlan,
        stacked && styles.daylightEntryStack,
        {
          backgroundColor: colors.surface,
          borderColor: pressed ? ink : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.daylightEntryCopy}>
        <View style={styles.daylightEntryTools}>
          <Icon name={icon} color={ink} size={22} />
          <View style={[styles.planAction, { backgroundColor: tint }]}>
            <Icon name="arrow-forward" size={17} color={ink} />
          </View>
        </View>
        <AppText variant="heading" style={styles.daylightEntryTitle}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {subtitle}
        </AppText>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.daylightEntryArt,
          stacked && styles.daylightEntryArtStack,
          { backgroundColor: tint },
        ]}
      >
        <DecorativeImage source={image} scene />
      </View>
    </Pressable>
  );
}

function ExploreEntryCard({
  entry,
  stacked,
  onPress,
}: {
  entry: (typeof exploreEntries)[number];
  stacked: boolean;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const tint = colors[`${entry.tone}Surface`];
  const ink = colors[`${entry.tone}Text`];
  if (resolved === "light") {
    return (
      <DaylightExploreEntry
        title={entry.title}
        subtitle={entry.subtitle}
        icon={entry.icon}
        image={entry.image.light}
        tone={entry.tone}
        stacked={stacked}
        onPress={onPress}
      />
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      accessibilityHint={entry.subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        styles.featureEntry,
        {
          backgroundColor: colors.surface,
          borderColor: pressed ? ink : colors.border,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.featureEntryArt}>
        <DecorativeImage source={entry.image.dark} scene />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(90deg, ${colors.surface} 0%, ${colors.surface}EE 24%, ${colors.surface}68 72%, ${colors.surface}00 100%)`,
            },
          ]}
        />
      </View>
      <View style={styles.featureEntryCopy}>
        <Icon name={entry.icon} color={ink} size={22} />
        <AppText variant="heading" style={styles.featureEntryTitle}>
          {entry.title}
        </AppText>
        <AppText variant="caption" color={colors.text}>
          {entry.subtitle}
        </AppText>
      </View>
      <View style={[styles.featureEntryArrow, { backgroundColor: tint }]}>
        <Icon name="arrow-forward" size={18} color={ink} />
      </View>
    </Pressable>
  );
}

export function ExploreScreen() {
  const { routeKey } = useApp();
  return <ExploreContent key={routeKey} />;
}

function ExploreContent() {
  const app = useApp();
  const recommendationRows = personalizedRecommendationRows(
    app.user?.wellnessGoals,
  );
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const scenicTitle = dark ? overlayInk : daylightPhotoInk.title;
  const scenicDetail = dark ? overlayInk : daylightPhotoInk.detail;
  const headerInsets = useMainTabHeaderInsets();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const [bodyWidth, setBodyWidth] = useState(width);
  const availableWidth = bodyWidth - gutter * 2;
  const singleColumn = availableWidth < 320 || fontScale > 1.2;
  const stackDaylightEntries = availableWidth < 280 || fontScale > 1.2;
  const stackRecommendations = availableWidth < 320 || fontScale > 1.15;
  const recommendationTitleHeight = Math.ceil(
    (availableWidth < 360 * fontScale ? 2 : 1) *
      recommendationTitleLine *
      fontScale,
  );
  const restored = app.params?.exploreView as ExploreView | undefined;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const categoryRail = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef({ x: restored?.x ?? 0, y: restored?.y ?? 0 });
  const restoreOffsets = useRef({ ...offsets.current });
  const [category, setCategory] = useState(restored?.category ?? "all");
  const [searchOpen, setSearchOpen] = useState(restored?.searchOpen ?? false);
  const [focusSearch, setFocusSearch] = useState(false);
  const [query, setQuery] = useState(restored?.query ?? "");
  const [initialView] = useState(() => ({
    category,
    searchOpen,
    query,
    ...offsets.current,
  }));
  const libraryState = useRef<Omit<ExploreView, "x" | "y">>(null);
  const saveLibraryParams = useRef(app.setParams).current;
  useLayoutEffect(() => {
    libraryState.current = {
      category,
      searchOpen,
      query,
    };
  }, [category, searchOpen, query]);
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
  const results = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return catalog.filter((item) => {
      const text = `${item.title} ${item.detail}`.toLowerCase();
      return (
        (category === "all" || item.categories.includes(category)) &&
        terms.every((term) => text.includes(term))
      );
    });
  }, [category, query]);
  const searching = searchOpen && !!query.trim();
  const showCatalog = searching || category !== "all";
  const categoryLabel = categories.find((item) => item.id === category)?.label;
  function open(destination: PracticeDestination) {
    const target =
      "route" in destination
        ? destination
        : momentDestination(
            destination.focus,
            destination.minutes,
            destination.title,
          );
    app.navigate(target.route, target.params);
  }
  function toggleSearch() {
    if (searchOpen) {
      setQuery("");
    } else {
      setCategory("all");
    }
    setFocusSearch(!searchOpen);
    setSearchOpen(!searchOpen);
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
          headerInsets,
          { backgroundColor: dark ? "#191528" : "#40314F" },
        ]}
      >
        <DecorativeImage
          source={dark ? exploreArt.sceneDark : exploreArt.sceneLight}
          scene
        />
        {dark ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, legacyHeroScrim]}
          />
        ) : (
          <DaylightScenicScrim coverage={38} />
        )}
        {dark ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundImage: `linear-gradient(180deg, ${colors.bg}00 67%, ${colors.bg} 100%)`,
              },
            ]}
          />
        ) : (
          <DaylightScenicFade color={colors.bg} height={22} />
        )}
        <MainTabHeader color={scenicTitle}>
          <IconButton
            name={searchOpen ? "close" : "search-outline"}
            label={searchOpen ? "Close practice search" : "Search practices"}
            onPress={toggleSearch}
            expanded={searchOpen}
            appearance="artwork"
            size={48}
          />
          <IconButton
            name="bookmark-outline"
            label="Open saved wellness toolkit"
            onPress={() => open({ route: "toolkit" })}
            appearance="artwork"
            size={48}
          />
        </MainTabHeader>
        <View style={styles.heroCopy}>
          <AppText
            variant="title"
            accessibilityRole="header"
            color={scenicTitle}
            style={styles.heroTitle}
          >
            Explore
          </AppText>
          <AppText
            variant="heading"
            color={scenicDetail}
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
                {...webRadioProps(selected)}
                accessibilityLabel={item.label}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => {
                  setCategory(item.id);
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
                          ? colors.lavenderAction
                          : colors.tabActiveSurface
                        : dark
                          ? "#18151EDD"
                          : colors.surface,
                      borderColor: selected
                        ? dark
                          ? colors.lavender
                          : colors.tabActiveText
                        : dark
                          ? "#514456"
                          : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name={
                      selected ? "checkmark" : (item.icon ?? "apps-outline")
                    }
                    color={
                      selected
                        ? dark
                          ? "#24172F"
                          : colors.tabActiveText
                        : colors.text
                    }
                    size={15}
                  />
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
            />
            {results.length > 0 && (
              <AppText
                variant="caption"
                accessibilityLiveRegion="polite"
                color={colors.muted}
              >
                {`${results.length} ${results.length === 1 ? "result" : "results"}`}
              </AppText>
            )}
            <View style={styles.catalogCards}>
              {results.length === 0 && (
                <NestedState
                  icon="search-outline"
                  title="No practices found"
                  description="Try a different search or choose All to explore more practices."
                />
              )}
              {results.map((item) => (
                <RecommendationCard
                  key={item.title}
                  item={{
                    title: item.title,
                    icon: item.icon,
                    tile: item.tile ?? {
                      meta: item.detail,
                      image:
                        item.artwork ??
                        (item === featured
                          ? exploreArt.breathe
                          : exploreArt.plan),
                      tone: item.tone ?? "sage",
                      actionIcon: "chevron-forward",
                    },
                  }}
                  stacked
                  titleMinHeight={0}
                  onPress={() => open(item.destination)}
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.feature,
                {
                  backgroundColor: dark ? "#2B263D" : "#493451",
                  borderColor: dark ? "#63546C" : colors.border,
                },
              ]}
            >
              <DecorativeImage
                source={dark ? exploreArt.featureDark : exploreArt.featureLight}
                scene
              />
              {dark ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, legacyFeatureScrim]}
                />
              ) : (
                <DaylightScenicScrim
                  coverage={singleColumn ? 70 : 65}
                  fadeThrough={91}
                />
              )}
              <View style={styles.featureCopy}>
                <Row
                  style={[
                    styles.featureBadge,
                    !dark && styles.daylightFeatureBadge,
                  ]}
                >
                  <Icon
                    name="sparkles-outline"
                    color={dark ? "#F5D4A0" : daylightPhotoInk.detail}
                    size={13}
                  />
                  <AppText
                    variant="caption"
                    color={scenicTitle}
                    style={styles.featureBadgeText}
                  >
                    FEATURED MOMENT · 5 MIN
                  </AppText>
                </Row>
                <AppText
                  variant="title"
                  color={scenicTitle}
                  accessibilityRole="header"
                  style={styles.featureTitle}
                >
                  {featured.title}
                </AppText>
                <AppText
                  variant="body"
                  color={scenicDetail}
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
                    { backgroundColor: colors.lavenderAction },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name="play"
                    size={15}
                    color={colors.lavenderActionText}
                  />
                  <AppText
                    variant={dark ? "heading" : "label"}
                    color={colors.lavenderActionText}
                    style={styles.featureActionLabel}
                  >
                    Start Moment
                  </AppText>
                  <Icon
                    name="arrow-forward"
                    size={15}
                    color={colors.lavenderActionText}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading
                icon="flower-outline"
                title="Your wellness tools"
              />
              <View style={styles.wellnessCards}>
                <WellnessFeatureCard
                  title="Guided Techniques"
                  subtitle="Breathe, ground, and reset."
                  icon={guidedTechniques.icon}
                  image={exploreArt.breathe}
                  tone="lavender"
                  compact={availableWidth < 320}
                  onPress={() => open(guidedTechniques.destination)}
                />
                <WellnessFeatureCard
                  title="Healthy Habit Builder"
                  subtitle="Small habits, lasting growth."
                  icon="leaf-outline"
                  image={exploreArt.habits}
                  tone="sage"
                  compact={availableWidth < 320}
                  onPress={() => open({ route: routes.habits })}
                />
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading icon="leaf-outline" title="Recommended for You" />
              <View style={styles.cardStack}>
                {recommendationRows.map((row) => (
                  <View
                    key={row[0].title}
                    style={[
                      styles.recommendationRow,
                      stackRecommendations && styles.recommendationStack,
                    ]}
                  >
                    {row.map((item) => (
                      <RecommendationCard
                        key={item.title}
                        item={item}
                        stacked={stackRecommendations}
                        titleMinHeight={recommendationTitleHeight}
                        onPress={() => open(item.destination)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
            {dark ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create Your Wellness Plan"
                accessibilityHint="Opens your editable three-day plan"
                onPress={() => open({ route: routes.wellnessPlan })}
                style={({ pressed }) => [
                  styles.planBanner,
                  pressed && styles.pressed,
                ]}
              >
                <View pointerEvents="none" style={styles.planPicture}>
                  <DecorativeImage source={exploreArt.plan} scene />
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
                <View
                  style={[
                    styles.planAction,
                    { backgroundColor: colors.lavenderAction },
                  ]}
                >
                  <Icon
                    name="arrow-forward"
                    color={colors.lavenderActionText}
                    size={18}
                  />
                </View>
              </Pressable>
            ) : (
              <DaylightExploreEntry
                title="Create Your Wellness Plan"
                subtitle="Choose a goal and build a three-day routine."
                icon="calendar-outline"
                tone="lavender"
                image={exploreArt.featureLight}
                stacked={stackDaylightEntries}
                onPress={() => open({ route: routes.wellnessPlan })}
                plan
              />
            )}

            <View style={styles.section}>
              <SectionHeading icon="grid-outline" title="Explore More" />
              <View style={styles.cardStack}>
                {exploreShortcuts.map((shortcut) => (
                  <ExploreDestinationCard
                    key={shortcut.route}
                    shortcut={shortcut}
                    onPress={() =>
                      open({
                        route:
                          shortcut.route === "checkin"
                            ? "assessments"
                            : shortcut.route,
                      })
                    }
                  />
                ))}
              </View>
              <View style={styles.featureEntries}>
                {exploreEntries.map((entry) => (
                  <ExploreEntryCard
                    key={entry.route}
                    entry={entry}
                    stacked={stackDaylightEntries}
                    onPress={() => open({ route: entry.route })}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const overlayInk = "#FFF8F1";
const legacyHeroScrim = {
  backgroundImage:
    "linear-gradient(90deg, #11101BCD 0%, #17132350 49%, #18132600 80%)",
} as const;
const legacyFeatureScrim = {
  backgroundImage:
    "linear-gradient(90deg, #17131FE6 0%, #211A2A9C 43%, #302B4200 81%)",
} as const;
const android = Platform.OS === "android";
const sectionGap = android ? 18 : spacing.section;
const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  pressed: { opacity: 0.72 },
  hero: {
    paddingBottom: sectionGap,
    overflow: "hidden",
  },
  heroCopy: { paddingTop: spacing.compact },
  heroTitle: { fontSize: 43, lineHeight: 45 },
  heroSubtitle: {
    fontSize: android ? 16 : 17,
    lineHeight: 22,
    marginTop: 4,
    maxWidth: "78%",
  },
  categoryViewport: {
    marginTop: -spacing.compact,
    marginBottom: android ? spacing.row : spacing.card,
    flexGrow: 0,
  },
  categoryRail: { gap: android ? 5 : spacing.compact },
  category: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
  },
  categoryPill: {
    alignSelf: "stretch",
    minHeight: android ? 34 : 40,
    justifyContent: "center",
    paddingHorizontal: android ? 8 : 12,
    paddingVertical: android ? 4 : 7,
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
    minHeight: 48,
    marginBottom: 13,
    borderWidth: 1,
    borderRadius: 13,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 6,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  feature: {
    minHeight: android ? 160 : 184,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
  },
  featureCopy: {
    alignItems: "flex-start",
    justifyContent: "center",
    flex: 1,
    paddingVertical: android ? 10 : spacing.card,
    paddingHorizontal: spacing.card,
  },
  featureBadge: {
    backgroundColor: "#FFF6F232",
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  daylightFeatureBadge: { backgroundColor: "#261A34AD" },
  featureBadgeText: { fontSize: 11, lineHeight: 16, flexShrink: 1 },
  featureTitle: {
    alignSelf: "stretch",
    fontSize: android ? 30 : 32,
    lineHeight: 36,
    marginTop: 5,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: android ? "72%" : "64%",
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
    marginTop: android ? spacing.compact : spacing.row,
  },
  featureActionLabel: { fontSize: 16, lineHeight: 21, flexShrink: 1 },
  section: { marginTop: sectionGap },
  sectionHeading: {
    minHeight: 32,
    gap: spacing.compact,
    marginBottom: spacing.compact,
  },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionTitleText: { fontSize: android ? 21 : 23, lineHeight: 28 },
  wellnessCards: { gap: spacing.row },
  wellnessCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    padding: spacing.row,
    borderRadius: 15,
    borderWidth: 1,
  },
  wellnessCardCompact: {
    gap: spacing.compact,
    paddingHorizontal: spacing.compact,
  },
  wellnessArt: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
  },
  wellnessArtCompact: { width: 48, height: 48 },
  wellnessIcon: {
    position: "absolute",
    bottom: 3,
    left: 3,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  wellnessCopy: { flex: 1, minWidth: 0, gap: 2 },
  wellnessTitle: { fontSize: 21, lineHeight: 26 },
  wellnessTitleCompact: { fontSize: 20, lineHeight: 25 },
  headingAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 8,
  },
  cardStack: { gap: spacing.row },
  recommendationRow: { flexDirection: "row", gap: spacing.row },
  recommendationStack: { flexDirection: "column" },
  recommendationCard: {
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  recommendationGridCard: { flex: 1, minWidth: 0 },
  recommendationListCard: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    padding: spacing.compact,
  },
  recommendationPicture: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  daylightRecommendationArt: { height: 84 },
  recommendationThumb: { width: 56, borderRadius: 10 },
  recommendationTopImage: {
    position: "absolute",
    top: -8,
    left: 0,
    width: "100%",
    height: "auto",
    aspectRatio: 1,
  },
  daylightTopCrop: { top: 0 },
  recommendationGridCopy: {
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
  },
  recommendationListCopy: { flex: 1, minWidth: 0, paddingVertical: 2 },
  recommendationAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationPictureAction: { position: "absolute", top: 6, right: 6 },
  recommendationTitle: { fontSize: 20, lineHeight: recommendationTitleLine },
  recommendationMeta: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  daylightEntry: {
    flexDirection: "row",
    alignItems: "stretch",
    minWidth: 0,
    minHeight: 132,
    gap: spacing.row,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.compact,
  },
  daylightPlan: { marginTop: sectionGap },
  daylightEntryStack: { flexDirection: "column" },
  daylightEntryCopy: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.compact,
    paddingVertical: 4,
  },
  daylightEntryTools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  daylightEntryTitle: { fontSize: 23, lineHeight: 27 },
  daylightEntryArt: {
    width: "38%",
    flexShrink: 0,
    borderRadius: 11,
    overflow: "hidden",
  },
  daylightEntryArtStack: { width: "100%", height: 96 },
  planBanner: {
    marginTop: sectionGap,
    minHeight: android ? 68 : 76,
    flexDirection: "row",
    alignItems: "center",
    gap: android ? spacing.compact : spacing.row,
    paddingHorizontal: spacing.row,
    paddingVertical: android ? spacing.compact : spacing.row,
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
  planTitle: { fontSize: android ? 20 : 22, lineHeight: 26 },
  planAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  catalog: { paddingBottom: 6 },
  catalogCards: { marginTop: spacing.row, gap: spacing.row },
  featureEntries: { gap: spacing.card, marginTop: spacing.card },
  featureEntry: {
    minHeight: 140,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.row,
    borderWidth: 1,
    borderRadius: 17,
    overflow: "hidden",
    padding: spacing.card,
  },
  featureEntryArt: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "60%",
  },
  featureEntryCopy: { flex: 1, minWidth: 0, gap: 4 },
  featureEntryTitle: { fontSize: 24, lineHeight: 29 },
  featureEntryArrow: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationCard: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  destinationIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationTitle: { fontSize: 20, lineHeight: 24 },
});
