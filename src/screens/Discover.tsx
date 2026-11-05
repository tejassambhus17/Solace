import React, { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { localDay, recordDay } from "../content";
import { createExplorePractice } from "../explore-practices";
import { weeklyReview } from "../insights";
import { journeyRecords, journeySummary } from "../progress";
import { pickDailyRoutine } from "../routine";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
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
    detail: "Relax & reset",
    icon: "leaf-outline",
    route: "breathing",
    params: { durationSec: 180 },
    tone: "sage",
  },
  {
    title: "Reflect",
    detail: "Write a thought",
    icon: "create-outline",
    route: "reflection",
    params: {},
    tone: "lavender",
  },
  {
    title: "Sleep",
    detail: "Wind down",
    icon: "moon-outline",
    route: "sleep",
    params: {},
    tone: "peach",
  },
  {
    title: "Focus",
    detail: "Stay present",
    icon: "locate-outline",
    route: "grounding",
    params: {},
    tone: "sage",
  },
] as const;

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
    scene: require("../../assets/redesign-today-scene-dark.jpg"),
    reset: require("../../assets/redesign-reset-dark.jpg"),
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

const gaugeSize = 43;

function JourneyGauge({
  value,
  track,
  fill,
}: {
  value: number;
  track: string;
  fill: string;
}) {
  const degrees = value * 3.6;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={styles.gauge}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.gaugeTrack,
          { borderColor: track },
        ]}
      />
      {value > 0 && (
        <View style={[styles.gaugeClip, { left: gaugeSize / 2 }]}>
          <View
            style={[
              styles.gaugeArc,
              {
                left: -gaugeSize / 2,
                borderTopColor: fill,
                borderLeftColor: fill,
                transform: [{ rotate: Math.min(180, degrees) - 45 + "deg" }],
              },
            ]}
          />
        </View>
      )}
      {degrees > 180 && (
        <View style={[styles.gaugeClip, { left: 0 }]}>
          <View
            style={[
              styles.gaugeArc,
              {
                borderTopColor: fill,
                borderLeftColor: fill,
                transform: [{ rotate: degrees - 45 + "deg" }],
              },
            ]}
          />
        </View>
      )}
      <AppText variant="label" style={styles.gaugeValue}>
        {value}%
      </AppText>
    </View>
  );
}

export function TodayScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { fontScale } = useWindowDimensions();
  const dark = resolved === "dark";
  const largeText = fontScale > 1.3;
  const now = useToday();
  const today = localDay(now);
  const [focusPage, setFocusPage] = useState(0);
  const [showReason, setShowReason] = useState(false);
  const routine = useMemo(
    () => pickDailyRoutine(app.data, app.user, now),
    [app.data, app.user, now],
  );
  const summary = useMemo(() => journeySummary(app.data, now), [app.data, now]);
  const week = useMemo(
    () => weeklyReview(summary.records, now),
    [summary.records, now],
  );
  const recentMood = summary.records.checkins.find((record) =>
    moodPetals.some(({ mood }) => mood === record.mood),
  );
  const selectedCheckin = useMemo(
    () =>
      journeyRecords({ checkins: app.data.checkins }, now, true).checkins.find(
        (record) => recordDay(record) === today,
      ),
    [app.data.checkins, now, today],
  );
  const preference = app.data.preferences.find(
    (item) => item.id === "wellness",
  );
  const showStreak = preference?.streaksEnabled === true;
  const environment = preference?.environment;
  const name =
    String(app.user?.name || "")
      .trim()
      .split(/\s+/)[0] || "Friend";
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const next = routine.nextStep;
  const progress = Math.round(
    (routine.completedCount / routine.steps.length) * 100,
  );
  const tones = {
    sage: { surface: colors.sageSurface, text: colors.sageText },
    lavender: { surface: colors.lavenderSurface, text: colors.lavenderText },
    peach: { surface: colors.peachSurface, text: colors.peachText },
  };
  const panel = {
    backgroundColor: dark ? colors.surface : "#F8EEE3",
    borderColor: dark ? colors.border : "#FFFBF4",
    boxShadow: dark ? undefined : "0 7px 16px rgba(91,60,38,0.09)",
  };
  const stats = [
    {
      icon: "leaf-outline",
      title: showStreak
        ? summary.streak
          ? "Day " + summary.streak
          : "0 days"
        : week.daysCheckedIn + (week.daysCheckedIn === 1 ? " day" : " days"),
      detail: showStreak ? "Check-in streak" : "Checked in",
      label: showStreak
        ? summary.streak + " consecutive check-in days"
        : week.daysCheckedIn + " check-in days this week",
    },
    {
      icon: "stats-chart",
      title:
        week.completedMoments +
        (week.completedMoments === 1 ? " Moment" : " Moments"),
      detail: "This week",
      label: week.completedMoments + " completed Moments this week",
    },
    {
      icon: "flower-outline",
      title: recentMood?.mood ?? "No check-in",
      detail: "Recent mood",
      label: recentMood
        ? "Recent mood " + recentMood.mood
        : "No mood check-in yet",
    },
  ];
  const focusChoices = [
    {
      title: calmReset.title,
      detail: "A 5-minute guided pause to slow down and settle.",
      action: "Start Moment",
      icon: "play",
      open: () =>
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
        }),
    },
    {
      title:
        next?.id === "practice" ? routine.suggestion.title : "Your Daily Pause",
      detail:
        next?.id === "checkin"
          ? "Start by noticing how you feel today."
          : next?.id === "reflection"
            ? "Make a little room for what you noticed today."
            : next
              ? "A suggested practice for today · " +
                routine.suggestion.duration
              : "Your daily pause is complete. Take another moment if you like.",
      action:
        next?.id === "checkin"
          ? "Start check-in"
          : next?.id === "reflection"
            ? "Start writing"
            : "Take a moment",
      icon: "arrow-forward",
      open: () =>
        next
          ? app.navigate(next.route, next.params)
          : app.navigate("breathing", { durationSec: 180 }),
    },
    {
      title: "Make It Yours",
      detail: "Find a Solace Moment for how you feel right now.",
      action: "Create a Moment",
      icon: "sparkles-outline",
      open: () => app.navigate("moments"),
    },
  ];
  const focus = focusChoices[focusPage];
  useEffect(
    () => setShowReason(false),
    [today, routine.suggestion.activity, next?.id, focusPage],
  );
  const openJourney = () => app.navigate("journey");

  return (
    <Screen
      style={styles.screen}
      contentContainerStyle={{ backgroundColor: colors.bg }}
    >
      <View style={styles.content}>
        <View style={styles.hero}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.scene}
          >
            <Image
              source={artwork[resolved].scene}
              style={styles.art}
              resizeMode="cover"
              accessible={false}
              fadeDuration={0}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundImage:
                    "linear-gradient(90deg, rgba(15,29,23,0.58) 0%, rgba(15,29,23,0.34) 48%, rgba(15,29,23,0) 90%)",
                },
              ]}
            />
            <View
              style={[
                styles.sceneFade,
                {
                  backgroundImage:
                    "linear-gradient(180deg, transparent 0%, " +
                    colors.bg +
                    " 100%)",
                },
              ]}
            />
          </View>
          <Row style={styles.header}>
            <Row style={styles.brand}>
              <LotusMark size={31} />
              <AppText
                variant="heading"
                color="#FFF9EE"
                style={styles.brandName}
              >
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
                    { opacity: pressed ? 0.72 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.headerDisc,
                      {
                        backgroundColor: dark ? "#24252AE8" : "#FFF6E8EA",
                        borderColor: dark ? "#565258" : "#FFFDF7",
                      },
                    ]}
                  >
                    <Icon
                      name={icon}
                      color={dark ? colors.text : "#272C20"}
                      size={18}
                    />
                    {route === "reminders" &&
                      app.data.reminders.some(
                        (reminder) => reminder.enabled === true,
                      ) && (
                        <View
                          style={[
                            styles.reminderDot,
                            { backgroundColor: colors.sageText },
                          ]}
                        />
                      )}
                  </View>
                </Pressable>
              ))}
            </Row>
          </Row>
          <View style={styles.greeting}>
            <AppText variant="label" color="#FFF0D5" style={styles.eyebrow}>
              {greeting}
            </AppText>
            <AppText
              variant="display"
              accessibilityRole="header"
              color="#FFF9EE"
              style={styles.name}
            >
              {name}.
            </AppText>
            <AppText color="#FFF9EE" style={styles.welcome}>
              A quieter, kinder space for your mind.
            </AppText>
          </View>

          <Row style={[styles.stats, largeText && styles.wrap]}>
            {stats.map((stat, index) => (
              <Pressable
                key={stat.icon}
                accessibilityRole="button"
                accessibilityLabel={stat.label + ". Open Journey"}
                onPress={openJourney}
                style={({ pressed }) => [
                  styles.stat,
                  panel,
                  largeText && styles.largeStat,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.statIcon,
                    {
                      backgroundColor:
                        index === 2 ? colors.peachSurface : colors.sageSurface,
                    },
                  ]}
                >
                  <Icon name={stat.icon} color={colors.sageText} size={17} />
                </View>
                <View style={styles.statWords}>
                  <AppText variant="label" style={styles.statTitle}>
                    {stat.title}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={colors.muted}
                    style={styles.statDetail}
                  >
                    {stat.detail}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </Row>
        </View>

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
              style={{ flex: 1 }}
            >
              {app.pendingWrites.length === 1
                ? "1 entry is"
                : app.pendingWrites.length + " entries are"}{" "}
              waiting to sync.
            </AppText>
            <Icon name="chevron-forward" color={colors.peachText} size={15} />
          </Pressable>
        )}

        <View style={[styles.moods, panel]}>
          <Row style={styles.sectionHead}>
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={styles.moodHeading}
            >
              How are you feeling today?
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check-in"
              onPress={() => app.navigate("checkin")}
              style={({ pressed }) => [
                styles.checkAction,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Row
                style={[
                  styles.checkPill,
                  { backgroundColor: colors.sageSurface },
                ]}
              >
                <Icon name="pulse-outline" color={colors.sageText} size={15} />
                <AppText
                  variant="label"
                  color={colors.sageText}
                  style={styles.checkText}
                >
                  Check-in
                </AppText>
              </Row>
            </Pressable>
          </Row>
          <Row style={[styles.moodRow, largeText && styles.wrap]}>
            {moodPetals.map(({ mood, image }) => {
              const selected = selectedCheckin?.mood === mood;
              return (
                <Pressable
                  key={mood}
                  accessibilityRole="button"
                  accessibilityLabel={
                    "Check in: " +
                    mood +
                    (selected
                      ? selectedCheckin.localOnly
                        ? ". Your latest mood today, waiting to sync"
                        : ". Your last saved mood today"
                      : "")
                  }
                  accessibilityState={{ selected }}
                  onPress={() => app.navigate("checkin", { mood })}
                  style={({ pressed }) => [
                    styles.mood,
                    largeText && styles.largeMood,
                    {
                      backgroundColor: selected
                        ? colors.lavenderSurface
                        : dark
                          ? colors.surface2
                          : "#FFF8ED80",
                      borderColor: selected
                        ? colors.lavenderText
                        : dark
                          ? colors.border
                          : "#FFFBF4",
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <MoodPetal source={image} style={styles.moodPetal} />
                  <AppText
                    variant={selected ? "label" : "caption"}
                    color={selected ? colors.lavenderText : colors.text}
                    style={styles.moodText}
                  >
                    {mood}
                  </AppText>
                </Pressable>
              );
            })}
          </Row>
        </View>

        <View
          style={[
            styles.focus,
            {
              borderColor: dark ? "#655044" : "#FFF0D2",
              backgroundColor: dark ? "#19171B" : "#344933",
              boxShadow: dark
                ? "0 7px 17px rgba(0,0,0,0.48)"
                : "0 8px 19px rgba(118,87,48,0.24)",
            },
          ]}
        >
          <Image
            source={artwork[resolved].reset}
            style={styles.art}
            resizeMode="cover"
            accessible={false}
            fadeDuration={0}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundImage:
                  "linear-gradient(90deg, rgba(15,34,25,0.68) 0%, rgba(15,34,25,0.46) 47%, rgba(15,34,25,0) 78%)",
              },
            ]}
          />
          <View style={styles.focusBadge}>
            <Icon name="locate-outline" size={14} color="#FFF8E8" />
            <AppText variant="label" color="#FFF8E8" style={styles.focusLabel}>
              Today’s Focus
            </AppText>
          </View>
          <AppText
            variant="title"
            accessibilityRole="header"
            color="#FFFAEE"
            style={styles.focusTitle}
          >
            {focus.title}
          </AppText>
          <AppText color="#FFF8EB" style={styles.focusDetail}>
            {focus.detail}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={focus.action}
            onPress={focus.open}
            style={({ pressed }) => [
              styles.focusAction,
              {
                backgroundColor: dark ? colors.primary : "#FFF6E7",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Icon
              name={focus.icon}
              color={dark ? colors.primaryText : "#223222"}
              size={17}
            />
            <AppText
              variant="label"
              color={dark ? colors.primaryText : "#1F291F"}
              style={{ flexShrink: 1 }}
            >
              {focus.action}
            </AppText>
          </Pressable>
        </View>
        <Row style={styles.pager}>
          {focusChoices.map((choice, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={"Show focus: " + choice.title}
              accessibilityState={{ selected: focusPage === index }}
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={() => setFocusPage(index)}
              style={styles.pageButton}
            >
              <View
                style={[
                  styles.pageDot,
                  {
                    width: focusPage === index ? 12 : 6,
                    backgroundColor:
                      focusPage === index
                        ? colors.primary
                        : dark
                          ? "#665752"
                          : "#B69A7A",
                  },
                ]}
              />
            </Pressable>
          ))}
        </Row>
        {focusPage === 1 && next?.id === "practice" && (
          <View style={styles.reason}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showReason }}
              onPress={() => setShowReason((value) => !value)}
              style={styles.reasonButton}
            >
              <AppText variant="caption" color={colors.muted}>
                Why this pause?
              </AppText>
              <Icon
                name={showReason ? "chevron-up" : "chevron-down"}
                size={12}
                color={colors.muted}
              />
            </Pressable>
            {showReason && (
              <AppText variant="caption" color={colors.muted}>
                {routine.suggestion.reason}
              </AppText>
            )}
          </View>
        )}

        <Row style={styles.quickHead}>
          <Row style={styles.quickTitle}>
            <Icon name="flash-outline" size={21} color={colors.primary} />
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={styles.quickHeading}
            >
              Quick Actions
            </AppText>
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all practices"
            onPress={() => app.navigate("explore")}
            style={styles.seeAll}
          >
            <AppText variant="caption">See All</AppText>
            <Icon name="arrow-forward" size={14} />
          </Pressable>
        </Row>
        <Row style={[styles.quickActions, largeText && styles.wrap]}>
          {quickActions.map((action) => {
            const tone = tones[action.tone];
            return (
              <Pressable
                key={action.title}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                onPress={() => app.navigate(action.route, action.params)}
                style={({ pressed }) => [
                  styles.quickAction,
                  panel,
                  largeText && styles.largeStat,
                  {
                    backgroundColor: tone.surface,
                    opacity: pressed ? 0.74 : 1,
                  },
                ]}
              >
                <Icon name={action.icon} color={tone.text} size={23} />
                <AppText variant="label" style={styles.quickLabel}>
                  {action.title}
                </AppText>
                <AppText
                  variant="caption"
                  color={tone.text}
                  style={styles.quickDetail}
                >
                  {action.detail}
                </AppText>
              </Pressable>
            );
          })}
        </Row>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            "Your Wellness Journey. " +
            routine.completedCount +
            " of " +
            routine.steps.length +
            " daily steps recorded"
          }
          onPress={openJourney}
          style={({ pressed }) => [
            styles.journey,
            panel,
            { opacity: pressed ? 0.76 : 1 },
          ]}
        >
          <View
            style={[
              styles.journeyIcon,
              { backgroundColor: colors.sageSurface },
            ]}
          >
            <Icon name="trail-sign-outline" color={colors.sageText} size={23} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="heading" style={styles.journeyTitle}>
              Your Wellness Journey
            </AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={styles.journeyDetail}
            >
              {routine.completedCount} of {routine.steps.length} daily steps
              recorded
            </AppText>
          </View>
          <JourneyGauge
            value={progress}
            track={colors.border}
            fill={colors.primary}
          />
          <Icon name="arrow-forward" size={16} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 16,
    overflow: "hidden",
  },
  scene: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  art: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  sceneFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "32%",
  },
  content: { paddingHorizontal: 17 },
  hero: { marginHorizontal: -17, paddingHorizontal: 17 },
  header: { justifyContent: "space-between", paddingLeft: 9, paddingTop: 9 },
  brand: { gap: 5 },
  brandName: {
    fontSize: 24,
    lineHeight: 29,
    textShadowColor: "#293125",
    textShadowRadius: 7,
    textShadowOffset: { width: 0, height: 1 },
  },
  headerActions: { gap: 0 },
  headerAction: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  greeting: { paddingHorizontal: 10, marginTop: 1, marginBottom: 14 },
  eyebrow: {
    fontSize: 9.5,
    lineHeight: 13,
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  name: {
    fontSize: 42,
    lineHeight: 44,
    textShadowColor: "#334237",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  welcome: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 2,
    textShadowColor: "#2C372D",
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 1 },
  },
  stats: { gap: 6, alignItems: "stretch", marginBottom: 10 },
  wrap: { flexWrap: "wrap" },
  stat: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 1,
  },
  largeStat: { minWidth: "45%" },
  statIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statWords: { flex: 1, minWidth: 0, gap: 1 },
  statTitle: { fontSize: 11.5, lineHeight: 14 },
  statDetail: { fontSize: 9, lineHeight: 12 },
  unsynced: {
    marginBottom: 10,
    borderRadius: 16,
    minHeight: 44,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 9,
  },
  moods: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  sectionHead: { justifyContent: "space-between", gap: 6, paddingLeft: 3 },
  moodHeading: { fontSize: 20, lineHeight: 23, flex: 1 },
  checkAction: { minHeight: 44, justifyContent: "center" },
  checkPill: {
    borderRadius: 18,
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  checkText: { fontSize: 10.5, lineHeight: 16 },
  moodRow: { alignItems: "stretch", gap: 6 },
  mood: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    gap: 1,
  },
  largeMood: { minWidth: "29%" },
  moodPetal: { width: "83%", height: 30, maxWidth: 40 },
  moodText: { fontSize: 10.5, lineHeight: 15, textAlign: "center" },
  focus: {
    marginTop: 10,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 145,
    paddingHorizontal: 19,
    paddingVertical: 11,
    alignItems: "flex-start",
  },
  focusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: "#263A25A6",
    borderWidth: 1,
    borderColor: "#E7E4B451",
  },
  focusLabel: { fontSize: 9.5, lineHeight: 15 },
  focusTitle: {
    fontSize: 29,
    lineHeight: 31,
    maxWidth: "74%",
    marginTop: 5,
    textShadowColor: "#142519",
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 1 },
  },
  focusDetail: {
    maxWidth: "63%",
    fontSize: 11.5,
    lineHeight: 15.5,
    marginTop: 3,
  },
  focusAction: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 3,
    marginTop: 8,
    maxWidth: "90%",
  },
  pager: { justifyContent: "center", gap: 0, height: 28 },
  pageButton: {
    height: 28,
    width: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  pageDot: { height: 6, borderRadius: 4 },
  reason: { marginBottom: 3, paddingHorizontal: 5 },
  reasonButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickHead: {
    justifyContent: "space-between",
    minHeight: 35,
    paddingHorizontal: 3,
  },
  quickTitle: { flex: 1, minWidth: 0, gap: 6 },
  quickHeading: { fontSize: 20, lineHeight: 24, flexShrink: 1 },
  seeAll: { minHeight: 44, flexDirection: "row", gap: 4, alignItems: "center" },
  quickActions: { alignItems: "stretch", gap: 7 },
  quickAction: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 67,
    paddingHorizontal: 3,
    paddingVertical: 5,
    gap: 1,
  },
  quickLabel: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 3,
    textAlign: "center",
  },
  quickDetail: { fontSize: 9, lineHeight: 13, textAlign: "center" },
  journey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    minHeight: 57,
    marginTop: 11,
    borderRadius: 19,
    borderWidth: 1,
  },
  journeyIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyTitle: { fontSize: 19, lineHeight: 22 },
  journeyDetail: { fontSize: 10, lineHeight: 14 },
  gauge: {
    width: gaugeSize,
    height: gaugeSize,
    justifyContent: "center",
    alignItems: "center",
  },
  gaugeTrack: { borderWidth: 3.5, borderRadius: gaugeSize / 2 },
  gaugeClip: {
    position: "absolute",
    width: gaugeSize / 2,
    height: gaugeSize,
    top: 0,
    overflow: "hidden",
  },
  gaugeArc: {
    position: "absolute",
    left: 0,
    top: 0,
    width: gaugeSize,
    height: gaugeSize,
    borderWidth: 3.5,
    borderRadius: gaugeSize / 2,
    borderColor: "transparent",
  },
  gaugeValue: { fontSize: 10.5, lineHeight: 13 },
});

export { ExploreScreen } from "./Explore";
