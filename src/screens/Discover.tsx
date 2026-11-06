import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { StatusBar } from "expo-status-bar";
import { useReducedMotion } from "../Companion";
import { localDay, recordDay } from "../content";
import { createExplorePractice, exploreShortcuts } from "../explore-practices";
import { journeyRecords } from "../progress";
import { pickDailyRoutine } from "../routine";
import { useApp } from "../store";
import { useTheme } from "../theme";
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

function TodayMoodOption({
  choice: { mood, image },
  status,
  compact,
  largeText,
  reducedMotion,
  onPress,
}: {
  choice: MoodChoice;
  status?: "saved" | "pending";
  compact: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const selected = status !== undefined;
  const [tint] = useState(() => new Animated.Value(selected ? 1 : 0));
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
      }).start();
    },
    [reducedMotion, tint],
  );
  useEffect(() => {
    fadeTint(selected ? 1 : 0);
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
        largeText && styles.largeMood,
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
        style={[styles.moodText, compact && styles.compactMoodText]}
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
  },
  toolkit: {
    image: require("../../assets/today-explore-toolkit.jpg"),
    color: "#B2C7FA",
  },
  checkin: {
    image: require("../../assets/today-explore-checkins.jpg"),
    color: "#FFC782",
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

function useToday() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
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
  const { top } = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const dark = resolved === "dark";
  const largeText = fontScale > 1.2;
  const compact = width < 360;
  const now = useToday();
  const today = localDay(now);
  const [showReason, setShowReason] = useState(false);
  const routine = useMemo(
    () => pickDailyRoutine(app.data, app.user, now),
    [app.data, app.user, now],
  );
  const selectedCheckin = useMemo(
    () =>
      journeyRecords({ checkins: app.data.checkins }, now, true).checkins.find(
        (record) => recordDay(record) === today,
      ),
    [app.data.checkins, now, today],
  );
  const environment = app.data.preferences.find(
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
  const stepCount = routine.steps.length;
  const progress = (routine.completedCount / stepCount) * 100;
  const stepLabel = routine.completedCount + " of " + stepCount + " steps";
  const panel = {
    backgroundColor: dark ? "#211C2B" : colors.surface,
    borderColor: dark ? "#51415E" : colors.heroBorder,
  };
  const secondary = dark ? "#CEC4DA" : colors.heroMuted;
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
        provider: "offline",
        source: "today",
      },
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
    <Screen edgeToEdge style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.hero, { paddingTop: top + 3 }]}>
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

      <View style={styles.content}>
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

        <View style={[styles.moods, panel, dark && styles.moodDepth]}>
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
          <Row style={[styles.moodRow, largeText && styles.wrap]}>
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
                compact={compact}
                largeText={largeText}
                reducedMotion={reducedMotion}
                onPress={() => openCheckin(choice.mood)}
              />
            ))}
          </Row>
        </View>

        <View
          style={[
            styles.focus,
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
                  ? "linear-gradient(90deg, #211C2DEB 0%, #211C2DAB 44%, #221B2A00 83%)"
                  : "linear-gradient(90deg, #14281CEB 0%, #172D20AB 44%, #14281C00 85%)",
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
            style={[styles.focusTitle, largeText && styles.fullWidth]}
          >
            {calmReset.title}
          </AppText>
          <AppText
            color="#FFF9F5"
            style={[
              styles.focusDetail,
              (compact || largeText) && styles.wideCopy,
            ]}
          >
            A 5-minute guided pause to slow down and settle.
          </AppText>
          <Row style={styles.focusFooter}>
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
                  largeText && styles.largeQuickAction,
                  {
                    backgroundColor: tone.background,
                    borderColor: tone.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon name={action.icon} color={tone.icon} size={25} />
                <AppText variant="label" style={styles.quickLabel}>
                  {action.title}
                </AppText>
              </Pressable>
            );
          })}
        </Row>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Your Journey. " + stepLabel + " completed today"}
          onPress={() => app.navigate("journey")}
          style={({ pressed }) => [
            styles.journey,
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
              Build a consistent wellbeing routine.
            </AppText>
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
          </View>
          <Icon name="chevron-forward" size={17} />
        </Pressable>

        <View style={styles.explore}>
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
          <Row style={[styles.exploreCards, largeText && styles.wrap]}>
            {exploreShortcuts.map((shortcut) => {
              const art = exploreArt[shortcut.route];
              return (
                <Pressable
                  key={shortcut.route}
                  accessibilityRole="button"
                  accessibilityLabel={shortcut.title}
                  onPress={() => app.navigate(shortcut.route)}
                  style={({ pressed }) => [
                    styles.exploreCard,
                    largeText && styles.largeExploreCard,
                    {
                      borderColor: dark ? "#6D5B7A75" : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Image
                    source={art.image}
                    style={coverImageStyle}
                    resizeMode="cover"
                    accessible={false}
                    pointerEvents="none"
                    fadeDuration={0}
                  />
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.exploreScrim]}
                  />
                  <Icon name={shortcut.icon} color={art.color} size={23} />
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
                    {shortcut.route === "checkin"
                      ? "Track your mood"
                      : shortcut.detail}
                  </AppText>
                </Pressable>
              );
            })}
          </Row>
        </View>

        <View style={[styles.daily, { borderTopColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              next
                ? app.navigate(next.route, next.params)
                : app.navigate("breathing", { durationSec: 180 })
            }
            style={({ pressed }) => [
              styles.dailyAction,
              { opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <View style={styles.fill}>
              <AppText variant="heading" style={styles.journeyTitle}>
                Your Daily Pause
              </AppText>
              <AppText variant="caption" color={secondary}>
                {next?.id === "practice"
                  ? routine.suggestion.title
                  : next
                    ? next.title
                    : "Complete for today. Take another pause anytime."}
              </AppText>
            </View>
            <Icon name="chevron-forward" size={16} />
          </Pressable>
          {next?.id === "practice" && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showReason }}
                onPress={() => setShowReason((value) => !value)}
                style={styles.reason}
              >
                <AppText variant="caption" color={secondary}>
                  Why this pause?
                </AppText>
                <Icon
                  name={showReason ? "chevron-up" : "chevron-down"}
                  color={secondary}
                  size={13}
                />
              </Pressable>
              {showReason && (
                <AppText variant="caption" color={secondary}>
                  {routine.suggestion.reason}
                </AppText>
              )}
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 22 },
  hero: { overflow: "hidden", paddingHorizontal: 18, paddingBottom: 23 },
  heroFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 42 },
  header: { minHeight: 44, justifyContent: "space-between", gap: 6 },
  brand: { gap: 6, flexShrink: 1 },
  brandName: { fontSize: 24, lineHeight: 28 },
  headerActions: { gap: 4 },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  name: { fontSize: 41, lineHeight: 44, marginTop: 1 },
  welcome: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: "77%",
    textShadowColor: "#120F1C",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  content: { paddingHorizontal: 12, marginTop: -4 },
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
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  moodDepth: {
    backgroundImage:
      "linear-gradient(140deg, #2D233B 0%, #211B2A 53%, #201A28 100%)",
  },
  moodHead: { justifyContent: "space-between", gap: 4 },
  moodHeading: { flex: 1, fontSize: 21, lineHeight: 26 },
  moodEntry: {
    minHeight: 44,
    minWidth: 44,
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
  moodRow: { gap: 6, alignItems: "stretch" },
  wrap: { flexWrap: "wrap" },
  mood: {
    flex: 1,
    minWidth: 0,
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 2,
    paddingVertical: 5,
    gap: 3,
  },
  largeMood: { flexBasis: "28%", flexGrow: 1 },
  moodTint: { ...StyleSheet.absoluteFill, borderRadius: 17 },
  moodPetal: { width: 29, height: 24 },
  moodText: { textAlign: "center", fontSize: 11, lineHeight: 15 },
  compactMoodText: { fontSize: 10 },
  focus: {
    minHeight: 152,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
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
  focusLabel: { fontSize: 10.5, lineHeight: 14 },
  focusTitle: { width: "78%", fontSize: 29, lineHeight: 32, marginTop: 4 },
  fullWidth: { width: "100%" },
  focusDetail: { maxWidth: "66%", fontSize: 12, lineHeight: 15, marginTop: 2 },
  wideCopy: { maxWidth: "90%" },
  focusFooter: {
    marginTop: 5,
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  focusAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 5,
    minHeight: 44,
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
  quickActions: { marginTop: 12, alignItems: "stretch", gap: 8 },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    paddingVertical: 7,
    gap: 3,
    borderWidth: 1,
    borderRadius: 15,
  },
  largeQuickAction: { flexBasis: "43%" },
  quickLabel: { textAlign: "center", fontSize: 13, lineHeight: 18 },
  journey: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  journeyDepth: {
    backgroundImage:
      "linear-gradient(140deg, #2B2536 0%, #191723 73%, #24222C 100%)",
    borderColor: "#494153",
  },
  journeyIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyTitle: { fontSize: 19, lineHeight: 23 },
  journeyDetail: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  progressRow: { marginTop: 3, gap: 7 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { flexShrink: 1, fontSize: 10.5, lineHeight: 14 },
  explore: { marginTop: 10 },
  exploreHead: {
    justifyContent: "space-between",
    gap: 4,
    paddingHorizontal: 3,
  },
  exploreTitle: { flex: 1, minWidth: 0, gap: 8 },
  exploreHeading: { flex: 1, fontSize: 19, lineHeight: 24 },
  seeAll: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 11.5, lineHeight: 16 },
  exploreCards: { gap: 8, alignItems: "stretch" },
  exploreCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    paddingHorizontal: 9,
    paddingTop: 12,
    paddingBottom: 9,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#282137",
  },
  largeExploreCard: { flexBasis: "45%" },
  exploreScrim: {
    backgroundImage:
      "linear-gradient(180deg, #18122020 0%, #201829B0 42%, #17121FF5 100%)",
  },
  exploreCardTitle: { fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  exploreDetail: { fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  daily: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 7,
    paddingHorizontal: 3,
  },
  dailyAction: {
    flexDirection: "row",
    minHeight: 48,
    alignItems: "center",
    gap: 8,
  },
  reason: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
});
