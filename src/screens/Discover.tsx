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
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  AndroidHaptics,
  performAndroidHapticsAsync,
  selectionAsync,
} from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../Companion";
import { localDay } from "../content";
import { createExplorePractice, exploreShortcuts } from "../explore-practices";
import { spacing, useScreenGutter } from "../layout";
import { pickDailyRoutine } from "../routine";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { DailyRitualOptions } from "./DailyRitualOptions";
import { TodayHabits } from "./HabitEntryPoints";
import { RecommendationExplanation } from "./RecommendationExplanation";
import {
  AppText,
  coverImageStyle,
  Icon,
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
    tone: "breathe",
  },
  {
    title: "Reflect",
    icon: "pencil-outline",
    route: "reflection",
    params: {},
    tone: "reflect",
  },
  {
    title: "Sleep",
    icon: "moon-outline",
    route: "sleep",
    params: {},
    tone: "sleep",
  },
  {
    title: "Focus",
    icon: "locate-outline",
    route: "grounding",
    params: {},
    tone: "focus",
  },
] as const;

type MoodChoice = (typeof moodPetals)[number];
const isAndroid = Platform.OS === "android";

function TodayMoodOption({
  choice: { mood, image },
  status,
  wrap,
  labelScaleLimit,
  reducedMotion,
  onPress,
}: {
  choice: MoodChoice;
  status?: "saved" | "pending";
  wrap: boolean;
  labelScaleLimit?: number;
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
        wrap && styles.largeMood,
        {
          backgroundColor: dark ? "#302839" : "#FFFAF3",
          borderColor: selected
            ? dark
              ? "#BE99F2"
              : colors.lavenderText
            : dark
              ? "#45394E"
              : colors.heroBorder,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.moodTint,
          {
            backgroundColor: dark ? "#493765" : colors.lavenderSurface,
            opacity: tint,
          },
        ]}
      />
      <MoodPetal source={image} style={styles.moodPetal} />
      <AppText
        variant={selected ? "label" : "caption"}
        color={selected ? colors.lavenderText : colors.text}
        numberOfLines={isAndroid && !wrap ? 1 : undefined}
        adjustsFontSizeToFit={isAndroid && !wrap}
        maxFontSizeMultiplier={labelScaleLimit}
        style={[styles.moodText, isAndroid && styles.androidMoodText]}
      >
        {mood}
      </AppText>
    </Pressable>
  );
}

const exploreArt = {
  plan: {
    image: require("../../assets/today-explore-guided.jpg"),
    color: "#D9B3FF",
    detail: "Three-day plans",
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
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const { top } = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const dark = resolved === "dark";
  const largeText = fontScale > 1.2;
  const compact = width < 360;
  const exploreColumnWidth =
    (Math.min(width, 480) - 2 * gutter - spacing.compact) / 2;
  const stackExploreCards = exploreColumnWidth < 126 * fontScale;
  const inlineExploreCards = exploreColumnWidth >= 176 * fontScale;
  const moodPadding =
    isAndroid && compact
      ? 6
      : compact || isAndroid
        ? spacing.compact
        : spacing.row;
  const moodGap = isAndroid ? (compact ? 4 : 6) : compact ? 6 : spacing.compact;
  const moodWidth =
    (Math.min(width, 480) - 2 * (gutter + moodPadding + 1) - 4 * moodGap) / 5;
  const wrapMoods = isAndroid
    ? moodWidth < 48
    : largeText || moodWidth < 50 * fontScale + 6;
  // Use the same scale for all five labels, based on the widest one (Stressed).
  const moodLabelScale =
    isAndroid && !wrapMoods ? Math.max(1, (moodWidth - 5) / 48) : undefined;
  const now = useToday();
  const today = localDay(now);
  const [showReason, setShowReason] = useState(false);
  const { checkins, goals, memories, preferences, reflections, sessions } =
    app.data;
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
        : ["preference", "feedback", "goal"].includes(routine.source)
          ? "personalized"
          : "general";
  const stepCount = routine.steps.length;
  const progress = (routine.completedCount / stepCount) * 100;
  const stepLabel = `${routine.completedCount} of ${stepCount} steps`;
  const panel = {
    backgroundColor: dark ? "#211C2B" : colors.surface,
    borderColor: dark ? "#51415E" : colors.heroBorder,
  };
  const secondary = dark ? "#CEC4DA" : colors.heroMuted;
  const dailyPrimary = dark ? "#E7C7A8" : colors.primary;
  const dailyPrimaryInk = dark ? "#2B211A" : colors.primaryText;
  const accents = dark
    ? {
        breathe: { background: "#202C2B", border: "#3D514D", icon: "#84F4BF" },
        reflect: { background: "#2A223A", border: "#4D3C66", icon: "#DAB4FF" },
        sleep: { background: "#2F2529", border: "#59444B", icon: "#FFC66D" },
        focus: { background: "#23282A", border: "#424C4D", icon: "#BCE8C8" },
      }
    : {
        breathe: {
          background: colors.sageSurface,
          border: "#CCDCC8",
          icon: colors.sageText,
        },
        reflect: {
          background: colors.lavenderSurface,
          border: "#DED0E7",
          icon: colors.lavenderText,
        },
        sleep: {
          background: colors.peachSurface,
          border: "#EFD2BA",
          icon: colors.peachText,
        },
        focus: {
          background: colors.sageSurface,
          border: "#CCDCC8",
          icon: colors.sageText,
        },
      };
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
    if (Platform.OS === "ios") {
      void selectionAsync().catch(() => {});
    } else if (Platform.OS === "android") {
      void performAndroidHapticsAsync(AndroidHaptics.Segment_Tick).catch(
        () => {},
      );
    }
    if (Platform.OS !== "web") {
      AccessibilityInfo.announceForAccessibility(
        `${mood} selected for your check-in.`,
      );
    }
    app.navigate("checkin", { mood });
  }

  return (
    <Screen edgeToEdge heroStatusBar="light" style={styles.screen}>
      <View
        style={[
          styles.hero,
          isAndroid && styles.androidHero,
          { paddingTop: top + 3, paddingHorizontal: gutter },
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
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: dark
                ? "linear-gradient(90deg, #12101ED9 0%, #1E172B59 45%, #17132300 78%)"
                : "linear-gradient(90deg, #17271BD4 0%, #1A30205E 46%, #24352900 82%)",
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.heroFade,
            {
              backgroundImage: `linear-gradient(180deg, transparent 0%, ${colors.bg} 100%)`,
            },
          ]}
        />
        <Row style={styles.header}>
          <Row style={styles.brand}>
            <LotusMark size={30} />
            <AppText variant="heading" color="#FFF8F2" style={styles.brandName}>
              Solace
            </AppText>
          </Row>
          <Row style={styles.headerActions}>
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
              <Pressable
                key={route}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => app.navigate(route)}
                style={({ pressed }) => [
                  styles.headerAction,
                  {
                    backgroundColor: dark ? "#2C233DC9" : "#24352CB0",
                    borderColor: dark ? "#6D5A758C" : "#E3EAD46B",
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Icon name={icon} color="#FFF7F3" size={21} />
                {route === "reminders" &&
                  app.data.reminders.some(
                    (reminder) => reminder.enabled === true,
                  ) && <View style={styles.reminderDot} />}
              </Pressable>
            ))}
          </Row>
        </Row>
        <View style={styles.greeting}>
          <AppText variant="label" color="#FFDAA4" style={styles.salutation}>
            {greeting}
          </AppText>
          <AppText
            variant="display"
            accessibilityRole="header"
            color="#FFF9F4"
            style={styles.name}
          >
            {name}.
          </AppText>
          <AppText color="#FFF7F5" style={styles.welcome}>
            A calmer, kinder space for your mind.
          </AppText>
        </View>
      </View>

      <View style={[styles.content, { paddingHorizontal: gutter }]}>
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
                ]}
              >
                <Icon
                  name="pulse-outline"
                  color={dark ? "#E8DBEF" : colors.sageText}
                  size={18}
                />
              </View>
            </Pressable>
          </Row>
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
                labelScaleLimit={moodLabelScale}
                reducedMotion={reducedMotion}
                onPress={() => openCheckin(choice.mood)}
              />
            ))}
          </Row>
        </View>

        <View
          style={[
            styles.focus,
            isAndroid && styles.androidFocus,
            {
              borderColor: dark ? "#A8836F" : "#D0B58C",
              backgroundColor: dark ? "#211D2E" : "#344933",
            },
          ]}
        >
          <Image
            source={artwork[resolved].reset}
            style={coverImageStyle}
            resizeMode="cover"
            accessible={false}
            pointerEvents="none"
            fadeDuration={0}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundImage: dark
                  ? "linear-gradient(90deg, #211C2DF5 0%, #211C2DCC 56%, #221B2A24 100%)"
                  : "linear-gradient(90deg, #14281CF5 0%, #172D20CC 56%, #14281C24 100%)",
              },
            ]}
          />
          <Row style={styles.focusBadge}>
            <Icon name="leaf-outline" size={14} color="#FFDEAD" />
            <AppText variant="label" color="#FFDEAD" style={styles.focusLabel}>
              Today’s Moment
            </AppText>
          </Row>
          <AppText
            variant="title"
            accessibilityRole="header"
            color="#FFF9F4"
            style={[
              styles.focusTitle,
              isAndroid && styles.androidFocusTitle,
              largeText && styles.fullWidth,
            ]}
          >
            {calmReset.title}
          </AppText>
          <AppText
            color="#FFF9F5"
            style={[
              styles.focusDetail,
              isAndroid && styles.androidFocusDetail,
              (compact || largeText) && styles.wideCopy,
            ]}
          >
            A guided pause to slow down and settle.
          </AppText>
          <Row
            style={[styles.focusFooter, isAndroid && styles.androidFocusFooter]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={startMoment}
              style={({ pressed }) => [
                styles.focusAction,
                {
                  backgroundColor: dark ? "#F3D2AE" : "#FFF4DF",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon name="play" color="#2B2137" size={16} />
              <AppText
                variant="label"
                color="#2B2137"
                style={styles.startLabel}
              >
                Start Moment
              </AppText>
            </Pressable>
            <Row style={styles.duration}>
              <Icon name="timer-outline" size={16} color="#FFF5F1" />
              <AppText
                variant="label"
                color="#FFF5F1"
                style={styles.durationText}
              >
                5 min
              </AppText>
            </Row>
          </Row>
        </View>

        <Row style={[styles.quickActions, largeText && styles.wrap]}>
          {quickActions.map((action) => {
            const tone = accents[action.tone];
            return (
              <Pressable
                key={action.title}
                accessibilityRole="button"
                onPress={() => app.navigate(action.route, action.params)}
                style={({ pressed }) => [
                  styles.quickAction,
                  isAndroid && styles.androidQuickAction,
                  largeText && styles.largeQuickAction,
                  {
                    backgroundColor: tone.background,
                    borderColor: tone.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View style={styles.quickIcon}>
                  <Icon name={action.icon} color={tone.icon} size={23} />
                </View>
                <AppText variant="label" style={styles.quickLabel}>
                  {action.title}
                </AppText>
              </Pressable>
            );
          })}
        </Row>

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
                        backgroundColor: dark ? "#C49AF5" : colors.primary,
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

        <TodayHabits surfaceStyle={[panel, dark && styles.journeyDepth]} />
        <View style={[styles.explore, isAndroid && styles.androidSection]}>
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
              onPress={() => app.navigate("explore")}
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
            {exploreShortcuts.map((shortcut) => {
              const art = exploreArt[shortcut.route];
              const fullWidth =
                stackExploreCards || shortcut.route === "checkin";
              const horizontal = fullWidth || inlineExploreCards;
              return (
                <Pressable
                  key={shortcut.route}
                  accessibilityRole="button"
                  accessibilityLabel={shortcut.title}
                  accessibilityHint={art.detail}
                  onPress={() => app.navigate(shortcut.route)}
                  style={({ pressed }) => [
                    styles.exploreCard,
                    horizontal && styles.exploreCardHorizontal,
                    fullWidth && styles.exploreCardFullWidth,
                    {
                      borderColor: dark ? "#6D5B7A75" : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Image
                    source={art.image}
                    style={[
                      coverImageStyle,
                      horizontal && styles.exploreArtHorizontal,
                    ]}
                    resizeMode="cover"
                    accessible={false}
                    pointerEvents="none"
                    fadeDuration={0}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      horizontal
                        ? styles.exploreScrimHorizontal
                        : styles.exploreScrim,
                    ]}
                  />
                  <Icon name={shortcut.icon} color={art.color} size={21} />
                  <View style={horizontal && styles.exploreCardCopy}>
                    <AppText
                      variant="label"
                      color="#FFF9F7"
                      style={styles.exploreCardTitle}
                    >
                      {shortcut.title}
                    </AppText>
                    <AppText
                      variant="caption"
                      color="#E7DCEB"
                      style={styles.exploreDetail}
                    >
                      {art.detail}
                    </AppText>
                  </View>
                  <View
                    pointerEvents="none"
                    style={horizontal ? undefined : styles.exploreChevron}
                  >
                    <Icon name="chevron-forward" size={15} color="#FFF9F7" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
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
  heroFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 42 },
  header: { minHeight: 48, justifyContent: "space-between", gap: 6 },
  brand: { gap: 6, flexShrink: 1 },
  brandName: { fontSize: 24, lineHeight: 28 },
  headerActions: { gap: 4 },
  headerAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#BFDA9B",
  },
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
    textShadowColor: "#120F1C",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  content: { marginTop: -4 },
  fill: { flex: 1, minWidth: 0 },
  unsynced: {
    marginBottom: 12,
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
  largeMood: { flexBasis: "28%", flexGrow: 1 },
  moodTint: { ...StyleSheet.absoluteFill, borderRadius: 17 },
  moodPetal: { width: 29, height: 24 },
  moodText: { textAlign: "center", fontSize: 11, lineHeight: 15 },
  androidMoodText: { alignSelf: "stretch" },
  focus: {
    minHeight: 176,
    marginTop: spacing.section,
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
  focusTitle: { width: "78%", fontSize: 31, lineHeight: 36, marginTop: 4 },
  androidFocus: {
    minHeight: 160,
    marginTop: spacing.card,
    paddingVertical: 9,
  },
  androidFocusTitle: { fontSize: 29 },
  fullWidth: { width: "100%" },
  focusDetail: { maxWidth: "66%", fontSize: 13, lineHeight: 18, marginTop: 3 },
  androidFocusDetail: { maxWidth: "76%" },
  wideCopy: { maxWidth: "90%" },
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
    marginTop: spacing.row,
    alignItems: "stretch",
    gap: spacing.compact,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 74,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    paddingVertical: spacing.compact,
    gap: 4,
    borderWidth: 1,
    borderRadius: 15,
  },
  androidQuickAction: { minHeight: 68, paddingVertical: 6 },
  quickIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  largeQuickAction: { flexBasis: "43%" },
  quickLabel: { textAlign: "center", fontSize: 13, lineHeight: 18 },
  journey: {
    marginTop: spacing.section,
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
    marginTop: spacing.card,
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
  explore: { marginTop: spacing.section },
  androidSection: { marginTop: spacing.screenTop },
  exploreHead: {
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 4,
  },
  exploreTitle: { flex: 1, minWidth: 0, gap: 8 },
  exploreHeading: { flex: 1, fontSize: 19, lineHeight: 24 },
  seeAll: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
  exploreCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
    alignItems: "stretch",
  },
  exploreCard: {
    flexBasis: "44%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    gap: spacing.compact,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#282137",
  },
  exploreCardHorizontal: {
    flexDirection: "row",
    alignItems: "center",
  },
  exploreCardFullWidth: { flexBasis: "100%", gap: spacing.row },
  exploreCardCopy: { flex: 1, minWidth: 0 },
  exploreChevron: {
    position: "absolute",
    top: spacing.compact,
    right: spacing.row,
  },
  exploreArtHorizontal: { left: "36%" },
  exploreScrim: {
    backgroundImage:
      "linear-gradient(180deg, #18122040 0%, #201829C7 42%, #17121FF5 100%)",
  },
  exploreScrimHorizontal: {
    backgroundImage:
      "linear-gradient(90deg, #17121F 0%, #17121F 36%, #201829BA 61%, #18122066 100%)",
  },
  exploreCardTitle: { fontSize: 13, lineHeight: 18 },
  exploreDetail: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  daily: {
    borderWidth: 1,
    borderRadius: 18,
    marginTop: spacing.section,
    padding: spacing.card,
  },
  androidDaily: { marginTop: spacing.screenTop, padding: spacing.row },
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
