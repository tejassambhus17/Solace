import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { savedWeeklyStory } from "../../server/src/weekly-facts";
import { useReducedMotion, Companion } from "../Companion";
import { localDay } from "../content";
import {
  adjacentJourneyDay,
  journeyAnalytics,
  journeyCalendar,
  journeyReport,
  journeyWeek,
  type JourneyPeriod,
} from "../journey-analytics";
import { journeyGoalProgress, selectJourneyGoal } from "../journey-goals";
import { spacing, useScreenGutter } from "../layout";
import { momentClockText } from "../moments";
import {
  activeSeconds,
  isCompletedMoment,
  journeySummary,
  type DayEntry,
} from "../progress";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { reflectionPeriodLabel } from "../weekly-story";
import {
  AppText,
  Button,
  Icon,
  LotusMark,
  Row,
  Screen,
  coverImageStyle,
} from "../ui";

const periods = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
] as const;
const metrics = [
  {
    key: "checkinDays",
    label: "Check-in days",
    icon: "leaf-outline",
    filter: "checkins",
  },
  {
    key: "moments",
    label: "Moments",
    icon: "flower-outline",
    filter: "moments",
  },
  {
    key: "seconds",
    label: "Mindful time",
    icon: "time-outline",
    filter: "timed",
  },
] as const;
const artwork = {
  light: {
    hero: require("../../assets/profile-mountains-light.jpg"),
    reflection: require("../../assets/redesign-reset-light.jpg"),
  },
  dark: {
    hero: require("../../assets/profile-mountains-dark.jpg"),
    reflection: require("../../assets/today-twilight-lotus.jpg"),
  },
};
const tones = {
  light: [
    { base: "#EAF0DD", border: "#D8E4CF", ink: "#43743F" },
    { base: "#FBE3D6", border: "#F1CDBB", ink: "#AE543B" },
    { base: "#F1E5F6", border: "#E6D3F0", ink: "#704293" },
  ],
  dark: [
    { base: "#252A30", border: "#4D6059", ink: "#B9EEA8" },
    { base: "#382634", border: "#6B4D61", ink: "#FFCAA9" },
    { base: "#302440", border: "#625075", ink: "#E5BFFF" },
  ],
};
const formatDay = (
  day: string,
  options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  },
) => new Date(day + "T12:00:00").toLocaleDateString(undefined, options);

function useJourneyClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, []);
  return now;
}

function useJourneyPeriod(owner?: string) {
  const key = owner ? "solace.journey.period." + owner : null;
  const [period, setPeriod] = useState<JourneyPeriod>("week");
  const chosen = useRef(false);
  useEffect(() => {
    if (!key) return;
    let active = true;
    chosen.current = false;
    AsyncStorage.getItem(key)
      .then((value) => {
        if (
          active &&
          !chosen.current &&
          (value === "week" || value === "month" || value === "all")
        )
          setPeriod(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key]);
  return {
    period,
    selectPeriod(value: JourneyPeriod) {
      chosen.current = true;
      setPeriod(value);
      if (key) void AsyncStorage.setItem(key, value).catch(() => {});
    },
  };
}

function PeriodControl({
  period,
  onChange,
  base,
  ink,
}: {
  period: JourneyPeriod;
  onChange: (value: JourneyPeriod) => void;
  base: string;
  ink: string;
}) {
  const { colors, resolved } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = periods.findIndex((value) => value.id === period);
  const [position] = useState(() => new Animated.Value(index));
  useEffect(() => {
    if (reduced) {
      position.setValue(index);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: index,
      duration: 170,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [position, index, reduced]);
  const segment = (width - 6) / periods.length;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Journey reporting period"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.segments,
        {
          backgroundColor: resolved === "dark" ? "#393048E6" : "#FFF8F0E8",
          borderColor: colors.border,
        },
      ]}
    >
      {width > 6 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            {
              width: segment,
              backgroundColor: base,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 2],
                    outputRange: [0, segment * 2],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {periods.map(({ id, label }) => (
        <Pressable
          key={id}
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ checked: id === period }}
          aria-checked={id === period}
          onPress={() => onChange(id)}
          style={styles.segment}
        >
          <AppText
            variant={id === period ? "label" : "caption"}
            color={id === period && width > 6 ? ink : colors.text}
            style={styles.segmentLabel}
          >
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

function ProgressRing({
  value,
  ink,
  track,
}: {
  value: number;
  ink: string;
  track: string;
}) {
  const angle = value * 3.6;
  return (
    <View
      style={styles.ring}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.ringCircle, { borderColor: track }]} />
      {value > 0 && (
        <View style={[styles.ringHalf, { left: 21 }]}>
          <View
            style={[
              styles.ringArc,
              {
                left: -21,
                borderTopColor: ink,
                borderLeftColor: ink,
                transform: [{ rotate: Math.min(angle, 180) - 45 + "deg" }],
              },
            ]}
          />
        </View>
      )}
      {value > 50 && (
        <View style={styles.ringHalf}>
          <View
            style={[
              styles.ringArc,
              {
                borderTopColor: ink,
                borderLeftColor: ink,
                transform: [{ rotate: angle - 45 + "deg" }],
              },
            ]}
          />
        </View>
      )}
      <AppText variant="label" style={styles.ringText}>
        {value}%
      </AppText>
    </View>
  );
}

function compareText(value: number, timed: boolean, period: JourneyPeriod) {
  if (value === 0) return "Same as last " + period;
  const magnitude = Math.abs(value);
  const units = timed
    ? magnitude >= 60
      ? Math.floor(magnitude / 60) + " min"
      : Math.floor(magnitude) + " sec"
    : String(magnitude);
  return (value > 0 ? "+" : "−") + units + " vs last " + period;
}

function counted(value: number, label: string) {
  return value + " " + label + (value === 1 ? "" : "s");
}
function HistoryEntry({ entry }: { entry: DayEntry }) {
  const app = useApp();
  const { colors } = useTheme();
  const { record, collection } = entry;
  const title =
    collection === "checkins"
      ? `${record.mood || "Saved"} check-in`
      : collection === "sessions"
        ? record.title || record.activity?.title || "A moment for you"
        : collection === "reflections"
          ? "A saved reflection"
          : record.title || "A reflective check-in";
  const icon =
    collection === "checkins"
      ? "sunny-outline"
      : collection === "sessions"
        ? "leaf-outline"
        : collection === "reflections"
          ? "create-outline"
          : "clipboard-outline";
  const seconds = collection === "sessions" ? activeSeconds(record) : 0;
  const detail =
    collection === "sessions"
      ? record.type === "resource"
        ? record.completed
          ? "Guide completed"
          : "Partial guide progress"
        : `${record.completed === true ? "Completed" : "Ended early"}${record.feedback ? ` · ${record.feedback === "skipped" ? "No helpfulness rating" : record.feedback}` : ""}`
      : collection === "checkins"
        ? record.note || "Your own check-in, in your own words."
        : collection === "reflections"
          ? record.text ||
            record.content ||
            record.note ||
            "Open your reflection"
          : "A self-reported reflection, not a diagnosis.";
  const duration = seconds ? ` · ${momentClockText(seconds)} active` : "";
  const subtitle = `${record.localOnly ? "Waiting to sync. " : ""}${detail}${duration}`;
  const open =
    collection === "sessions"
      ? () => app.navigate("session-detail", { id: record.id })
      : collection === "reflections"
        ? () => app.navigate("reflection-detail", { id: record.id })
        : collection === "assessments"
          ? () =>
              app.navigate("assessment-result", {
                id: record.id,
                type: record.assessmentType || record.type,
              })
          : undefined;
  return (
    <Pressable
      accessibilityRole={open ? "button" : undefined}
      accessibilityLabel={`${title}. ${subtitle}`}
      disabled={!open}
      onPress={open}
      style={({ pressed }) => ({
        paddingVertical: 14,
        borderBottomWidth: 0.75,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ width: 34, paddingTop: 2 }}>
          <Icon name={icon} size={21} color={colors.muted} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption" color={colors.muted} numberOfLines={3}>
            {subtitle}
          </AppText>
        </View>
        {open && <Icon name="chevron-forward" size={17} color={colors.muted} />}
      </Row>
    </Pressable>
  );
}

export function JourneyActivityScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const now = useJourneyClock();
  const analytics = useMemo(
    () => journeyAnalytics(app.data, now),
    [app.data, now],
  );
  const { filter, startDay, endDay, day } = app.params || {};
  const practices = filter === "moments" || filter === "timed";
  const title = day
    ? "Activity on " + formatDay(day)
    : filter === "checkins"
      ? "Mood check-ins"
      : filter === "moments"
        ? "Completed Moments"
        : filter === "timed"
          ? "Mindful time"
          : filter === "story"
            ? "Your check-ins"
            : "Activity history";
  const days = [...analytics.days.entries()]
    .filter(([key]) =>
      day
        ? key === day
        : (!startDay || key >= startDay) && (!endDay || key <= endDay),
    )
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, item]) => ({
      day: key,
      entries: item.entries.filter(({ collection, record }) =>
        filter === "story"
          ? collection === "checkins" || collection === "assessments"
          : filter === "checkins"
            ? collection === "checkins"
            : filter === "moments"
              ? collection === "sessions" && isCompletedMoment(record)
              : filter === "timed"
                ? collection === "sessions" &&
                  record.completed === true &&
                  activeSeconds(record) > 0
                : true,
      ),
    }))
    .filter((item) => item.entries.length > 0);
  const [limit, setLimit] = useState(14);
  return (
    <Screen title={title} back={app.back}>
      {startDay && endDay && (
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.detailIntro}
        >
          {formatDay(startDay, { month: "short", day: "numeric" })} –{" "}
          {formatDay(endDay)}
        </AppText>
      )}
      {filter === "story" && (
        <>
          <AppText
            variant="caption"
            color={colors.muted}
            style={styles.detailIntro}
          >
            {analytics.savedStory.checkins} mood entries ·{" "}
            {analytics.savedStory.assessments} reflective assessments
          </AppText>
          <Button
            title="Take a reflective assessment"
            variant="secondary"
            onPress={() => app.navigate("assessments")}
          />
        </>
      )}
      {!days.length && (
        <View style={{ gap: 14 }}>
          <AppText color={colors.muted}>
            There’s no saved activity here yet. You can make a little space
            whenever you’re ready.
          </AppText>
          <Button
            title={practices ? "Explore practices" : "Check in with yourself"}
            onPress={() => app.navigate(practices ? "explore" : "checkin")}
          />
        </View>
      )}
      {days.slice(0, limit).map((item) => (
        <View key={item.day} style={{ marginBottom: 14 }}>
          {!day && <AppText variant="heading">{formatDay(item.day)}</AppText>}
          {item.entries.map((entry) => (
            <HistoryEntry key={entry.key} entry={entry} />
          ))}
        </View>
      ))}
      {days.length > limit && (
        <Button
          title="Show earlier activity"
          variant="ghost"
          onPress={() => setLimit((value) => value + 14)}
        />
      )}
    </Screen>
  );
}

export function JourneyMilestonesScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const now = useJourneyClock();
  const analytics = useMemo(
    () => journeyAnalytics(app.data, now),
    [app.data, now],
  );
  const milestone = analytics.milestones.find(
    (item) => item.id === app.params?.id,
  );
  const preferences = app.data.preferences.find(
    (item) => item.id === "wellness",
  );
  const streaks = preferences?.streaksEnabled === true;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function setStreaks(value: boolean) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      await app.save("preferences", {
        environment: "forest",
        ambientEnabled: false,
        ...preferences,
        id: "wellness",
        streaksEnabled: value,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your preference.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  if (milestone)
    return (
      <Screen title={milestone.title} back={app.back}>
        <View style={styles.milestoneDetail}>
          {milestone.earned ? (
            <Companion state="happy" size={112} />
          ) : (
            <Icon name={milestone.icon} size={55} color={colors.muted} />
          )}
          <AppText variant="heading">
            {milestone.earned
              ? "A little milestone earned"
              : "Still ahead of you"}
          </AppText>
          <AppText color={colors.muted} style={styles.center}>
            {milestone.description}
          </AppText>
          {milestone.earnedDay && (
            <AppText variant="label">
              Earned {formatDay(milestone.earnedDay)}
            </AppText>
          )}
        </View>
      </Screen>
    );
  return (
    <Screen title="Little milestones" back={app.back}>
      <Row style={{ marginBottom: 12 }}>
        <View style={styles.flex}>
          <AppText variant="label">Show check-in streaks</AppText>
          <AppText variant="caption" color={colors.muted}>
            Optional. Quiet days never erase your history.
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Show check-in streaks"
          disabled={saving}
          value={streaks}
          onValueChange={setStreaks}
        />
      </Row>
      {error ? (
        <AppText accessibilityRole="alert" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
      {streaks && (
        <AppText color={colors.muted} style={styles.detailIntro}>
          {journeySummary(app.data, now).streak} consecutive check-in days
        </AppText>
      )}
      {analytics.milestones.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={
            item.title + (item.earned ? ", earned" : ", locked")
          }
          onPress={() => app.navigate("journey-milestones", { id: item.id })}
        >
          <Row
            style={[
              styles.entryRow,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Icon
              name={item.icon}
              color={item.earned ? colors.primary : colors.muted}
              size={23}
            />
            <View style={styles.flex}>
              <AppText variant="label">{item.title}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {item.earnedDay
                  ? "Earned " + formatDay(item.earnedDay)
                  : item.description}
              </AppText>
            </View>
            <Icon
              name={
                item.earned ? "checkmark-circle-outline" : "lock-closed-outline"
              }
              color={colors.muted}
              size={17}
            />
          </Row>
        </Pressable>
      ))}
    </Screen>
  );
}
export function JourneyScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const { top } = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const large = fontScale > 1.25;
  const compact = width < 360;
  const reflowMilestones = width < 390 || large;
  const now = useJourneyClock();
  const today = localDay(now);
  const requestedDay = app.params?.day;
  const selectedDay =
    typeof requestedDay === "string" && requestedDay < today
      ? requestedDay
      : today;
  const { period, selectPeriod } = useJourneyPeriod(app.user?.id);
  const [options, setOptions] = useState(false);
  const analytics = useMemo(
    () => journeyAnalytics(app.data, now),
    [app.data, now],
  );
  const report = useMemo(
    () => journeyReport(analytics, period, selectedDay),
    [analytics, period, selectedDay],
  );
  const days = useMemo(
    () => journeyCalendar(analytics, period, selectedDay),
    [analytics, period, selectedDay],
  );
  const previous = adjacentJourneyDay(period, selectedDay, -1, today);
  const next = adjacentJourneyDay(period, selectedDay, 1, today);
  const goal = selectJourneyGoal(app.data.goals);
  const progress = useMemo(
    () => (goal ? journeyGoalProgress(goal, app.data, now) : null),
    [goal, app.data, now],
  );
  const panel = {
    backgroundColor: dark ? "#211A2E" : "#FFF8F0",
    borderColor: dark ? "#59476D" : colors.heroBorder,
  };
  const muted = dark ? "#E0D2E8" : colors.heroMuted;
  const selectedInk = dark ? "#22162E" : colors.primaryText;
  const selectedBase = dark ? "#E2B7F3" : colors.primary;
  const progressInk = dark ? "#D9B3F0" : colors.primary;
  const progressTrack = dark ? "#51405F" : colors.border;
  const periodName = period === "week" ? "week" : "month";
  const selectedWeek = journeyWeek(selectedDay);
  const savedStory = savedWeeklyStory(app.data.reflections, selectedWeek.endDay);
  const story = [
    {
      label: "Reflections",
      icon: "create-outline",
      count: analytics.savedStory.reflections,
      route: "reflections",
    },
    {
      label: "Affirmations",
      icon: "heart-outline",
      count: analytics.savedStory.affirmations,
      route: "saved-affirmations",
    },
    {
      label: "Check-ins",
      icon: "clipboard-outline",
      count: analytics.savedStory.checkins + analytics.savedStory.assessments,
      route: "journey-activity",
      params: { filter: "story" },
    },
  ];
  return (
    <Screen edgeToEdgeTop style={styles.screen}>
      <View
        style={[
          styles.hero,
          { paddingTop: top + 3, paddingHorizontal: gutter },
        ]}
      >
        <Image
          source={artwork[resolved].hero}
          style={coverImageStyle}
          resizeMode="cover"
          fadeDuration={0}
          accessible={false}
          pointerEvents="none"
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: dark
                ? "linear-gradient(90deg, #151020F5 0%, #1710249E 47%, #17102400 87%)"
                : "linear-gradient(90deg, #FBF0E8 0%, #FBF0E8BA 48%, #FBF0E800 86%)",
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.heroFade,
            {
              backgroundImage:
                "linear-gradient(180deg, " +
                colors.bg +
                "00 0%, " +
                colors.bg +
                " 100%)",
            },
          ]}
        />
        <Row style={styles.masthead}>
          <Row style={styles.brand}>
            <LotusMark size={27} />
            <AppText variant="heading" style={styles.wordmark}>
              Solace
            </AppText>
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Journey options"
            accessibilityState={{ expanded: options }}
            onPress={() => setOptions((value) => !value)}
            style={styles.iconTarget}
          >
            <View
              style={[
                styles.optionsDisc,
                {
                  backgroundColor: dark ? "#42334DC9" : "#FFF8F0EB",
                  borderColor: panel.borderColor,
                },
              ]}
            >
              <Icon
                name={options ? "close" : "ellipsis-horizontal"}
                size={17}
              />
            </View>
          </Pressable>
        </Row>
        <AppText
          variant="display"
          accessibilityRole="header"
          style={styles.title}
        >
          Your journey
        </AppText>
        <AppText color={colors.text} style={styles.subtitle}>
          A gentle record of your growth.
        </AppText>
        <PeriodControl
          period={period}
          onChange={selectPeriod}
          base={selectedBase}
          ink={selectedInk}
        />
      </View>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        {options && (
          <View style={[styles.panel, panel, styles.options]}>
            <Button
              title="Activity history"
              variant="ghost"
              onPress={() => app.navigate("journey-activity")}
            />
            <Button
              title="All milestones"
              variant="ghost"
              onPress={() => app.navigate("journey-milestones")}
            />
          </View>
        )}
        <Row style={[styles.metricRow, large && styles.wrap]}>
          {metrics.map((metric, index) => {
            const tone = tones[resolved][index];
            const value = report.stats[metric.key];
            const timed = metric.key === "seconds";
            const display = timed
              ? value > 0 && value < 60
                ? "<1"
                : String(Math.floor(value / 60))
              : String(value);
            const change = report.comparison?.[metric.key];
            const comparison =
              typeof change === "number"
                ? compareText(change, timed, period)
                : null;
            return (
              <Pressable
                key={metric.key}
                accessibilityRole="button"
                accessibilityLabel={
                  display +
                  " " +
                  (timed ? "minutes, mindful time" : metric.label) +
                  (comparison ? ". " + comparison : "")
                }
                onPress={() =>
                  app.navigate("journey-activity", {
                    filter: metric.filter,
                    startDay: report.startDay,
                    endDay: report.endDay,
                  })
                }
                style={({ pressed }) => [
                  styles.metric,
                  large && styles.largeTile,
                  {
                    backgroundColor: tone.base,
                    borderColor: tone.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon name={metric.icon} color={tone.ink} size={22} />
                <Row style={styles.metricTop}>
                  <AppText variant="label" style={styles.metricValue}>
                    {display}
                  </AppText>
                  {timed && (
                    <AppText variant="caption" style={styles.metricUnit}>
                      min
                    </AppText>
                  )}
                </Row>
                <AppText variant="caption" style={styles.metricLabel}>
                  {metric.label}
                </AppText>
                <AppText
                  variant="caption"
                  color={
                    typeof change === "number" && change > 0
                      ? dark
                        ? "#C2E6AE"
                        : "#386537"
                      : muted
                  }
                  style={styles.metricNote}
                >
                  {comparison ||
                    (period === "all" ? "Lifetime" : "No earlier activity")}
                </AppText>
              </Pressable>
            );
          })}
        </Row>
        <View
          style={[
            styles.panel,
            panel,
            styles.calendar,
            compact && styles.compactCalendar,
          ]}
        >
          <Row style={styles.calendarHead}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Previous " + periodName}
              disabled={!previous}
              accessibilityState={{ disabled: !previous }}
              onPress={() => previous && app.setParams({ day: previous })}
              style={styles.iconTarget}
            >
              <Icon
                name="chevron-back"
                size={17}
                color={previous ? colors.text : colors.muted}
              />
            </Pressable>
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={styles.month}
            >
              {formatDay(selectedDay, { month: "long", year: "numeric" })}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Next " + periodName}
              disabled={!next}
              accessibilityState={{ disabled: !next }}
              onPress={() => next && app.setParams({ day: next })}
              style={styles.iconTarget}
            >
              <Icon
                name="chevron-forward"
                size={17}
                color={next ? colors.text : colors.muted}
              />
            </Pressable>
          </Row>
          <Row style={styles.weekdays}>
            {["M", "T", "W", "T", "F", "S", "S"].map((value, index) => (
              <AppText
                key={index}
                variant="caption"
                color={muted}
                style={styles.weekday}
              >
                {value}
              </AppText>
            ))}
          </Row>
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              if (!day)
                return <View key={"blank-" + index} style={styles.dayCell} />;
              const selected = day.key === selectedDay;
              const indicators = [
                day.checkins > 0 && (dark ? "#ABE995" : "#59904C"),
                day.moments > 0 && (dark ? "#FFE89B" : "#B97842"),
                day.reflections + day.assessments > 0 &&
                  (dark ? "#F2B8F3" : "#8E57A3"),
              ];
              const description = [
                counted(day.checkins, "mood check-in"),
                counted(day.moments, "completed Moment"),
                counted(day.reflections, "reflection"),
                counted(day.assessments, "assessment"),
              ].join(", ");
              return (
                <View key={day.key} style={styles.dayCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      formatDay(day.key) +
                      ". " +
                      (day.future ? "Future date" : description)
                    }
                    accessibilityState={{ disabled: day.future, selected }}
                    disabled={day.future}
                    onPress={() => {
                      app.setParams({ day: day.key });
                      app.navigate("journey-activity", { day: day.key });
                    }}
                    style={({ pressed }) => [
                      styles.day,
                      {
                        backgroundColor: selected
                          ? selectedBase
                          : "transparent",
                        opacity: day.future ? 0.55 : pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <AppText
                      variant={selected ? "label" : "caption"}
                      color={selected ? selectedInk : colors.text}
                      style={styles.dayNumber}
                    >
                      {day.day}
                    </AppText>
                    <Row style={styles.dots}>
                      {indicators.map((color, index) =>
                        color ? (
                          <View
                            key={index}
                            style={[styles.dot, { backgroundColor: color }]}
                          />
                        ) : null,
                      )}
                    </Row>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {period !== "week" && (
            <AppText
              variant="caption"
              color={muted}
              style={styles.calendarNote}
            >
              {period === "all" ? "Lifetime totals above · " : ""}Tap a date to
              see its activity.
            </AppText>
          )}
        </View>

        <View style={[styles.panel, panel, styles.reflection]}>
          <Image
            source={artwork[resolved].reflection}
            style={coverImageStyle}
            resizeMode="cover"
            accessible={false}
            fadeDuration={0}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundImage: dark
                  ? "linear-gradient(90deg, #23192E 0%, #23192EED 55%, #23192E38 100%)"
                  : "linear-gradient(90deg, #FFF2E3 0%, #FFF2E3F5 55%, #FFF2E338 100%)",
              },
            ]}
          />
          <Row style={styles.reflectionHeading}>
            <Icon
              name="sparkles-outline"
              color={dark ? "#FFD69A" : colors.primary}
              size={17}
            />
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={[styles.sectionTitle, styles.flex]}
            >
              Your weekly story
            </AppText>
          </Row>
          <AppText
            color={colors.text}
            style={[
              styles.reflectionCopy,
              (large || compact) && styles.fullCopy,
            ]}
          >
            {reflectionPeriodLabel({
              start: selectedWeek.startDay,
              end: selectedWeek.endDay,
            })}
            {savedStory?.localOnly ? " · Waiting to sync" : ""}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              savedStory
                ? app.navigate("reflection-detail", { id: savedStory.id })
                : app.navigate("reflection", { weekEnd: selectedWeek.endDay })
            }
            style={({ pressed }) => [
              styles.reflectButton,
              {
                backgroundColor: dark ? "#FFD1AE" : colors.primary,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <AppText
              variant="label"
              color={dark ? "#281C27" : colors.primaryText}
              style={styles.reflectLabel}
            >
              {savedStory ? "Reopen weekly story" : "Look back on my week"}
            </AppText>
            <Icon
              name="arrow-forward"
              size={15}
              color={dark ? "#281C27" : colors.primaryText}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            goal
              ? "Your goal. " +
                goal.title +
                ". " +
                (goal.active === false
                  ? "Paused"
                  : (progress?.percentage || 0) + " percent")
              : "Your goal. Create a personal goal"
          }
          onPress={() => app.navigate("journey-goal")}
          style={({ pressed }) => [
            styles.panel,
            panel,
            styles.goal,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View
            style={[
              styles.goalIcon,
              { backgroundColor: dark ? "#433051" : colors.peachSurface },
            ]}
          >
            <Icon
              name="locate-outline"
              size={23}
              color={dark ? "#F3B7BE" : "#AB5037"}
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading" style={styles.goalTitle}>
              Your goal
            </AppText>
            <AppText variant="caption" color={muted} style={styles.goalCopy}>
              {goal
                ? goal.title + (goal.active === false ? " · Paused" : "")
                : "Set a target that feels right for you."}
            </AppText>
            {progress && goal?.active !== false && (
              <>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: progressTrack },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: progress.percentage + "%",
                        backgroundColor: progressInk,
                      },
                    ]}
                  />
                </View>
                {large && (
                  <AppText
                    variant="caption"
                    color={muted}
                    style={styles.goalCopy}
                  >
                    {progress.percentage}% complete
                  </AppText>
                )}
              </>
            )}
          </View>
          {progress && goal?.active !== false && !large && (
            <ProgressRing
              value={progress.percentage}
              track={progressTrack}
              ink={progressInk}
            />
          )}
          <Icon name="chevron-forward" size={17} />
        </Pressable>
        <View>
          <Row style={styles.sectionHead}>
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={[styles.sectionTitle, styles.flex]}
            >
              Little milestones
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all milestones"
              onPress={() => app.navigate("journey-milestones")}
              style={styles.inlineAction}
            >
              <AppText variant="caption" style={styles.viewAll}>
                View all
              </AppText>
              <Icon name="arrow-forward" size={14} />
            </Pressable>
          </Row>
          <Row style={[styles.badges, reflowMilestones && styles.wrap]}>
            {analytics.milestones.slice(0, 4).map((item, index) => {
              const tone = tones[resolved][index % 3];
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.title +
                    (item.earned
                      ? ", earned " +
                        (item.earnedDay ? formatDay(item.earnedDay) : "")
                      : ", locked. " + item.description)
                  }
                  onPress={() =>
                    app.navigate("journey-milestones", { id: item.id })
                  }
                  style={({ pressed }) => [
                    styles.badge,
                    reflowMilestones && styles.largeTile,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeDisc,
                      { backgroundColor: tone.base, borderColor: tone.border },
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      size={23}
                      color={item.earned ? tone.ink : muted}
                    />
                  </View>
                  <AppText variant="caption" style={styles.badgeLabel}>
                    {item.title}
                  </AppText>
                  <View style={styles.badgeStatus}>
                    <Icon
                      name={
                        item.earned ? "checkmark-circle" : "lock-closed-outline"
                      }
                      size={14}
                      color={
                        item.earned
                          ? dark
                            ? "#BAEDAA"
                            : "#347145"
                          : colors.muted
                      }
                    />
                  </View>
                </Pressable>
              );
            })}
          </Row>
        </View>
        <View style={[styles.panel, panel, styles.story]}>
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={styles.sectionTitle}
          >
            Your saved story
          </AppText>
          <Row style={[styles.storyRow, large && styles.wrap]}>
            {story.map((item, index) => (
              <Pressable
                key={item.route}
                accessibilityRole="button"
                accessibilityLabel={
                  item.count + " saved " + item.label.toLowerCase()
                }
                onPress={() => app.navigate(item.route, item.params)}
                style={({ pressed }) => [
                  styles.storyItem,
                  large && styles.largeTile,
                  {
                    borderLeftWidth:
                      index && !large ? StyleSheet.hairlineWidth : 0,
                    borderColor: panel.borderColor,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Icon
                  name={item.icon}
                  size={compact ? 16 : 20}
                  color={dark ? "#EAB9EB" : colors.heroMuted}
                />
                <AppText variant="label" style={styles.storyCount}>
                  {item.count}
                </AppText>
                <AppText variant="caption" style={styles.storyLabel}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </Row>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  hero: { paddingBottom: spacing.card, overflow: "hidden" },
  heroFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 49 },
  masthead: { justifyContent: "space-between", gap: 8 },
  brand: { gap: 7 },
  wordmark: { fontSize: 20, lineHeight: 25 },
  iconTarget: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsDisc: {
    width: 33,
    height: 33,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 37, lineHeight: 43 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  segments: {
    alignSelf: "center",
    width: "100%",
    marginTop: spacing.row,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 54,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  segmentPill: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 22,
  },
  segmentLabel: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  body: { gap: spacing.card },
  panel: { borderWidth: 1, borderRadius: 17, overflow: "hidden" },
  options: { padding: spacing.compact, gap: 4 },
  metricRow: { gap: spacing.compact, alignItems: "stretch" },
  metric: {
    minHeight: 116,
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: spacing.row,
    gap: 4,
    alignItems: "center",
  },
  wrap: { flexWrap: "wrap" },
  largeTile: { flexBasis: "45%", flexGrow: 1 },
  metricTop: {
    justifyContent: "center",
    alignItems: "baseline",
    gap: 3,
    flexWrap: "wrap",
  },
  metricValue: { fontSize: 24, lineHeight: 29, fontVariant: ["tabular-nums"] },
  metricUnit: {
    fontSize: 12,
    lineHeight: 16,
  },
  metricLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  metricNote: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 2,
  },
  calendar: { paddingHorizontal: spacing.compact, paddingBottom: spacing.row },
  compactCalendar: { paddingHorizontal: 4 },
  calendarHead: { justifyContent: "space-between", gap: 4 },
  month: { flex: 1, textAlign: "center", fontSize: 20, lineHeight: 25 },
  weekdays: { marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, lineHeight: 15 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.2857%", padding: 1 },
  day: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  dayNumber: { fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  dots: { minHeight: 8, gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  calendarNote: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.compact,
  },
  reflection: {
    minHeight: 148,
    padding: spacing.card,
    justifyContent: "center",
  },
  reflectionHeading: { gap: spacing.compact },
  sectionTitle: { fontSize: 22, lineHeight: 26 },
  reflectionCopy: { fontSize: 13, lineHeight: 19, width: "70%", marginTop: 4 },
  fullCopy: { width: "100%" },
  reflectButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.compact,
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: spacing.row,
    paddingVertical: 4,
    marginTop: spacing.compact,
  },
  reflectLabel: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  goal: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.row,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1, minWidth: 0 },
  goalTitle: { fontSize: 20, lineHeight: 24 },
  goalCopy: { fontSize: 12, lineHeight: 17 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: "100%", borderRadius: 3 },
  ring: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCircle: { ...StyleSheet.absoluteFill, borderRadius: 21, borderWidth: 4 },
  ringHalf: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 21,
    height: 42,
    overflow: "hidden",
  },
  ringArc: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 4,
    borderColor: "transparent",
  },
  ringText: { fontSize: 11, lineHeight: 15 },
  sectionHead: { gap: spacing.compact },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: 4,
    paddingHorizontal: 3,
  },
  viewAll: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  badges: { alignItems: "stretch", gap: spacing.compact },
  badge: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: spacing.compact,
  },
  badgeDisc: {
    width: 46,
    height: 43,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  badgeStatus: { marginTop: "auto", minHeight: 18, justifyContent: "center" },
  story: { padding: spacing.card, gap: spacing.compact },
  storyRow: { gap: 0, alignItems: "stretch" },
  storyItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  storyCount: { fontSize: 18, lineHeight: 23, fontVariant: ["tabular-nums"] },
  storyLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  detailIntro: { marginBottom: 13 },
  entryRow: { minHeight: 48, paddingVertical: 8 },
  milestoneDetail: { alignItems: "center", paddingVertical: 24, gap: 12 },
  center: { textAlign: "center" },
});
