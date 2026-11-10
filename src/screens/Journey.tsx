import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  FlatList,
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
import {
  wellnessPlanProgress,
  type WellnessPlan,
} from "../../server/src/wellness-plans";
import { useReducedMotion } from "../Companion";
import { MilestoneArt } from "../MilestoneCelebration";
import { ASSESSMENTS, localDay, recordDay } from "../content";
import { DaylightScenicScrim, daylightPhotoInk } from "../DaylightScenicScrim";
import { habitIconNames } from "../habits-ui";
import { isJournalRecord } from "../journal-record";
import {
  adjacentJourneyDay,
  journeyAnalytics,
  journeyCalendar,
  journeyReport,
  journeyWeek,
  latestJourneyActivity,
  type JourneyPeriod,
  type LatestJourneyActivity,
} from "../journey-analytics";
import { journeyGoalProgress, selectJourneyGoal } from "../journey-goals";
import { spacing, useScreenGutter } from "../layout";
import { useListScrollRestore } from "../list-scroll";
import { momentClockText } from "../moments";
import { EditorialSection, SceneIntro } from "../NestedDesign";
import { webRadioProps } from "../radio-keyboard";
import {
  activeSeconds,
  isCompletedMoment,
  journeySummary,
  type DayEntry,
} from "../progress";
import { useApp } from "../store";
import { MainTabHeader, useMainTabHeaderInsets } from "../SolaceBrandHeader";
import { isRecordId, routes, savedReflectionRoute } from "../routes";
import { artGradient, useTheme } from "../theme";
import { reflectionPeriodLabel } from "../weekly-story";
import { HabitJourneyEntry } from "./HabitEntryPoints";
import { WhatHelpedCard } from "./PracticeInsights";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  Card,
  Icon,
  IconButton,
  MoodPetal,
  moodPetals,
  NestedHeader,
  NestedState,
  Row,
  Screen,
  coverImageStyle,
  useNavigationInset,
} from "../ui";

const periods = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
] as const;
const isAndroid = Platform.OS === "android";
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
    { base: "#F2F6F1", border: "#D7E3D8", ink: "#3F654C" },
    { base: "#FCF2EF", border: "#EAD8D3", ink: "#9A4C3C" },
    { base: "#F4EDF9", border: "#E3D6ED", ink: "#634579" },
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
    setNow(new Date());
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

function useJourneyAnalytics(
  data: ReturnType<typeof useApp>["data"],
  now: Date,
) {
  const { checkins, sessions, reflections, assessments, plans } = data;
  return useMemo(
    () =>
      journeyAnalytics(
        { checkins, sessions, reflections, assessments, plans },
        now,
      ),
    [checkins, sessions, reflections, assessments, plans, now],
  );
}

function useJourneyPeriod(owner?: string, requested?: JourneyPeriod) {
  const key = owner ? "solace.journey.period." + owner : null;
  const [period, setPeriod] = useState<JourneyPeriod>(requested ?? "week");
  const chosen = useRef(false);
  useEffect(() => {
    if (!key) return;
    if (requested) {
      setPeriod(requested);
      return;
    }
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
  }, [key, requested]);
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
        isAndroid && styles.androidSegments,
        {
          backgroundColor: resolved === "dark" ? "#393048E6" : colors.surface,
          borderColor: resolved === "dark" ? colors.border : colors.heroBorder,
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
          {...webRadioProps(id === period)}
          accessibilityLabel={label}
          accessibilityState={{ checked: id === period }}
          aria-checked={id === period}
          onPress={() => onChange(id)}
          style={styles.segment}
        >
          <AppText
            variant="label"
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
function activityTitle({ record, collection }: DayEntry) {
  if (collection === "checkins")
    return typeof record.mood === "string" && record.mood.trim()
      ? `${record.mood} check-in`
      : "Mood check-in";
  if (collection === "sessions")
    return record.title || record.activity?.title || "A moment for you";
  if (collection === "reflections")
    return (
      record.title ||
      (record.kind === "journal" ? "Untitled entry" : "A saved reflection")
    );
  return record.title || "A reflective check-in";
}

function activityDestination({ record, collection }: DayEntry) {
  const { id } = record;
  if (!isRecordId(id)) return;
  switch (collection) {
    case "checkins":
      return { name: routes.journeyCheckin, params: { id } };
    case "sessions":
      return { name: routes.sessionDetail, params: { id } };
    case "reflections":
      return { name: savedReflectionRoute(record), params: { id } };
    case "assessments":
      return {
        name: "assessment-result",
        params: { id, type: record.assessmentType || record.type },
      };
  }
}

function describeLatestActivity(activity: LatestJourneyActivity | DayEntry): {
  title: string;
  type: string;
  icon: string;
  tone: "sage" | "lavender" | "peach";
} {
  if (activity.collection === "habitProgress") {
    return {
      title: activity.habit.name,
      type: "Habit completion",
      icon:
        habitIconNames[activity.habit.icon]?.name ?? "checkmark-circle-outline",
      tone: activity.habit.color ?? "sage",
    };
  }
  const { record, collection } = activity;
  const title = activityTitle(activity);
  switch (collection) {
    case "checkins":
      return {
        title,
        type: "Mood check-in",
        icon: "leaf-outline",
        tone: "sage",
      };
    case "reflections":
      return isJournalRecord(record)
        ? {
            title,
            type: "Journal entry",
            icon: "book-outline",
            tone: "lavender",
          }
        : {
            title,
            type: "Reflection",
            icon: "create-outline",
            tone: "lavender",
          };
    case "assessments": {
      const assessment = ASSESSMENTS.find(
        ({ id }) => id === (record.assessmentType || record.type),
      );
      return {
        title: record.title || assessment?.title || title,
        type: "Reflective check-in",
        icon: assessment?.icon ?? "clipboard-outline",
        tone: "lavender",
      };
    }
    case "sessions": {
      if (record.type === "resource")
        return {
          title: record.title || "Saved guide",
          type: "Guide completed",
          icon: "book-outline",
          tone: "sage",
        };
      const guided =
        [
          "Explore",
          "Today",
          "Solace chat",
          "My Journal",
          "Wellness plan",
        ].includes(record.source) ||
        (record.kind !== "generated" &&
          ["breathing", "grounding"].includes(record.type));
      return guided
        ? {
            title,
            type: "Guided practice",
            icon: "trail-sign-outline",
            tone: "sage",
          }
        : {
            title,
            type: "Solace Moment",
            icon: "flower-outline",
            tone: "peach",
          };
    }
  }
}

function LatestActivity({
  activity,
  panel,
  muted,
  today,
}: {
  activity?: LatestJourneyActivity;
  panel: { backgroundColor: string; borderColor: string };
  muted: string;
  today: string;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const display = activity && describeLatestActivity(activity);
  const destination =
    activity?.collection === "habitProgress"
      ? {
          name: routes.habitDetails,
          params: { id: activity.habit.id, day: activity.day },
        }
      : activity && activityDestination(activity);
  const date =
    activity &&
    formatDay(activity.day, {
      month: "short",
      day: "numeric",
      year:
        activity.day.slice(0, 4) !== today.slice(0, 4) ? "numeric" : undefined,
    }).replace(/\s+/g, "\u00A0");
  const detail = [
    display?.type,
    date,
    activity && "localOnly" in activity.record && activity.record.localOnly
      ? "Waiting to sync"
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const tone = display?.tone ?? "sage";
  const style = [styles.panel, panel, styles.latest];
  const content = (
    <Row style={styles.latestRow}>
      <View
        style={[
          styles.latestIcon,
          { backgroundColor: colors[`${tone}Surface`] },
        ]}
        aria-hidden
      >
        <Icon
          name={display?.icon ?? "time-outline"}
          color={colors[`${tone}Text`]}
          size={21}
        />
      </View>
      <View style={styles.latestCopy}>
        <AppText variant="caption" color={muted}>
          Latest activity
        </AppText>
        <AppText variant="heading" style={styles.latestTitle}>
          {display?.title ?? "No activity yet"}
        </AppText>
        <AppText variant="caption" color={muted}>
          {detail || "Saved activity appears here."}
        </AppText>
      </View>
      {destination && <Icon name="chevron-forward" size={18} color={muted} />}
    </Row>
  );
  if (!display || !destination) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open latest activity, ${display.title}. ${detail}`}
      onPress={() => app.navigate(destination.name, destination.params)}
      style={({ pressed }) => [
        ...style,
        pressed && { borderColor: colors.lavenderText },
      ]}
    >
      {content}
    </Pressable>
  );
}

export function JourneyCheckinScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const id = app.params.id;
  const checkin = isRecordId(id)
    ? app.data.checkins.find((record) => record.id === id)
    : undefined;
  const day = checkin && recordDay(checkin);
  const petal = moodPetals.find(({ mood }) => mood === checkin?.mood);
  const mood =
    typeof checkin?.mood === "number"
      ? `Mood ${checkin.mood} of 5`
      : typeof checkin?.mood === "string" && checkin.mood.trim()
        ? checkin.mood
        : "Saved check-in";
  const note = typeof checkin?.note === "string" ? checkin.note.trim() : "";
  const tags = Array.isArray(checkin?.tags)
    ? checkin.tags.filter(
        (tag: unknown): tag is string =>
          typeof tag === "string" && !!tag.trim(),
      )
    : [];
  return (
    <Screen variant="nested" title="Mood check-in" back={app.back}>
      {checkin ? (
        <View style={styles.recordPage}>
          <View
            style={[
              styles.recordCover,
              { backgroundColor: colors.sageSurface },
            ]}
          >
            <BotanicalBackdrop style={styles.recordBotanical} />
            {petal ? (
              <MoodPetal source={petal.image} style={styles.checkinPetal} />
            ) : (
              <Icon name="leaf-outline" size={36} color={colors.sageText} />
            )}
            <View style={styles.recordHeadline}>
              <AppText variant="display" accessibilityRole="header">
                {mood}
              </AppText>
              {day && (
                <AppText variant="caption" color={colors.muted}>
                  {formatDay(day)}
                </AppText>
              )}
              {checkin.localOnly && (
                <AppText variant="caption" color={colors.sageText}>
                  Waiting to sync
                </AppText>
              )}
            </View>
          </View>
          <View style={[styles.recordNote, { borderColor: colors.border }]}>
            <EditorialSection title="What you noticed" />
            <AppText color={note ? colors.text : colors.muted}>
              {note || "You saved this check-in without a note."}
            </AppText>
            {!!tags.length && (
              <View style={styles.recordTags}>
                {tags.map((tag, index) => (
                  <View
                    key={`${tag}-${index}`}
                    style={[
                      styles.recordTag,
                      { backgroundColor: colors.lavenderSurface },
                    ]}
                  >
                    <AppText variant="caption" color={colors.lavenderText}>
                      {tag}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : (
        <NestedState
          title="Check-in unavailable"
          description="This check-in is no longer available."
          icon="leaf-outline"
        />
      )}
    </Screen>
  );
}

function HistoryEntry({
  entry,
  onOpen,
}: {
  entry: DayEntry;
  onOpen: () => void;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const { record, collection } = entry;
  const { title, type, icon, tone } = describeLatestActivity(entry);
  const typeLabel =
    collection === "sessions" && record.type === "resource" && !record.completed
      ? "Saved guide"
      : type;
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
  const destination = activityDestination(entry);
  const open = destination
    ? () => {
        onOpen();
        app.navigate(destination.name, destination.params);
      }
    : undefined;
  const content = (
    <Row style={styles.historyEntryRow}>
      <View
        style={[
          styles.historyIcon,
          { backgroundColor: colors[`${tone}Surface`] },
        ]}
      >
        <Icon name={icon} size={19} color={colors[`${tone}Text`]} />
      </View>
      <View style={styles.historyEntryCopy}>
        <AppText variant="heading" style={styles.historyEntryTitle}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors[`${tone}Text`]}>
          {typeLabel}
        </AppText>
        <AppText variant="caption" color={colors.muted} numberOfLines={3}>
          {subtitle}
        </AppText>
      </View>
      {open && (
        <View style={styles.historyChevron}>
          <Icon name="chevron-forward" size={17} color={colors.muted} />
        </View>
      )}
    </Row>
  );
  const surface = [styles.historyEntry, { borderColor: colors.border }];
  return open ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={open}
      style={({ pressed }) => [
        surface,
        pressed && { backgroundColor: colors.surface },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={surface}>{content}</View>
  );
}

type HistoryRow =
  | { key: string; day: string }
  | { key: string; entry: DayEntry; last: boolean };

export function JourneyActivityScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const { bottom } = useSafeAreaInsets();
  const bottomClearance = Math.max(useNavigationInset(), bottom);
  const now = useJourneyClock();
  const analytics = useJourneyAnalytics(app.data, now);
  const { filter, startDay, endDay, day, historyLimit, historyY } =
    app.params || {};
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
  const days = useMemo(
    () =>
      [...analytics.days.entries()]
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
        .filter((item) => item.entries.length > 0),
    [analytics.days, day, endDay, filter, startDay],
  );
  const [limit, setLimit] = useState<number>(
    Number.isSafeInteger(historyLimit) && historyLimit > 14 ? historyLimit : 14,
  );
  const rows = useMemo(
    () =>
      days.slice(0, limit).flatMap<HistoryRow>((item) => {
        const entries = item.entries.map((entry, index) => ({
          key: entry.key,
          entry,
          last: index === item.entries.length - 1,
        }));
        return day
          ? entries
          : [{ key: `day:${item.day}`, day: item.day }, ...entries];
      }),
    [day, days, limit],
  );
  const listScroll = useListScrollRestore<HistoryRow>(historyY);
  const totalEntries = days.reduce(
    (count, item) => count + item.entries.length,
    0,
  );
  const rememberPosition = () =>
    app.setParams({ historyLimit: limit, historyY: listScroll.offset.current });
  return (
    <Screen variant="nested" scroll={false} style={styles.historyShell}>
      <FlatList<HistoryRow>
        {...listScroll.props}
        data={rows}
        keyExtractor={(item) => item.key}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: spacing.screenTop,
          paddingBottom: spacing.bottom + bottomClearance,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <NestedHeader title="Journey" onBack={app.back} />
            <SceneIntro
              image={artwork[resolved].hero}
              title={title}
              description={
                startDay && endDay
                  ? `${formatDay(startDay, { month: "short", day: "numeric" })} – ${formatDay(endDay)}`
                  : undefined
              }
              meta={`${totalEntries} saved ${totalEntries === 1 ? "entry" : "entries"}`}
            />
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
                  onPress={() => {
                    rememberPosition();
                    app.navigate("assessments");
                  }}
                />
              </>
            )}
          </>
        }
        ListEmptyComponent={
          <NestedState
            title="A quiet stretch"
            description="There’s no saved activity here yet. You can make a little space whenever you’re ready."
            icon={practices ? "flower-outline" : "time-outline"}
          >
            <Button
              title={practices ? "Explore practices" : "Check in with yourself"}
              onPress={() => app.navigate(practices ? "explore" : "checkin")}
            />
          </NestedState>
        }
        renderItem={({ item }) =>
          "day" in item ? (
            <Row style={[styles.historyDate, { borderColor: colors.border }]}>
              <Icon
                name="calendar-outline"
                size={17}
                color={colors.lavenderText}
              />
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={styles.historyDateText}
              >
                {formatDay(item.day)}
              </AppText>
            </Row>
          ) : (
            <View style={item.last && styles.historyDayEnd}>
              <HistoryEntry entry={item.entry} onOpen={rememberPosition} />
            </View>
          )
        }
        ListFooterComponent={
          days.length > limit ? (
            <Button
              title="Show earlier activity"
              variant="ghost"
              onPress={() => setLimit((value) => value + 14)}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

export function JourneyMilestonesScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const now = useJourneyClock();
  const analytics = useJourneyAnalytics(app.data, now);
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
      <Screen variant="nested" title="Little milestones" back={app.back}>
        <View
          style={[
            styles.milestoneDetail,
            {
              backgroundColor: milestone.earned
                ? colors.sageSurface
                : colors.surface,
            },
          ]}
        >
          <BotanicalBackdrop style={styles.recordBotanical} />
          <MilestoneArt {...milestone} size={108} />
          <AppText
            variant="display"
            accessibilityRole="header"
            style={styles.center}
          >
            {milestone.title}
          </AppText>
          <View
            style={[
              styles.recordTag,
              {
                backgroundColor: milestone.earned
                  ? colors.surface
                  : colors.lavenderSurface,
              },
            ]}
          >
            <AppText
              variant="label"
              color={milestone.earned ? colors.sageText : colors.lavenderText}
              style={styles.center}
            >
              {milestone.earnedDay
                ? `Earned ${formatDay(milestone.earnedDay)}`
                : milestone.earned
                  ? "Earned"
                  : "Still ahead of you"}
            </AppText>
          </View>
        </View>
        <View style={styles.milestoneRule}>
          <EditorialSection
            title={
              milestone.earned ? "What you made time for" : "How to reach it"
            }
          />
          <AppText color={colors.muted}>{milestone.description}</AppText>
        </View>
      </Screen>
    );
  const earned = analytics.milestones.filter((item) => item.earned);
  const ahead = analytics.milestones.filter((item) => !item.earned);
  const groups = [
    { title: "Already yours", items: earned },
    { title: "Still ahead", items: ahead },
  ];
  return (
    <Screen variant="nested" title="Journey" back={app.back}>
      <SceneIntro
        image={artwork[resolved].reflection}
        title="Little milestones"
        description="Remember the time you have made for yourself."
        meta={`${earned.length} of ${analytics.milestones.length} earned`}
      />
      {groups.map(
        ({ title, items }) =>
          !!items.length && (
            <View key={title} style={styles.milestoneGroup}>
              <EditorialSection title={title} />
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.title + (item.earned ? ", earned" : ", locked")
                  }
                  onPress={() =>
                    app.navigate("journey-milestones", { id: item.id })
                  }
                  style={({ pressed }) => [
                    styles.milestoneEntry,
                    { borderColor: colors.border },
                    item.earned && { backgroundColor: colors.sageSurface },
                    pressed && { opacity: 0.74 },
                  ]}
                >
                  <MilestoneArt {...item} size={48} />
                  <View style={styles.historyEntryCopy}>
                    <AppText variant="heading" style={styles.historyEntryTitle}>
                      {item.title}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {item.earnedDay
                        ? "Earned " + formatDay(item.earnedDay)
                        : item.description}
                    </AppText>
                  </View>
                  <Icon
                    name={
                      item.earned ? "chevron-forward" : "lock-closed-outline"
                    }
                    color={item.earned ? colors.sageText : colors.muted}
                    size={17}
                  />
                </Pressable>
              ))}
            </View>
          ),
      )}
      <Card style={styles.streakCard}>
        <Row>
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
            trackColor={{ false: colors.border, true: colors.primary }}
            onValueChange={setStreaks}
          />
        </Row>
      </Card>
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
    </Screen>
  );
}
export function JourneyScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const headerInsets = useMainTabHeaderInsets();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const large = fontScale > 1.25;
  const compact = width < 360;
  const storyReadingCoverage = large ? 82 : compact ? 73 : 64;
  const storyReadingWidth = `${storyReadingCoverage}%` as const;
  const reflowMilestones = width < 390 || large;
  const now = useJourneyClock();
  const today = localDay(now);
  const requestedDay = app.params?.day;
  const selectedDay =
    typeof requestedDay === "string" && requestedDay < today
      ? requestedDay
      : today;
  const requestedPeriod = periods.find(
    ({ id }) => id === app.params.period,
  )?.id;
  const { period, selectPeriod } = useJourneyPeriod(
    app.user?.id,
    requestedPeriod,
  );
  const [options, setOptions] = useState(false);
  const analytics = useJourneyAnalytics(app.data, now);
  const report = useMemo(
    () => journeyReport(analytics, period, selectedDay),
    [analytics, period, selectedDay],
  );
  const { habits, habitProgress } = app.data;
  const latest = useMemo(
    () => latestJourneyActivity(analytics, report, habits, habitProgress, now),
    [analytics, report, habits, habitProgress, now],
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
  const savedPlans = useMemo(() => {
    const plans = app.data.plans.filter(
      (item) =>
        item.type === "wellness" &&
        isRecordId(item.id) &&
        Array.isArray(item.tasks) &&
        item.tasks.length,
    ) as WellnessPlan[];
    return plans
      .sort((a, b) =>
        String(b.updatedAt ?? b.createdAt ?? "").localeCompare(
          String(a.updatedAt ?? a.createdAt ?? ""),
        ),
      )
      .map((plan) => ({
        plan,
        ...wellnessPlanProgress(plan, app.data.sessions),
      }));
  }, [app.data.plans, app.data.sessions]);
  const panel = {
    backgroundColor: dark ? "#211A2E" : colors.surface,
    borderColor: dark ? "#59476D" : colors.border,
  };
  const muted = dark ? "#E0D2E8" : colors.heroMuted;
  const selectedInk = dark ? "#22162E" : colors.primaryText;
  const selectedBase = dark ? "#E2B7F3" : colors.primary;
  const progressInk = dark ? "#D9B3F0" : colors.accent;
  const progressTrack = dark ? "#51405F" : colors.border;
  const periodName = period === "week" ? "week" : "month";
  const selectedWeek = journeyWeek(selectedDay);
  const savedStory = savedWeeklyStory(
    app.data.reflections,
    selectedWeek.endDay,
  );
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
        style={[styles.hero, isAndroid && styles.androidHero, headerInsets]}
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
            dark
              ? {
                  backgroundImage:
                    "linear-gradient(90deg, #151020F5 0%, #1710249E 47%, #17102400 87%)",
                }
              : artGradient(
                  `linear-gradient(90deg, ${colors.bg} 0%, ${colors.bg}ED 32%, ${colors.bg}9C 56%, ${colors.bg}00 90%)`,
                ),
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.heroFade,
            dark
              ? {
                  backgroundImage:
                    "linear-gradient(180deg, " +
                    colors.bg +
                    "00 0%, " +
                    colors.bg +
                    " 100%)",
                }
              : artGradient(
                  `linear-gradient(180deg, ${colors.bg}00 0%, ${colors.bg} 100%)`,
                ),
          ]}
        />
        <MainTabHeader>
          <IconButton
            name={options ? "close" : "ellipsis-horizontal"}
            label="Journey options"
            expanded={options}
            onPress={() => setOptions((value) => !value)}
            size={48}
            appearance="outlined"
          />
        </MainTabHeader>
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
      <View
        style={[
          styles.body,
          isAndroid && styles.androidBody,
          { paddingHorizontal: gutter },
        ]}
      >
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
        <LatestActivity
          activity={latest}
          panel={panel}
          muted={muted}
          today={today}
        />
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
            const icon = (
              <Icon
                name={metric.icon}
                color={tone.ink}
                size={isAndroid ? 18 : 22}
              />
            );
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
                  isAndroid && styles.androidMetric,
                  large && styles.largeTile,
                  {
                    backgroundColor: tone.base,
                    borderColor: tone.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                {!isAndroid && icon}
                <Row style={styles.metricTop}>
                  {isAndroid && icon}
                  <AppText variant="label" style={styles.metricValue}>
                    {display}
                  </AppText>
                  {timed && (
                    <AppText variant="caption" style={styles.metricUnit}>
                      min
                    </AppText>
                  )}
                </Row>
                <AppText
                  variant="caption"
                  color={dark ? undefined : colors.muted}
                  style={styles.metricLabel}
                >
                  {metric.label}
                </AppText>
                {comparison && (
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
                    {comparison}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </Row>
        <View
          style={[
            styles.panel,
            panel,
            styles.calendar,
            isAndroid && styles.androidCalendar,
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
          <View aria-hidden style={styles.weekdays}>
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
          </View>
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              if (!day)
                return <View key={"blank-" + index} style={styles.dayCell} />;
              const selected = day.key === selectedDay;
              const marks = selected
                ? dark
                  ? ["#38543F", "#7A4B33", "#694077"]
                  : ["#365E43", "#8C422C", "#553570"]
                : dark
                  ? ["#ABE995", "#FFE89B", "#F2B8F3"]
                  : ["#4A7655", "#9B542F", "#765295"];
              const indicators = [
                day.checkins > 0 && marks[0],
                day.moments > 0 && marks[1],
                day.reflections + day.assessments > 0 && marks[2],
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
                        opacity: day.future && dark ? 0.55 : pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <AppText
                      variant={selected ? "label" : "caption"}
                      color={
                        selected
                          ? selectedInk
                          : day.future && !dark
                            ? colors.muted
                            : colors.text
                      }
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

        <View
          style={[
            styles.panel,
            panel,
            styles.reflection,
            isAndroid && styles.androidReflection,
          ]}
        >
          <Image
            source={artwork[resolved].reflection}
            style={coverImageStyle}
            resizeMode="cover"
            accessible={false}
            fadeDuration={0}
            pointerEvents="none"
          />
          {dark ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundImage:
                    "linear-gradient(90deg, #23192E 0%, #23192EED 55%, #23192E38 100%)",
                },
              ]}
            />
          ) : (
            <DaylightScenicScrim coverage={storyReadingCoverage} />
          )}
          <Row
            style={[
              styles.reflectionHeading,
              !dark && { width: storyReadingWidth },
            ]}
          >
            <Icon
              name="sparkles-outline"
              color={dark ? "#FFD69A" : daylightPhotoInk.detail}
              size={17}
            />
            <AppText
              variant="heading"
              accessibilityRole="header"
              color={dark ? undefined : daylightPhotoInk.title}
              style={[styles.sectionTitle, styles.flex]}
            >
              Your weekly story
            </AppText>
          </Row>
          <AppText
            color={dark ? colors.text : daylightPhotoInk.detail}
            style={[
              styles.reflectionCopy,
              (large || compact) && styles.fullCopy,
              !dark && { width: storyReadingWidth },
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
                backgroundColor: colors.lavenderAction,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <AppText
              variant="label"
              color={colors.lavenderActionText}
              style={styles.reflectLabel}
            >
              {savedStory ? "Reopen weekly story" : "Look back on my week"}
            </AppText>
            <Icon
              name="arrow-forward"
              size={15}
              color={colors.lavenderActionText}
            />
          </Pressable>
        </View>
        <WhatHelpedCard now={now} />
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
            {progress && goal?.active !== false && large && (
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
                <AppText
                  variant="caption"
                  color={muted}
                  style={styles.goalCopy}
                >
                  {progress.percentage}% complete
                </AppText>
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
        <HabitJourneyEntry
          now={now}
          period={period}
          startDay={report.startDay}
          endDay={report.endDay}
          today={today}
          style={[styles.panel, panel]}
          mutedColor={muted}
        />
        {savedPlans.length > 0 && (
          <View style={[styles.panel, panel, styles.planPanel]}>
            <Row style={styles.planHeading}>
              <Icon name="calendar-outline" color={progressInk} size={18} />
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={[styles.sectionTitle, styles.flex]}
              >
                Wellness plan progress
              </AppText>
            </Row>
            {savedPlans.map(({ plan, completed, total }) => {
              const title = plan.title || "Your wellness plan";
              const label = `${completed} of ${total} days complete`;
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}, ${label}`}
                  onPress={() =>
                    app.navigate(
                      plan.programId
                        ? routes.guidedProgram
                        : routes.wellnessPlan,
                      { id: plan.programId ?? plan.id },
                    )
                  }
                  style={({ pressed }) => [
                    styles.planRow,
                    {
                      borderTopColor: panel.borderColor,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <View style={styles.flex}>
                    <AppText variant="label">{title}</AppText>
                    <AppText
                      variant="caption"
                      color={muted}
                      style={{ marginTop: 3 }}
                    >
                      {label}
                    </AppText>
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
                            width: `${(completed / total) * 100}%`,
                            backgroundColor: progressInk,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Icon name="chevron-forward" size={17} />
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={[styles.panel, panel, styles.story]}>
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
                    <View
                      style={[
                        styles.badgeStatus,
                        { backgroundColor: panel.backgroundColor },
                      ]}
                    >
                      <Icon
                        name={
                          item.earned
                            ? "checkmark-circle"
                            : "lock-closed-outline"
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
                  </View>
                  <AppText variant="caption" style={styles.badgeLabel}>
                    {item.title}
                  </AppText>
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
  androidHero: { paddingBottom: spacing.row },
  heroFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 49 },
  iconTarget: {
    width: 48,
    minHeight: 48,
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
  androidSegments: {
    minHeight: 50,
    paddingVertical: 0,
    marginTop: spacing.compact,
  },
  segment: {
    flex: 1,
    minWidth: 0,
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
  androidBody: { gap: spacing.row },
  panel: { borderWidth: 1, borderRadius: 17, overflow: "hidden" },
  latest: { padding: spacing.card, minHeight: 104, justifyContent: "center" },
  latestRow: { gap: spacing.row },
  latestIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  latestCopy: { flex: 1, minWidth: 0, gap: 2 },
  latestTitle: { fontSize: 23, lineHeight: 27 },
  checkinPetal: { width: 74, height: 74 },
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
    justifyContent: "center",
  },
  androidMetric: {
    minHeight: 92,
    paddingVertical: spacing.compact,
    gap: 3,
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
  androidCalendar: { paddingBottom: spacing.compact },
  compactCalendar: { paddingHorizontal: 4 },
  calendarHead: { justifyContent: "space-between", gap: 4 },
  month: { flex: 1, textAlign: "center", fontSize: 20, lineHeight: 25 },
  weekdays: { flexDirection: "row", marginBottom: 4 },
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
  androidReflection: { minHeight: 128, padding: spacing.row },
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
  planPanel: { paddingHorizontal: 15 },
  planHeading: { paddingVertical: 12, gap: 8 },
  planRow: {
    minHeight: 54,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  badgeStatus: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
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
  historyShell: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  recordPage: { gap: spacing.section },
  recordCover: {
    minHeight: 168,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: spacing.card,
    gap: spacing.row,
    overflow: "hidden",
  },
  recordHeadline: { flex: 1, minWidth: 0, gap: 4 },
  recordBotanical: {
    width: 208,
    height: 208,
    top: -42,
    right: -30,
    opacity: 0.34,
  },
  recordNote: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.card,
    gap: spacing.compact,
  },
  recordTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  recordTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: "100%",
  },
  historyDayEnd: { marginBottom: spacing.section },
  historyDate: {
    paddingBottom: spacing.compact,
    gap: spacing.compact,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyDateText: { flex: 1, minWidth: 0, fontSize: 22, lineHeight: 26 },
  historyEntry: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
  },
  historyEntryRow: {
    minHeight: 66,
    paddingVertical: spacing.row,
    alignItems: "flex-start",
  },
  historyEntryCopy: { flex: 1, minWidth: 0, gap: 2 },
  historyEntryTitle: { fontSize: 22, lineHeight: 27 },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  historyChevron: { alignSelf: "center" },
  streakCard: { marginBottom: spacing.row },
  milestoneGroup: { gap: 4, marginBottom: spacing.section },
  milestoneEntry: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.compact,
    paddingHorizontal: 6,
  },
  milestoneDetail: {
    alignItems: "center",
    borderRadius: 20,
    overflow: "hidden",
    padding: spacing.section,
    gap: spacing.row,
  },
  milestoneRule: { marginTop: spacing.section },
  center: { textAlign: "center" },
});
