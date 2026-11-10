import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { playHaptic } from "../haptics";
import { useReducedMotion } from "../Companion";
import { localDay } from "../content";
import { DaylightHeroBlend } from "../DaylightScenicFade";
import { DaylightScenicScrim, daylightPhotoInk } from "../DaylightScenicScrim";
import { createExplorePractice, exploreShortcuts } from "../explore-practices";
import { spacing, useScreenGutter } from "../layout";
import { pickDailyRoutine } from "../routine";
import { routes } from "../routes";
import { MainTabHeader, useMainTabHeaderInsets } from "../SolaceBrandHeader";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import { DailyRitualOptions } from "./DailyRitualOptions";
import { getTodayHabitsPreview, TodayHabits } from "./HabitEntryPoints";
import { RecommendationExplanation } from "./RecommendationExplanation";
import { TodayProgressCard } from "./TodayProgressCard";
import {
  AppText,
  coverImageStyle,
  Icon,
  IconButton,
  LotusMark,
  MoodPetal,
  moodPetals,
  Row,
  Screen,
} from "../ui";

const quickActions = [
  {
    title: "Breathe",
    icon: "leaf-outline",
    route: "breathing",
    params: { durationSec: 180 },
    image: require("../../assets/today-quick-breathe.jpg"),
    ink: "#B5F6D4",
  },
  {
    title: "Reflect",
    icon: "pencil-outline",
    route: "reflection",
    params: {},
    image: require("../../assets/today-quick-reflect.jpg"),
    ink: "#E6CAFF",
  },
  {
    title: "Sleep",
    icon: "moon-outline",
    route: "sleep",
    params: {},
    image: require("../../assets/redesign-explore-sleep.jpg"),
    ink: "#DED5FF",
  },
  {
    title: "Focus",
    icon: "locate-outline",
    route: "grounding",
    params: {},
    image: require("../../assets/today-quick-focus.jpg"),
    ink: "#FFE3B1",
  },
] as const;

type MoodChoice = (typeof moodPetals)[number];
const isAndroid = Platform.OS === "android";

function TodayMoodOption({
  choice: { mood, image },
  status,
  wrap,
  compactLight,
  reducedMotion,
  onPress,
}: {
  choice: MoodChoice;
  status?: "saved" | "pending";
  wrap: boolean;
  compactLight: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const selected = status !== undefined;
  const [tint] = useState(() => new Animated.Value(selected ? 1 : 0));
  const previousSelection = useRef(selected);
  const fadeTint = useCallback(
    (toValue: number) => {
      if (reducedMotion) {
        tint.setValue(toValue);
        return;
      }
      Animated.timing(tint, {
        toValue,
        duration: 140,
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }).start();
    },
    [reducedMotion, tint],
  );
  useEffect(() => {
    if (previousSelection.current === selected) tint.setValue(selected ? 1 : 0);
    else fadeTint(selected ? 1 : 0);
    previousSelection.current = selected;
    return () => tint.stopAnimation();
  }, [fadeTint, selected, tint]);

  const selectionNote =
    status === "pending"
      ? ". Your latest mood today, waiting to sync"
      : selected
        ? ". Your last saved mood today"
        : "";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Check in: ${mood}${selectionNote}`}
      accessibilityHint="Opens a check-in with this mood selected"
      accessibilityState={{ selected }}
      onPressIn={() => fadeTint(selected ? 1 : 0.65)}
      onPressOut={() => fadeTint(selected ? 1 : 0)}
      onPress={onPress}
      style={[
        styles.mood,
        isAndroid && styles.androidMood,
        compactLight && isAndroid && styles.lightCompactMood,
        wrap && styles.largeMood,
        {
          backgroundColor: dark ? "#302839" : colors.bg,
          borderColor: selected
            ? dark
              ? "#BE99F2"
              : colors.lavenderText
            : dark
              ? "#45394E"
              : colors.border,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.moodTint,
          {
            backgroundColor: dark ? "#493765" : colors.primary,
            opacity: tint,
          },
        ]}
      />
      <MoodPetal source={image} style={styles.moodPetal} />
      <AppText
        variant={selected ? "label" : "caption"}
        color={selected ? colors.lavenderText : colors.text}
        style={[styles.moodText, isAndroid && styles.androidMoodText]}
      >
        {mood}
      </AppText>
    </Pressable>
  );
}

const exploreArt = {
  [routes.guidedPrograms]: {
    image: require("../../assets/today-explore-guided.jpg"),
    color: "#D9B3FF",
    detail: "Multi-day plans",
  },
  toolkit: {
    image: require("../../assets/today-explore-toolkit.jpg"),
    color: "#B2C7FA",
    detail: "Saved practices",
  },
  checkin: {
    image: require("../../assets/today-explore-checkins.jpg"),
    color: "#FFC782",
    detail: "Track your mood",
  },
} as const;

function TodayExploreCard({
  shortcut,
  wrapTitle,
  onPress,
}: {
  shortcut: (typeof exploreShortcuts)[number];
  wrapTitle?: boolean;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const art = exploreArt[shortcut.route];
  const wide = shortcut.route === "checkin";
  const title = wrapTitle ? shortcut.title.replace(" ", "\n") : shortcut.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shortcut.title}
      accessibilityHint={art.detail}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exploreCard,
        wide ? styles.exploreCardWide : styles.exploreCardTile,
        !dark && { backgroundColor: colors.surface },
        {
          borderColor: pressed ? art.color : dark ? "#6D5B7A75" : colors.border,
        },
      ]}
    >
      <Image
        source={art.image}
        style={[coverImageStyle, wide && styles.exploreArtWide]}
        resizeMode="cover"
        accessible={false}
        pointerEvents="none"
        fadeDuration={0}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          dark
            ? wide
              ? styles.exploreScrimWide
              : styles.exploreScrim
            : wide
              ? artGradient(
                  `linear-gradient(90deg, ${colors.surface} 0%, ${colors.surface} 36%, ${colors.surface}D9 52%, ${colors.surface}00 82%)`,
                )
              : artGradient(
                  `linear-gradient(180deg, ${colors.surface}00 0%, ${colors.surface}10 41%, ${colors.surface}F5 73%, ${colors.surface} 100%)`,
                ),
        ]}
      />
      <View pointerEvents="none" style={styles.exploreCardHeader}>
        <View
          style={[
            styles.exploreCardIcon,
            !dark && { backgroundColor: colors.tabActiveSurface },
          ]}
        >
          <Icon
            name={shortcut.icon}
            color={dark ? art.color : colors.tabActiveText}
            size={20}
          />
        </View>
        {dark ? (
          <Icon name="chevron-forward" size={15} color="#FFF9F7" />
        ) : (
          <View
            style={[
              styles.lightExploreArrow,
              { backgroundColor: colors.surface },
            ]}
          >
            <Icon name="chevron-forward" size={15} color={colors.accent} />
          </View>
        )}
      </View>
      <View style={styles.exploreCardCopy}>
        <AppText
          variant="label"
          color={dark ? "#FFF9F7" : colors.text}
          style={styles.exploreCardTitle}
        >
          {title}
        </AppText>
        <AppText variant="caption" color={dark ? "#E7DCEB" : colors.muted}>
          {art.detail}
        </AppText>
      </View>
    </Pressable>
  );
}

const calmReset = {
  ...createExplorePractice("breathe", 5),
  id: "today-calm-reset",
  title: "A Calm Reset",
};

const artwork = {
  light: {
    scene: require("../../assets/redesign-today-scene-light.jpg"),
    reset: require("../../assets/redesign-reset-light.jpg"),
  },
  dark: {
    scene: require("../../assets/today-twilight-lotus.jpg"),
    reset: require("../../assets/today-twilight-stones.jpg"),
  },
};

const dailyActions = {
  checkin: "Start check-in",
  practice: "Take a Moment",
  reflection: "Reflect",
} as const;

function useToday() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}

export function TodayScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const headerInsets = useMainTabHeaderInsets();
  const reducedMotion = useReducedMotion();
  const dark = resolved === "dark";
  const largeText = fontScale > 1.2;
  const lightPhotoMoment = !dark && !largeText;
  const momentTitleInk = dark
    ? "#FFF9F4"
    : lightPhotoMoment
      ? daylightPhotoInk.title
      : colors.text;
  const momentDetailInk = dark
    ? "#FFF9F5"
    : lightPhotoMoment
      ? daylightPhotoInk.detail
      : colors.muted;
  const compact = width < 360;
  const compactLight = !dark && !compact && height <= 850 && !largeText;
  const exploreTileTextWidth =
    (Math.min(width, 480) - 2 * gutter - spacing.row) / 2 - 2 * spacing.row;
  const wrapExploreTitles = exploreTileTextWidth < 132 * fontScale;
  const moodPadding = compact ? 6 : isAndroid ? spacing.compact : spacing.row;
  const moodGap = compact ? 4 : isAndroid ? 6 : spacing.compact;
  const moodWidth =
    (Math.min(width, 480) - 2 * (gutter + moodPadding + 1) - 4 * moodGap) / 5;
  const wrapMoods = largeText || moodWidth < Math.max(48, 44 * fontScale + 4);
  const now = useToday();
  const today = localDay(now);
  const quickTileWidth =
    (Math.min(width, 480) - 2 * gutter - 3 * spacing.compact) /
    quickActions.length;
  const quickTileHeight = Math.max(110, Math.min(125, quickTileWidth + 35));
  const wrapQuickActions = !dark && (fontScale > 1.3 || width < 310);
  const [showReason, setShowReason] = useState(false);
  const requestedSection = app.params?.section;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const dailyPauseLayout = useRef<{
    content?: number;
    card?: number;
    opened?: number;
  }>({});
  const jumpToDailyPause = useCallback(() => {
    const layout = dailyPauseLayout.current;
    if (
      requestedSection !== "daily-pause" ||
      layout.opened === app.routeKey ||
      layout.content === undefined ||
      layout.card === undefined ||
      !scroll.current
    )
      return;
    scroll.current.scrollTo({
      y: layout.content + layout.card,
      animated: !reducedMotion,
    });
    layout.opened = app.routeKey;
  }, [requestedSection, app.routeKey, reducedMotion]);
  useEffect(() => jumpToDailyPause(), [jumpToDailyPause]);
  const {
    checkins,
    goals,
    habits,
    habitProgress,
    memories,
    preferences,
    reflections,
    sessions,
  } = app.data;
  const dailyHabits = useMemo(
    () => getTodayHabitsPreview(habits, habitProgress, now),
    [habits, habitProgress, now],
  );
  const routine = useMemo(
    () =>
      pickDailyRoutine(
        { checkins, goals, memories, preferences, reflections, sessions },
        app.user,
        now,
      ),
    [
      checkins,
      goals,
      memories,
      preferences,
      reflections,
      sessions,
      app.user,
      now,
    ],
  );
  const selectedCheckin = routine.todayCheckin;
  const environment = preferences.find(
    (item) => item.id === "wellness",
  )?.environment;
  const name =
    String(app.user?.name || "")
      .trim()
      .split(/\s+/)[0] || "Friend";
  const greeting =
    now.getHours() < 12
      ? "Good Morning"
      : now.getHours() < 17
        ? "Good Afternoon"
        : "Good Evening";
  const next = routine.nextStep;
  const enabled = routine.settings.enabled;
  const explanationBasis =
    routine.source === "today-checkin"
      ? "current-checkin"
      : routine.source === "user-choice"
        ? "your-choice"
        : ["preference", "feedback", "goal", "wellness-goal"].includes(
              routine.source,
            )
          ? "personalized"
          : "general";
  const stepCount = routine.steps.length;
  const progress = (routine.completedCount / stepCount) * 100;
  const stepLabel = `${routine.completedCount} of ${stepCount} steps`;
  const panel = {
    backgroundColor: dark ? "#211C2B" : colors.surface,
    borderColor: dark ? "#51415E" : colors.heroBorder,
  };
  const secondary = dark ? "#CEC4DA" : colors.muted;
  const dailyPrimary = colors.primary;
  const dailyPrimaryInk = colors.primaryText;
  useEffect(
    () => setShowReason(false),
    [today, routine.suggestion.activity, next?.id],
  );

  function startMoment() {
    app.navigate("moment-player", {
      activity: {
        ...calmReset,
        environment:
          environment === "ocean" || environment === "twilight"
            ? environment
            : "forest",
      },
      provider: "offline",
      source: "today",
    });
  }

  function openCheckin(mood: MoodChoice["mood"]) {
    void playHaptic("selection");
    if (Platform.OS !== "web") {
      AccessibilityInfo.announceForAccessibility(
        `${mood} selected for your check-in.`,
      );
    }
    app.navigate("checkin", { mood });
  }

  return (
    <Screen
      edgeToEdge
      heroStatusBar={dark ? "light" : "dark"}
      style={styles.screen}
      scrollRef={scroll}
    >
      <View
        style={[
          styles.hero,
          isAndroid && styles.androidHero,
          !dark && [styles.lightHero, { backgroundColor: colors.bg }],
          headerInsets,
        ]}
      >
        <Image
          source={artwork[resolved].scene}
          style={coverImageStyle}
          resizeMode="cover"
          accessible={false}
          pointerEvents="none"
          fadeDuration={0}
        />
        {dark ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundImage:
                  "linear-gradient(90deg, #12101ED9 0%, #1E172B59 45%, #17132300 78%)",
              },
            ]}
          />
        ) : (
          <DaylightHeroBlend color={colors.bg} />
        )}
        {dark && (
          <View
            pointerEvents="none"
            style={[
              styles.heroFade,
              {
                backgroundImage: `linear-gradient(180deg, transparent 0%, ${colors.bg} 100%)`,
              },
            ]}
          />
        )}
        <MainTabHeader color={dark ? "#FFF8F2" : colors.text}>
          {[
            {
              label: "Reminders",
              icon: "notifications-outline",
              route: "reminders",
            },
            {
              label: "Create a Solace Moment",
              icon: "sparkles-outline",
              route: "moments",
            },
          ].map(({ label, icon, route }) => (
            <IconButton
              key={route}
              name={icon}
              label={label}
              onPress={() => app.navigate(route)}
              appearance={dark ? "artwork" : "outlined"}
              size={48}
              indicator={
                route === "reminders" &&
                app.data.reminders.some((reminder) => reminder.enabled === true)
              }
            />
          ))}
        </MainTabHeader>
        <View style={styles.greeting}>
          <AppText
            variant="label"
            color={dark ? colors.lavenderAction : colors.lavenderText}
            style={styles.salutation}
          >
            {greeting}
          </AppText>
          <AppText
            variant="display"
            accessibilityRole="header"
            color={dark ? "#FFF9F4" : colors.text}
            style={[styles.name, !dark && styles.lightName]}
          >
            {name}.
          </AppText>
          <AppText
            color={dark ? "#FFF7F5" : colors.text}
            style={[
              styles.welcome,
              dark ? styles.welcomeShadow : styles.lightWelcome,
            ]}
          >
            A calmer, kinder space for your mind.
          </AppText>
        </View>
      </View>

      <View
        style={[
          styles.content,
          !dark && styles.lightContent,
          { paddingHorizontal: gutter },
        ]}
        onLayout={({ nativeEvent }) => {
          dailyPauseLayout.current.content = nativeEvent.layout.y;
          jumpToDailyPause();
        }}
      >
        {app.pendingWrites.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage unsynced writing"
            onPress={() => app.navigate("account")}
            style={[styles.unsynced, { backgroundColor: colors.peachSurface }]}
          >
            <Icon
              name="cloud-upload-outline"
              color={colors.peachText}
              size={19}
            />
            <AppText
              variant="caption"
              color={colors.peachText}
              style={styles.fill}
            >
              {app.pendingWrites.length === 1
                ? "1 entry is"
                : app.pendingWrites.length + " entries are"}{" "}
              waiting to sync.
            </AppText>
            <Icon name="chevron-forward" color={colors.peachText} size={15} />
          </Pressable>
        )}

        <View
          style={[
            styles.moods,
            isAndroid && styles.androidMoods,
            { paddingHorizontal: moodPadding },
            panel,
            dark && styles.moodDepth,
          ]}
        >
          <Row style={styles.moodHead}>
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={styles.moodHeading}
            >
              How are you feeling today?
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open mood check-in"
              onPress={() => app.navigate("checkin")}
              style={({ pressed }) => [
                styles.moodEntry,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <View
                style={[
                  styles.moodEntryDisc,
                  { borderColor: panel.borderColor },
                  !dark && { backgroundColor: colors.lavenderSurface },
                ]}
              >
                <Icon
                  name="pulse-outline"
                  color={dark ? "#E8DBEF" : colors.accent}
                  size={18}
                />
              </View>
            </Pressable>
          </Row>
          {!checkins.length && (
            <AppText variant="caption" color={dark ? "#E8DBEF" : colors.muted}>
              Start here. Choose the mood that feels closest.
            </AppText>
          )}
          <Row
            style={[styles.moodRow, { gap: moodGap }, wrapMoods && styles.wrap]}
          >
            {moodPetals.map((choice) => (
              <TodayMoodOption
                key={choice.mood}
                choice={choice}
                status={
                  selectedCheckin?.mood === choice.mood
                    ? selectedCheckin.localOnly
                      ? "pending"
                      : "saved"
                    : undefined
                }
                wrap={wrapMoods}
                compactLight={compactLight}
                reducedMotion={reducedMotion}
                onPress={() => openCheckin(choice.mood)}
              />
            ))}
          </Row>
        </View>

        <TodayProgressCard
          routine={routine}
          habits={{
            completed: dailyHabits.done,
            scheduled: dailyHabits.fixed.length,
          }}
          loading={app.initializing}
          error={!!app.sessionError}
          compactLayout={compactLight}
          onViewDetails={() => app.navigate(routes.journey)}
        />

        <View style={styles.momentGroup}>
          <View
            style={[
              styles.focus,
              isAndroid && styles.androidFocus,
              !dark && largeText && styles.lightFocusStack,
              {
                borderColor: dark ? "#A8836F" : colors.border,
                backgroundColor:
                  dark || lightPhotoMoment ? "#211D2E" : colors.lavenderSurface,
              },
            ]}
          >
            <Image
              source={artwork[resolved].reset}
              style={
                !dark && largeText ? styles.lightFocusArtStack : coverImageStyle
              }
              resizeMode="cover"
              accessible={false}
              pointerEvents="none"
              fadeDuration={0}
            />
            {dark && (
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundImage:
                      "linear-gradient(90deg, #211C2DF5 0%, #211C2DCC 56%, #221B2A24 100%)",
                  },
                ]}
              />
            )}
            {lightPhotoMoment && (
              <DaylightScenicScrim
                coverage={compact ? 64 : 59}
                fadeThrough={88}
              />
            )}
            <Row
              style={[
                styles.focusBadge,
                lightPhotoMoment && styles.lightPhotoBadge,
                !dark &&
                  !lightPhotoMoment && {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
              ]}
            >
              <Icon
                name="leaf-outline"
                size={14}
                color={
                  dark
                    ? "#FFDEAD"
                    : lightPhotoMoment
                      ? daylightPhotoInk.detail
                      : colors.accent
                }
              />
              <AppText
                variant="label"
                color={
                  dark
                    ? "#FFDEAD"
                    : lightPhotoMoment
                      ? daylightPhotoInk.detail
                      : colors.accent
                }
                style={styles.focusLabel}
              >
                Today’s Moment
              </AppText>
            </Row>
            <AppText
              variant="title"
              accessibilityRole="header"
              color={momentTitleInk}
              style={[
                styles.focusTitle,
                isAndroid && styles.androidFocusTitle,
                largeText && styles.fullWidth,
              ]}
            >
              {calmReset.title}
            </AppText>
            <AppText
              color={momentDetailInk}
              style={[
                styles.focusDetail,
                isAndroid && styles.androidFocusDetail,
                (compact || largeText) && styles.wideCopy,
                !dark && !largeText && styles.lightFocusDetail,
              ]}
            >
              A guided pause to slow down and settle.
            </AppText>
            <Row
              style={[
                styles.focusFooter,
                isAndroid && styles.androidFocusFooter,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={startMoment}
                style={({ pressed }) => [
                  styles.focusAction,
                  {
                    backgroundColor: colors.lavenderAction,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Icon name="play" color={colors.lavenderActionText} size={16} />
                <AppText
                  variant="label"
                  color={colors.lavenderActionText}
                  style={styles.startLabel}
                >
                  Start Moment
                </AppText>
              </Pressable>
              <Row
                style={[
                  styles.duration,
                  !dark &&
                    !lightPhotoMoment && {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                ]}
              >
                <Icon
                  name="timer-outline"
                  size={16}
                  color={dark || lightPhotoMoment ? "#FFF5F1" : colors.accent}
                />
                <AppText
                  variant="label"
                  color={dark || lightPhotoMoment ? "#FFF5F1" : colors.text}
                  style={styles.durationText}
                >
                  5 min
                </AppText>
              </Row>
            </Row>
          </View>

          <Row style={[styles.quickActions, wrapQuickActions && styles.wrap]}>
            {quickActions.map((action) => (
              <Pressable
                key={action.title}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                onPress={() => app.navigate(action.route, action.params)}
                style={({ pressed }) => [
                  styles.quickAction,
                  !dark && styles.lightQuickAction,
                  wrapQuickActions && styles.lightQuickWrap,
                  {
                    minHeight: quickTileHeight,
                    borderColor: panel.borderColor,
                    opacity: pressed ? 0.82 : 1,
                    ...(!dark && { backgroundColor: colors.surface }),
                  },
                ]}
              >
                {dark ? (
                  <>
                    <Image
                      source={action.image}
                      style={coverImageStyle}
                      resizeMode="cover"
                      fadeDuration={0}
                      accessible={false}
                      pointerEvents="none"
                    />
                    <View
                      pointerEvents="none"
                      style={[StyleSheet.absoluteFill, styles.quickScrim]}
                    />
                    <View style={styles.quickIcon}>
                      <Icon name={action.icon} color={action.ink} size={22} />
                    </View>
                  </>
                ) : (
                  <View
                    style={[
                      styles.lightQuickArt,
                      { backgroundColor: colors.surface2 },
                    ]}
                  >
                    <Image
                      source={action.image}
                      style={coverImageStyle}
                      resizeMode="cover"
                      fadeDuration={0}
                      accessible={false}
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.lightQuickIcon,
                        { backgroundColor: `${colors.surface}F5` },
                      ]}
                    >
                      <Icon
                        name={action.icon}
                        color={colors.accent}
                        size={18}
                      />
                    </View>
                  </View>
                )}
                <AppText
                  variant="label"
                  color={dark ? "#FFF8F2" : colors.text}
                  style={[styles.quickLabel, !dark && styles.lightQuickLabel]}
                >
                  {action.title}
                </AppText>
              </Pressable>
            ))}
          </Row>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            enabled
              ? `Your Journey. ${stepLabel} completed today`
              : "Your Journey"
          }
          onPress={() => app.navigate("journey")}
          style={({ pressed }) => [
            styles.journey,
            isAndroid && styles.androidJourney,
            panel,
            dark && styles.journeyDepth,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View
            style={[
              styles.journeyIcon,
              { backgroundColor: dark ? "#392D4E" : colors.lavenderSurface },
            ]}
          >
            <Icon
              name="git-network-outline"
              color={dark ? "#DAB3FA" : colors.lavenderText}
              size={22}
            />
          </View>
          <View style={styles.fill}>
            <AppText variant="heading" style={styles.journeyTitle}>
              Your Journey
            </AppText>
            <AppText
              variant="caption"
              color={secondary}
              style={styles.journeyDetail}
            >
              {enabled
                ? "Your Daily Pause progress"
                : "View your saved activity"}
            </AppText>
            {enabled && (
              <Row style={styles.progressRow}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: dark ? "#51455F" : colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: dark ? "#C49AF5" : colors.accent,
                      },
                    ]}
                  />
                </View>
                <AppText
                  variant="caption"
                  color={secondary}
                  style={styles.progressText}
                >
                  {stepLabel}
                </AppText>
              </Row>
            )}
          </View>
          <Icon name="chevron-forward" size={17} />
        </Pressable>

        <TodayHabits
          daily={dailyHabits}
          surfaceStyle={[panel, dark && styles.journeyDepth]}
        />
        <View>
          <Row style={styles.exploreHead}>
            <Row style={styles.exploreTitle}>
              <Icon name="grid-outline" size={19} />
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={styles.exploreHeading}
              >
                Explore More
              </AppText>
            </Row>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all practices"
              onPress={() =>
                app.navigate(routes.explore, { resetExplore: true })
              }
              style={({ pressed }) => [
                styles.seeAll,
                { opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <AppText variant="label" style={styles.seeAllText}>
                See All
              </AppText>
              <Icon name="chevron-forward" size={14} />
            </Pressable>
          </Row>
          <View style={styles.exploreCards}>
            <View style={styles.exploreCardRow}>
              {exploreShortcuts.slice(0, 2).map((shortcut) => (
                <TodayExploreCard
                  key={shortcut.route}
                  shortcut={shortcut}
                  wrapTitle={wrapExploreTitles}
                  onPress={() => app.navigate(shortcut.route)}
                />
              ))}
            </View>
            <TodayExploreCard
              shortcut={exploreShortcuts[2]}
              onPress={() => app.navigate(exploreShortcuts[2].route)}
            />
          </View>
        </View>

        <View
          onLayout={({ nativeEvent }) => {
            dailyPauseLayout.current.card = nativeEvent.layout.y;
            jumpToDailyPause();
          }}
          style={[
            styles.daily,
            isAndroid && styles.androidDaily,
            panel,
            dark && styles.journeyDepth,
          ]}
        >
          <DailyRitualOptions
            key={routine.day}
            settings={routine.settings}
            canSkip={next?.id === "practice" || routine.practiceSkipped}
            heading={
              <Row style={styles.dailyHeading}>
                <View
                  style={[
                    styles.dailyMark,
                    { backgroundColor: colors.lavenderSurface },
                  ]}
                >
                  <LotusMark size={24} />
                </View>
                <AppText
                  variant="heading"
                  accessibilityRole="header"
                  style={styles.dailyTitle}
                >
                  Your Daily Pause
                </AppText>
              </Row>
            }
            reasonAction={
              next?.id === "practice" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowReason(true)}
                  style={({ pressed }) => [
                    styles.reason,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name="information-circle-outline"
                    color={secondary}
                    size={14}
                  />
                  <AppText
                    variant="caption"
                    color={secondary}
                    style={styles.reasonLabel}
                  >
                    Why Solace suggested this
                  </AppText>
                </Pressable>
              )
            }
          >
            {enabled ? (
              <>
                <Row style={styles.dailySteps}>
                  {routine.steps.map((step, index) => {
                    const current = next?.id === step.id;
                    const skipped =
                      step.id === "practice" && routine.practiceSkipped;
                    const status = step.complete
                      ? "Completed"
                      : skipped
                        ? "Skipped today"
                        : current
                          ? "Next step"
                          : "Available";
                    const emphasis = current || step.complete;
                    const stepInk = current
                      ? dailyPrimaryInk
                      : emphasis
                        ? colors.sageText
                        : secondary;
                    const indicator = (
                      <View
                        style={[
                          styles.stepIndicator,
                          {
                            borderColor: emphasis
                              ? "transparent"
                              : panel.borderColor,
                            backgroundColor: current
                              ? dailyPrimary
                              : step.complete
                                ? colors.sageSurface
                                : "transparent",
                          },
                        ]}
                      >
                        {step.complete ? (
                          <Icon name="checkmark" size={16} color={stepInk} />
                        ) : skipped ? (
                          <Icon name="remove" size={16} color={stepInk} />
                        ) : (
                          <AppText
                            variant="label"
                            color={stepInk}
                            maxFontSizeMultiplier={1.5}
                            style={styles.stepNumber}
                          >
                            {index + 1}
                          </AppText>
                        )}
                      </View>
                    );
                    const connectors = (
                      <>
                        {index > 0 && (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.stepConnector,
                              styles.stepConnectorBefore,
                              {
                                backgroundColor: routine.steps[index - 1]
                                  .complete
                                  ? colors.sageText
                                  : panel.borderColor,
                              },
                            ]}
                          />
                        )}
                        {index < stepCount - 1 && (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.stepConnector,
                              styles.stepConnectorAfter,
                              {
                                backgroundColor: step.complete
                                  ? colors.sageText
                                  : panel.borderColor,
                              },
                            ]}
                          />
                        )}
                      </>
                    );
                    const label = (
                      <AppText variant="label" style={styles.stepLabel}>
                        {step.id === "practice" ? "Moment" : step.title}
                      </AppText>
                    );
                    return current || skipped ? (
                      <View
                        key={step.id}
                        accessible
                        accessibilityLabel={`${step.title}. ${status}`}
                        style={styles.dailyStep}
                      >
                        {connectors}
                        {indicator}
                        {label}
                      </View>
                    ) : (
                      <Pressable
                        key={step.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${step.title}. ${status}`}
                        onPress={() => app.navigate(step.route, step.params)}
                        style={({ pressed }) => [
                          styles.dailyStep,
                          pressed && styles.pressed,
                        ]}
                      >
                        {connectors}
                        {indicator}
                        {label}
                      </Pressable>
                    );
                  })}
                </Row>
                {next?.id === "practice" ? (
                  <AppText variant="caption" color={secondary}>
                    {routine.suggestion.title} · {routine.suggestion.duration}
                  </AppText>
                ) : routine.practiceSkipped ? (
                  <AppText variant="caption" color={secondary}>
                    Today’s Moment is skipped. Check in or reflect whenever you
                    like.
                  </AppText>
                ) : !next ? (
                  <AppText variant="caption" color={secondary}>
                    You made time for yourself today.
                  </AppText>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    next
                      ? app.navigate(next.route, next.params)
                      : app.navigate("journey-activity", { day: routine.day })
                  }
                  style={({ pressed }) => [
                    styles.dailyAction,
                    { backgroundColor: dailyPrimary },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText
                    variant="label"
                    color={dailyPrimaryInk}
                    style={styles.startLabel}
                  >
                    {next ? dailyActions[next.id] : "View today’s pause"}
                  </AppText>
                  <Icon
                    name="arrow-forward"
                    size={16}
                    color={dailyPrimaryInk}
                  />
                </Pressable>
              </>
            ) : (
              <AppText variant="caption" color={secondary}>
                Daily Pause is off. You can turn it on whenever you’d like.
              </AppText>
            )}
          </DailyRitualOptions>
        </View>
      </View>
      <RecommendationExplanation
        open={showReason && enabled && next?.id === "practice"}
        onClose={() => setShowReason(false)}
        onManage={
          explanationBasis === "personalized"
            ? () => {
                setShowReason(false);
                app.navigate("memory");
              }
            : undefined
        }
        title={routine.suggestion.title}
        reason={routine.suggestion.reason}
        basis={explanationBasis}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  hero: { overflow: "hidden", paddingBottom: spacing.section },
  androidHero: { paddingBottom: spacing.screenTop },
  lightHero: { paddingBottom: spacing.screenTop },
  heroFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 42 },
  greeting: { marginTop: 3, maxWidth: "100%" },
  salutation: { fontSize: 12, lineHeight: 16, letterSpacing: 1.25 },
  name: {
    fontSize: 41,
    lineHeight: Platform.OS === "android" ? 54 : 48,
    marginTop: 1,
  },
  welcome: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: "77%",
  },
  welcomeShadow: {
    textShadowColor: "#120F1C",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  lightName: { maxWidth: "60%" },
  lightWelcome: { maxWidth: "54%" },
  content: { marginTop: -4, gap: spacing.section },
  lightContent: { gap: spacing.card },
  fill: { flex: 1, minWidth: 0 },
  unsynced: {
    borderRadius: 14,
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 10,
  },
  moods: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.row,
    paddingBottom: spacing.row,
  },
  androidMoods: {
    paddingBottom: spacing.compact,
  },
  moodDepth: {
    backgroundImage:
      "linear-gradient(140deg, #2D233B 0%, #211B2A 53%, #201A28 100%)",
  },
  moodHead: {
    justifyContent: "space-between",
    gap: spacing.compact,
    marginBottom: 4,
  },
  moodHeading: { flex: 1, fontSize: 21, lineHeight: 26 },
  moodEntry: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  moodEntryDisc: {
    minWidth: 34,
    height: 25,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  moodRow: { alignItems: "stretch" },
  wrap: { flexWrap: "wrap" },
  mood: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 1,
    paddingVertical: spacing.compact,
    gap: 4,
  },
  androidMood: { minHeight: 56, paddingVertical: 4, gap: 3 },
  lightCompactMood: { minHeight: 52 },
  largeMood: { flexBasis: "28%", flexGrow: 1 },
  moodTint: { ...StyleSheet.absoluteFill, borderRadius: 17 },
  moodPetal: { width: 29, height: 24 },
  moodText: { textAlign: "center", fontSize: 11, lineHeight: 15 },
  androidMoodText: { alignSelf: "stretch" },
  momentGroup: { gap: spacing.row },
  focus: {
    minHeight: 176,
    padding: spacing.card,
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
  },
  focusBadge: {
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F7CB9273",
    backgroundColor: "#D5AC7630",
  },
  focusLabel: { fontSize: 11, lineHeight: 15 },
  lightPhotoBadge: {
    backgroundColor: "#2D2239B8",
    borderColor: "#F3E2FB85",
  },
  focusTitle: { width: "78%", fontSize: 31, lineHeight: 36, marginTop: 4 },
  androidFocus: {
    minHeight: 160,
    paddingVertical: 9,
  },
  androidFocusTitle: { fontSize: 29 },
  fullWidth: { width: "100%" },
  focusDetail: { maxWidth: "66%", fontSize: 13, lineHeight: 18, marginTop: 3 },
  androidFocusDetail: { maxWidth: "76%" },
  wideCopy: { maxWidth: "90%" },
  lightFocusDetail: { maxWidth: "52%" },
  lightFocusStack: { paddingTop: spacing.card },
  lightFocusArtStack: {
    width: "100%",
    height: 122,
    borderRadius: 13,
    marginBottom: spacing.row,
  },
  focusFooter: {
    marginTop: spacing.row,
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.compact,
  },
  androidFocusFooter: { marginTop: spacing.compact },
  focusAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 5,
    minHeight: 48,
    borderRadius: 24,
    flexShrink: 1,
  },
  startLabel: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
  duration: {
    gap: 4,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#251F31E6",
    borderWidth: 1,
    borderColor: "#FFF5EA48",
  },
  durationText: { fontSize: 11, lineHeight: 14 },
  quickActions: {
    alignItems: "stretch",
    gap: spacing.compact,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 3,
    paddingVertical: spacing.compact,
    gap: 6,
    borderWidth: 1,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#1E2027",
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#151522A3",
    alignItems: "center",
    justifyContent: "center",
  },
  lightQuickAction: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "space-between",
    gap: 0,
  },
  lightQuickWrap: { flexBasis: "45%" },
  lightQuickArt: {
    flex: 1,
    minHeight: 62,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.compact,
    overflow: "hidden",
  },
  lightQuickIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
  lightQuickLabel: { paddingHorizontal: 2, paddingVertical: 6 },
  quickScrim: artGradient(
    "linear-gradient(180deg, #12101B0D 0%, #12101B26 48%, #12101BBF 78%, #12101BEF 100%)",
  ),
  journey: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.row,
    alignItems: "center",
    minHeight: 76,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.row,
  },
  journeyDepth: {
    backgroundImage:
      "linear-gradient(140deg, #2B2536 0%, #191723 73%, #24222C 100%)",
    borderColor: "#494153",
  },
  androidJourney: {
    paddingVertical: spacing.compact,
  },
  journeyIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyTitle: { fontSize: 19, lineHeight: 23 },
  journeyDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  progressRow: { marginTop: 6, gap: spacing.compact },
  progressTrack: {
    flex: 1,
    minWidth: 18,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { flexShrink: 1, fontSize: 11, lineHeight: 15 },
  exploreHead: {
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 4,
  },
  exploreTitle: { flex: 1, minWidth: 0, gap: 8 },
  exploreHeading: { flex: 1, fontSize: 19, lineHeight: 24 },
  seeAll: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
  exploreCards: { gap: spacing.row },
  exploreCardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.row,
  },
  exploreCard: {
    minWidth: 0,
    padding: spacing.row,
    gap: spacing.row,
    justifyContent: "space-between",
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#282137",
  },
  exploreCardTile: { flex: 1, minHeight: 144 },
  exploreCardWide: { minHeight: 116 },
  exploreCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exploreCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#181220B3",
    alignItems: "center",
    justifyContent: "center",
  },
  lightExploreArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreCardCopy: { gap: 2 },
  exploreArtWide: { left: "30%" },
  exploreScrim: artGradient(
    "linear-gradient(180deg, #18122054 0%, #20182988 32%, #17121FF2 73%, #17121F 100%)",
  ),
  exploreScrimWide: artGradient(
    "linear-gradient(90deg, #17121F 0%, #17121F 30%, #201829C7 53%, #18122066 100%)",
  ),
  exploreCardTitle: { fontSize: 15, lineHeight: 20 },
  daily: {
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.card,
  },
  androidDaily: { padding: spacing.row },
  dailyHeading: { flex: 1, minWidth: 0, gap: spacing.compact },
  dailyTitle: { flex: 1, fontSize: 20, lineHeight: 24 },
  dailyMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dailySteps: { gap: 0, alignItems: "stretch" },
  dailyStep: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    gap: 4,
    alignItems: "center",
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  stepConnector: { position: "absolute", top: 15, height: 1 },
  stepConnectorBefore: {
    left: 0,
    right: "50%",
    marginRight: 18,
  },
  stepConnectorAfter: {
    left: "50%",
    right: 0,
    marginLeft: 18,
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { fontSize: 11, lineHeight: 15 },
  stepLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  dailyAction: {
    flexDirection: "row",
    alignSelf: "stretch",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.compact,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.compact,
    maxWidth: "100%",
    borderRadius: 24,
  },
  pressed: { opacity: 0.72 },
  reason: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    paddingVertical: 4,
  },
  reasonLabel: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
});
