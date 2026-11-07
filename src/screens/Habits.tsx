import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  addHabitDays,
  habitDay,
  habitRevisionOn,
  habitTarget,
  habitWeekStart,
  isHabitScheduled,
  type Habit,
  type HabitProgress,
  type HabitStatus,
} from "../../server/src/habit-contract";
import {
  displayHabitDay,
  gardenLabels,
  GardenScene,
  goalLabel,
  habitCategoryLabels,
  HabitChoice,
  HabitIconBadge,
  HabitLink,
  HabitMeter,
  habitToday,
  HabitWeekStrip,
  occurrenceLabel,
  progressFor,
  reminderLabel,
  scheduleLabel,
  starterHabits,
  useHabitClock,
} from "../habits-ui";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Button,
  Card,
  coverImageStyle,
  Icon,
  Input,
  Screen,
} from "../ui";
import { HabitReminderEditor, HabitsEditor } from "./HabitsEditor";
import { HabitGardenScreen, HabitInsightsScreen } from "./HabitsInsights";

const statusLabels: Record<HabitStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};
const emptyArtwork = {
  light: require("../../assets/redesign-today-scene-light.jpg"),
  dark: require("../../assets/redesign-today-scene-dark.jpg"),
};
const botanical = require("../../assets/botanical-compact.png");
const displayLimit = 12;

type Occurrence = { habit: Habit; day: string; log?: HabitProgress };

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function useLogProgress({ habit, day, log }: Occurrence) {
  const app = useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const writing = useRef(false);
  useEffect(() => {
    setError("");
    setNotice("");
  }, [day]);

  async function write(amount: number, sessionId?: string) {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const saved = await app.setHabitProgress(habit.id, {
        day,
        amount,
        expectedRevision: log?.revision ?? 0,
        sessionId,
      });
      setNotice(
        saved.complete
          ? "Habit completed."
          : sessionId
            ? "Breathing Moment added."
            : "Progress saved.",
      );
    } catch (cause) {
      setError(
        errorText(
          cause,
          "Progress could not be saved. Try again when you are connected.",
        ),
      );
    } finally {
      writing.current = false;
      setPending(false);
    }
  }
  return { write, pending, error, notice };
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <AppText color={colors.muted}>{subtitle}</AppText>
    </View>
  );
}

function TodayHabitRow({ occurrence }: { occurrence: Occurrence }) {
  const app = useApp();
  const { colors } = useTheme();
  const { habit, day, log } = occurrence;
  const { write, pending, error } = useLogProgress(occurrence);
  const goal = habitRevisionOn(habit, day)?.goal ?? habit.goal;
  const binary = goal.type === "completion";
  const complete = log?.complete === true;
  const time = habit.reminderTime ? reminderLabel(habit.reminderTime) : "";
  const progress = occurrenceLabel(habit, day, log);
  const isEditable = habit.status === "active" || !!log;
  const increment = goal.type === "duration" ? "Add 1 min" : "Add one";
  const action = complete && binary ? "Undo" : binary ? "Complete" : increment;
  const canLog = isEditable && (!complete || binary);
  return (
    <Card style={styles.habitRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${habit.name}`}
        onPress={() => app.navigate(routes.habitDetails, { id: habit.id })}
        style={({ pressed }) => [
          styles.habitIdentity,
          pressed && styles.pressed,
        ]}
      >
        <HabitIconBadge icon={habit.icon} color={habit.color} />
        <View style={styles.fill}>
          <AppText variant="label">{habit.name}</AppText>
          {!!habit.description && (
            <AppText variant="caption" color={colors.muted} numberOfLines={2}>
              {habit.description}
            </AppText>
          )}
          <AppText
            variant="caption"
            color={complete ? colors.sageText : colors.muted}
          >
            {progress}
            {time ? ` · ${time}` : ""}
          </AppText>
        </View>
        <Icon name="chevron-forward" color={colors.muted} size={17} />
      </Pressable>
      {!binary && (
        <HabitMeter
          value={log?.amount ?? 0}
          total={log?.target ?? habitTarget(goal)}
          label={`Progress for ${habit.name}`}
        />
      )}
      {canLog && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action} ${habit.name}`}
          accessibilityState={{ disabled: pending, busy: pending }}
          disabled={pending}
          onPress={() =>
            void write(
              complete && binary ? 0 : binary ? 1 : (log?.amount ?? 0) + 1,
            )
          }
          style={({ pressed }) => [
            styles.inlineAction,
            {
              backgroundColor: complete ? colors.surface2 : colors.sageSurface,
              opacity: pending || pressed ? 0.72 : 1,
            },
          ]}
        >
          <Icon
            name={
              complete ? "arrow-undo-outline" : binary ? "checkmark" : "add"
            }
            color={complete ? colors.muted : colors.sageText}
            size={17}
          />
          <AppText
            variant="caption"
            color={complete ? colors.text : colors.sageText}
          >
            {pending ? "Saving…" : action}
          </AppText>
        </Pressable>
      )}
      {!!error && (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          color={colors.danger}
        >
          {error}
        </AppText>
      )}
    </Card>
  );
}

function HabitDashboard() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { habits, habitProgress, habitGarden } = app.data;
  const now = useHabitClock(habits);
  const today = habitToday(undefined, now);
  const [showAll, setShowAll] = useState(false);
  const garden = habitGarden[0];
  const indexedProgress = useMemo(
    () =>
      new Map(
        habitProgress.map((item) => [`${item.habitId}:${item.day}`, item]),
      ),
    [habitProgress],
  );
  const occurrences: Occurrence[] = habits.flatMap((habit) => {
    const day = habitToday(habit, now);
    if (!isHabitScheduled(habit, day)) return [];
    const log = indexedProgress.get(`${habit.id}:${day}`);
    return habit.status === "active" || log ? [{ habit, day, log }] : [];
  });
  const fixed = occurrences.filter(
    ({ habit, day }) => habitRevisionOn(habit, day)?.schedule.type !== "weekly",
  );
  const flexible = occurrences.filter(
    ({ habit, day }) => habitRevisionOn(habit, day)?.schedule.type === "weekly",
  );
  const done = fixed.filter(({ log }) => log?.complete).length;
  const flexDone = flexible.filter(({ log }) => log?.complete).length;
  const ordered = [...fixed].sort(
    (a, b) =>
      Number(!!a.log?.complete) - Number(!!b.log?.complete) ||
      (a.habit.reminderTime ?? "99:99").localeCompare(
        b.habit.reminderTime ?? "99:99",
      ),
  );
  const upcoming = useMemo(() => {
    const active = habits.filter(({ status }) => status === "active");
    for (let offset = 0; offset < 8; offset++) {
      const entries = active.flatMap((habit) => {
        const day = addHabitDays(habitToday(habit, now), offset);
        const revision = habitRevisionOn(habit, day);
        if (
          !isHabitScheduled(habit, day) ||
          revision?.schedule.type === "weekly" ||
          indexedProgress.get(`${habit.id}:${day}`)?.complete
        )
          return [];
        return [{ habit, day, offset }];
      });
      if (entries.length)
        return entries.sort((a, b) =>
          (a.habit.reminderTime ?? "99:99").localeCompare(
            b.habit.reminderTime ?? "99:99",
          ),
        )[0];
    }
  }, [habits, indexedProgress, now]);
  return (
    <Screen title="Solace Habits" back={app.back}>
      <View style={styles.page}>
        <View style={styles.dashboardHeading}>
          <Image
            accessible={false}
            pointerEvents="none"
            source={botanical}
            resizeMode="contain"
            fadeDuration={0}
            style={[
              styles.botanical,
              { opacity: resolved === "dark" ? 0.55 : 0.33 },
            ]}
          />
          <Heading
            title="Your habits"
            subtitle="Small steps, beautiful progress."
          />
        </View>
        {!habits.length ? (
          <View style={styles.section}>
            <Card style={styles.emptyHero}>
              <View style={styles.emptyArt}>
                <Image
                  accessible={false}
                  source={emptyArtwork[resolved]}
                  resizeMode="cover"
                  fadeDuration={0}
                  style={coverImageStyle}
                />
              </View>
              <View style={styles.section}>
                <AppText variant="heading">Begin with one small habit</AppText>
                <AppText color={colors.muted}>
                  A tiny action can make space for something that matters to
                  you. Pick something easy to return to.
                </AppText>
                <Button
                  title="Create your first habit"
                  icon="add"
                  onPress={() => app.navigate(routes.habitCreate)}
                />
              </View>
            </Card>
            <AppText variant="label">Try a starter</AppText>
            <View style={styles.choices}>
              {[starterHabits[0], starterHabits[1], starterHabits[4]].map(
                (item) => (
                  <HabitChoice
                    key={item.name}
                    label={item.name}
                    selected={false}
                    onPress={() =>
                      app.navigate(routes.habitCreate, { suggestion: item })
                    }
                  />
                ),
              )}
            </View>
          </View>
        ) : (
          <>
            <Card style={styles.section}>
              <AppText variant="heading">Today's progress</AppText>
              <AppText variant="title">
                {fixed.length
                  ? `${done} of ${fixed.length} completed`
                  : "0 scheduled today"}
              </AppText>
              {fixed.length > 0 && (
                <>
                  <HabitMeter
                    value={done}
                    total={fixed.length}
                    label="Scheduled habit progress today"
                  />
                  <AppText variant="caption" color={colors.muted}>
                    {Math.round((done * 100) / fixed.length)}% of scheduled
                    habits
                  </AppText>
                </>
              )}
              <AppText color={colors.muted}>
                {fixed.length === 0
                  ? "You have no fixed habits scheduled today."
                  : done === fixed.length
                    ? "You made time for each habit today. Take a moment to notice that."
                    : done
                      ? "Every step is worth noticing."
                      : "Begin wherever it feels easy today."}
              </AppText>
              {flexDone > 0 && (
                <AppText variant="caption" color={colors.lavenderText}>
                  {flexDone} flexible {flexDone === 1 ? "habit" : "habits"}{" "}
                  completed today
                </AppText>
              )}
            </Card>
            <Button
              title="Add habit"
              icon="add"
              onPress={() => app.navigate(routes.habitCreate)}
            />
            <View style={styles.section}>
              <AppText variant="heading">Today's habits</AppText>
              {ordered.length ? (
                ordered
                  .slice(0, showAll ? ordered.length : displayLimit)
                  .map((item) => (
                    <TodayHabitRow
                      key={`${item.habit.id}-${item.day}`}
                      occurrence={item}
                    />
                  ))
              ) : (
                <AppText color={colors.muted}>
                  Nothing fixed on the calendar. You can rest or choose a
                  flexible habit.
                </AppText>
              )}
              {ordered.length > displayLimit && !showAll && (
                <Button
                  title="Show all scheduled today"
                  variant="ghost"
                  onPress={() => setShowAll(true)}
                />
              )}
            </View>
            {flexible.length > 0 && (
              <View style={styles.section}>
                <AppText variant="heading">Flexible this week</AppText>
                <AppText variant="caption" color={colors.muted}>
                  These are available today. You choose which days count toward
                  your weekly goals.
                </AppText>
                {flexible
                  .slice(0, showAll ? flexible.length : displayLimit)
                  .map((item) => (
                    <TodayHabitRow
                      key={`${item.habit.id}-${item.day}`}
                      occurrence={item}
                    />
                  ))}
                {flexible.length > displayLimit && !showAll && (
                  <Button
                    title="Show all flexible habits"
                    variant="ghost"
                    onPress={() => setShowAll(true)}
                  />
                )}
              </View>
            )}
            <View style={styles.section}>
              <AppText variant="heading">Coming up</AppText>
              {upcoming ? (
                <HabitLink
                  title={upcoming.habit.name}
                  detail={`${upcoming.offset === 0 ? "Today" : upcoming.offset === 1 ? "Tomorrow" : displayHabitDay(upcoming.day, { weekday: "long", day: "numeric", month: "short" })}${upcoming.habit.reminderTime ? ` · ${reminderLabel(upcoming.habit.reminderTime)}` : ""}`}
                  icon="time-outline"
                  onPress={() =>
                    app.navigate(routes.habitDetails, { id: upcoming.habit.id })
                  }
                />
              ) : (
                <AppText color={colors.muted}>
                  Nothing else is scheduled this week. There is room to take it
                  easy.
                </AppText>
              )}
            </View>
            <View style={styles.section}>
              <AppText variant="heading">Your week</AppText>
              <HabitWeekStrip today={today} progress={habitProgress} />
              <HabitLink
                title="See habit insights"
                icon="bar-chart-outline"
                onPress={() => app.navigate(routes.habitInsights)}
              />
            </View>
          </>
        )}
        <View style={styles.section}>
          <AppText variant="heading">Your Growing Garden</AppText>
          <GardenScene compact stage={garden?.stage ?? "seed"} />
          <HabitLink
            title="Open garden"
            detail={
              garden?.earnedTotal
                ? `${gardenLabels[garden.stage]} · ${garden.earnedTotal} ${garden.earnedTotal === 1 ? "completed habit day" : "completed habit days"} earned`
                : "Your first completion will grow a sprout."
            }
            icon="leaf-outline"
            onPress={() => app.navigate(routes.habitGarden)}
          />
        </View>
        <HabitLink
          title="Habit library"
          detail="Find a starter or manage your habits."
          icon="grid-outline"
          onPress={() => app.navigate(routes.habitLibrary)}
        />
      </View>
    </Screen>
  );
}

function HabitLibrary() {
  const app = useApp();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<HabitStatus | "all">("all");
  const [limit, setLimit] = useState(displayLimit);
  const habits = app.data.habits.filter(
    (habit) => filter === "all" || habit.status === filter,
  );
  return (
    <Screen title="Habit library" back={app.back}>
      <View style={styles.page}>
        <Heading
          title="Find your rhythm"
          subtitle="Keep a habit that fits, or begin with a gentle starter."
        />
        <Button
          title="Create a custom habit"
          icon="add"
          onPress={() => app.navigate(routes.habitCreate)}
        />
        <View style={styles.section}>
          <AppText variant="heading">Your saved habits</AppText>
          <View style={styles.choices}>
            {(["all", "active", "paused", "archived"] as const).map((item) => (
              <HabitChoice
                key={item}
                label={item === "all" ? "All" : statusLabels[item]}
                selected={filter === item}
                onPress={() => {
                  setFilter(item);
                  setLimit(displayLimit);
                }}
              />
            ))}
          </View>
          {!habits.length && (
            <AppText color={colors.muted}>
              {filter === "all"
                ? "The habits you save will appear here."
                : `You have no ${filter} habits.`}
            </AppText>
          )}
          {habits.slice(0, limit).map((habit) => (
            <HabitLink
              key={habit.id}
              title={habit.name}
              detail={`${statusLabels[habit.status]} · ${scheduleLabel(habit.schedule)}`}
              icon="leaf-outline"
              onPress={() =>
                app.navigate(routes.habitDetails, { id: habit.id })
              }
            />
          ))}
          {habits.length > limit && (
            <Button
              title="Show more habits"
              variant="ghost"
              onPress={() => setLimit((old) => old + displayLimit)}
            />
          )}
        </View>
        <View style={styles.section}>
          <AppText variant="heading">Starter ideas</AppText>
          {starterHabits.map((item) => (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityLabel={`Use starter ${item.name}`}
              onPress={() =>
                app.navigate(routes.habitCreate, { suggestion: item })
              }
              style={({ pressed }) => [
                styles.libraryStarter,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <HabitIconBadge icon={item.icon} color={item.color} />
              <View style={styles.fill}>
                <AppText variant="label">{item.name}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {goalLabel(item.goal)} · {scheduleLabel(item.schedule)}
                </AppText>
              </View>
              <Icon
                name="add-circle-outline"
                size={20}
                color={colors.lavenderText}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

function DetailProgress({ occurrence }: { occurrence: Occurrence }) {
  const app = useApp();
  const { colors } = useTheme();
  const { habit, day, log } = occurrence;
  const revision = habitRevisionOn(habit, day);
  const goal = revision?.goal ?? habit.goal;
  const amount = log?.amount ?? 0;
  const target = log?.target ?? habitTarget(goal);
  const [entered, setEntered] = useState(String(amount));
  const [inputError, setInputError] = useState("");
  const { write, pending, notice, error } = useLogProgress(occurrence);
  useEffect(() => {
    setEntered(String(amount));
  }, [amount]);
  const today = habitToday(habit);
  const canLog =
    !!log ||
    (habit.status === "active" &&
      day === today &&
      isHabitScheduled(habit, day));
  const usedSessions = new Set(
    app.data.habitProgress.flatMap((item) => item.linkedSessionIds ?? []),
  );
  const sessions =
    canLog &&
    day === today &&
    revision?.activity === "breathing" &&
    goal.type === "duration"
      ? app.data.sessions.flatMap((item) => {
          if (
            typeof item.id !== "string" ||
            item.completed !== true ||
            (item.activity?.type ?? item.type) !== "breathing" ||
            usedSessions.has(item.id)
          )
            return [];
          const duration = Number(item.durationSec ?? item.durationSeconds);
          const date = new Date(item.createdAt);
          return duration >= 60 &&
            Number.isFinite(date.valueOf()) &&
            habitDay(habit.timeZone, date) === day
            ? [
                {
                  id: item.id,
                  title: item.title as string | undefined,
                  minutes: Math.floor(duration / 60),
                },
              ]
            : [];
        })
      : [];
  return (
    <Card style={styles.section}>
      <AppText variant="heading">
        {day === today
          ? "Today's progress"
          : displayHabitDay(day, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
      </AppText>
      <AppText
        variant="label"
        color={log?.complete ? colors.sageText : colors.text}
      >
        {occurrenceLabel(habit, day, log)}
      </AppText>
      {goal.type !== "completion" && (
        <HabitMeter
          value={amount}
          total={target}
          label={`Progress toward ${habit.name}`}
        />
      )}
      {canLog &&
        (goal.type === "completion" ? (
          <Button
            title={log?.complete ? "Undo completion" : "Mark complete"}
            icon={log?.complete ? "arrow-undo-outline" : "checkmark"}
            variant={log?.complete ? "secondary" : "primary"}
            loading={pending}
            onPress={() => void write(log?.complete ? 0 : 1)}
          />
        ) : (
          <View style={styles.section}>
            <AppText variant="caption" color={colors.muted}>
              {goal.type === "duration"
                ? "Minutes completed"
                : `Amount completed (${goal.unit})`}
            </AppText>
            <Input
              accessibilityLabel="Total progress"
              keyboardType="number-pad"
              maxLength={5}
              value={entered}
              onChangeText={(value) => {
                setEntered(value);
                setInputError("");
              }}
              editable={!pending}
            />
            <Button
              title="Save progress"
              icon="checkmark"
              loading={pending}
              onPress={() => {
                const value = Number(entered);
                if (
                  !/^\d+$/.test(entered.trim()) ||
                  !Number.isInteger(value) ||
                  value > 10000
                ) {
                  setInputError("Enter a whole number from 0 to 10,000.");
                  return;
                }
                void write(value);
              }}
            />
            {amount > 0 && (
              <Button
                title="Reset amount"
                variant="ghost"
                disabled={pending}
                onPress={() => void write(0)}
              />
            )}
          </View>
        ))}
      {!canLog && (
        <AppText variant="caption" color={colors.muted}>
          {habit.status === "active"
            ? "There is no scheduled occurrence to log on this day."
            : "New progress is on hold while this habit is paused or archived."}
        </AppText>
      )}
      {sessions.length > 0 && (
        <View style={styles.section}>
          <AppText variant="label">Count a completed breathing Moment</AppText>
          <AppText variant="caption" color={colors.muted}>
            Each saved Moment can be applied to a habit once.
          </AppText>
          {sessions.slice(0, 6).map((item) => (
            <Button
              key={item.id}
              title={`Apply ${item.title || "breathing Moment"} · ${item.minutes} min`}
              variant="secondary"
              disabled={pending}
              onPress={() => void write(amount, item.id)}
            />
          ))}
        </View>
      )}
      {!sessions.length && canLog && revision?.activity === "breathing" && (
        <AppText variant="caption" color={colors.muted}>
          Completed breathing Moments from this day can be applied here once
          they are saved.
        </AppText>
      )}
      {!!notice && (
        <AppText
          variant="caption"
          accessibilityLiveRegion="polite"
          color={colors.sageText}
        >
          {notice}
        </AppText>
      )}
      {!!(error || inputError) && (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          color={colors.danger}
        >
          {inputError || error}
        </AppText>
      )}
    </Card>
  );
}

function HabitDetails({ habit }: { habit: Habit }) {
  const app = useApp();
  const { colors } = useTheme();
  const now = useHabitClock(habit);
  const today = habitToday(habit, now);
  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    typeof app.params.day === "string" &&
    app.data.habitProgress.some(
      (item) => item.habitId === habit.id && item.day === app.params.day,
    )
      ? app.params.day
      : null,
  );
  const day = selectedDay ?? today;
  const [limit, setLimit] = useState(8);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const writing = useRef(false);
  const mounted = useRef(true);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const logs = app.data.habitProgress
    .filter((item) => item.habitId === habit.id)
    .sort((a, b) => b.day.localeCompare(a.day));
  const log = progressFor(logs, habit.id, day);
  const week = habitWeekStart(day);
  const weeklyDone = logs.filter(
    (item) =>
      item.complete && item.day >= week && item.day <= addHabitDays(week, 6),
  ).length;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function manage(action: HabitStatus | "delete") {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (action === "delete") {
        await app.deleteHabit(habit.id);
        // The confirmed removal can replace this screen before local reminder
        // cleanup returns. The router scopes Back to this exact detail entry.
        app.back();
      } else {
        const result = await app.editHabit(habit.id, habit.revision, {
          status: action,
        });
        if (!mounted.current) return;
        setConfirm(null);
        setMessage(
          result.reminderNotice ||
            (action === "active"
              ? "Habit resumed."
              : action === "paused"
                ? "Habit paused. Your history is still here."
                : "Habit archived. Its history is still here."),
        );
      }
    } catch (cause) {
      if (mounted.current)
        setError(errorText(cause, "Your changes could not be saved."));
    } finally {
      writing.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <Screen title="Habit details" back={app.back} scrollRef={scroll}>
      <View style={styles.page}>
        <View style={styles.heading}>
          <HabitIconBadge icon={habit.icon} color={habit.color} size={59} />
          <AppText variant="title" accessibilityRole="header">
            {habit.name}
          </AppText>
          <AppText variant="label" color={colors.lavenderText}>
            {habitCategoryLabels[habit.category]} · {statusLabels[habit.status]}
          </AppText>
          {!!habit.description && (
            <AppText color={colors.muted}>{habit.description}</AppText>
          )}
          <AppText>
            {goalLabel(habit.goal)} · {scheduleLabel(habit.schedule)}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            Calendar time zone {habit.timeZone}
          </AppText>
        </View>
        <DetailProgress key={day} occurrence={{ habit, day, log }} />
        {day !== today && (
          <Button
            title="Back to today's progress"
            variant="ghost"
            onPress={() => setSelectedDay(null)}
          />
        )}
        <View style={styles.section}>
          <AppText variant="heading">Your week</AppText>
          <HabitWeekStrip today={day} progress={logs} />
          {habit.schedule.type === "weekly" && (
            <AppText variant="caption" color={colors.muted}>
              {weeklyDone} completed · {habit.schedule.daysPerWeek} flexible{" "}
              {habit.schedule.daysPerWeek === 1 ? "day" : "days"} per week
            </AppText>
          )}
          <HabitLink
            title="View habit insights"
            icon="bar-chart-outline"
            onPress={() => app.navigate(routes.habitInsights, { id: habit.id })}
          />
          {habit.status !== "archived" && (
            <HabitLink
              title="Make this habit easier with Solace"
              detail="Review a suggested adjustment before saving."
              icon="sparkles-outline"
              onPress={() =>
                app.navigate(routes.companion, {
                  habitAssistant: "simplify",
                  habitAssistantId: habit.id,
                })
              }
            />
          )}
        </View>
        <View style={styles.section}>
          <AppText variant="heading">Completion history</AppText>
          {!logs.length && (
            <AppText color={colors.muted}>
              Your first recorded action will appear here.
            </AppText>
          )}
          {logs.slice(0, limit).map((item) => (
            <HabitLink
              key={item.id}
              title={displayHabitDay(item.day, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
              detail={occurrenceLabel(habit, item.day, item)}
              icon={item.complete ? "checkmark-circle-outline" : "time-outline"}
              onPress={() => {
                setSelectedDay(item.day);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }}
            />
          ))}
          {logs.length > limit && (
            <Button
              title="Show more history"
              variant="ghost"
              onPress={() => setLimit((old) => old + 8)}
            />
          )}
        </View>
        <View style={styles.section}>
          <AppText variant="heading">Manage habit</AppText>
          <HabitLink
            title="Habit reminder"
            detail={
              habit.reminderTime
                ? `${reminderLabel(habit.reminderTime)} · saved preference`
                : "Off"
            }
            icon="notifications-outline"
            onPress={() =>
              app.navigate(routes.habitReminders, { id: habit.id })
            }
          />
          {habit.status !== "archived" && (
            <Button
              title="Edit habit"
              variant="secondary"
              disabled={pending}
              onPress={() => app.navigate(routes.habitEdit, { id: habit.id })}
            />
          )}
          {habit.status !== "archived" && (
            <Button
              title={habit.status === "active" ? "Pause habit" : "Resume habit"}
              variant="secondary"
              disabled={pending}
              onPress={() =>
                void manage(habit.status === "active" ? "paused" : "active")
              }
            />
          )}
          {habit.status !== "archived" && (
            <Button
              title="Archive habit"
              variant="ghost"
              disabled={pending}
              onPress={() => setConfirm("archive")}
            />
          )}
          <Button
            title="Delete habit"
            variant="ghost"
            disabled={pending}
            onPress={() => setConfirm("delete")}
          />
          {confirm && (
            <Card style={styles.section}>
              <AppText variant="label">
                {confirm === "archive"
                  ? "Archive this habit?"
                  : "Delete this habit and its history?"}
              </AppText>
              <AppText variant="caption" color={colors.muted}>
                {confirm === "archive"
                  ? "Its future schedule and reminders will stop. Its recorded progress stays."
                  : "This permanently removes the habit and its recorded history. Earned garden growth stays."}
              </AppText>
              <Button
                title={
                  confirm === "archive" ? "Confirm archive" : "Confirm deletion"
                }
                loading={pending}
                onPress={() =>
                  void manage(confirm === "archive" ? "archived" : "delete")
                }
              />
              <Button
                title="Cancel"
                variant="ghost"
                disabled={pending}
                onPress={() => setConfirm(null)}
              />
            </Card>
          )}
          {!!message && (
            <AppText accessibilityLiveRegion="polite" color={colors.sageText}>
              {message}
            </AppText>
          )}
          {!!error && (
            <AppText accessibilityRole="alert" color={colors.danger}>
              {error}
            </AppText>
          )}
        </View>
      </View>
    </Screen>
  );
}

function HabitReminderList() {
  const app = useApp();
  const { colors } = useTheme();
  const habits = app.data.habits.filter(({ status }) => status !== "archived");
  return (
    <Screen title="Habit reminders" back={app.back}>
      <View style={styles.page}>
        <Heading
          title="Gentle reminders"
          subtitle="Set a time for the habits you want a nudge for. Notifications use the same device settings as your other Solace reminders."
        />
        {!habits.length && (
          <AppText color={colors.muted}>
            Create a habit first to set a reminder.
          </AppText>
        )}
        {habits.map((habit) => (
          <HabitLink
            key={habit.id}
            title={habit.name}
            icon="notifications-outline"
            detail={
              habit.status === "paused"
                ? "Paused"
                : habit.reminderTime
                  ? `${reminderLabel(habit.reminderTime)} · saved preference`
                  : "Off"
            }
            onPress={() =>
              app.navigate(routes.habitReminders, { id: habit.id })
            }
          />
        ))}
        <Button
          title="View your habits"
          variant="secondary"
          onPress={() => app.navigate(routes.habits)}
        />
      </View>
    </Screen>
  );
}

export function HabitsScreen({ name }: { name: string }) {
  const app = useApp();
  const habit = app.data.habits.find(({ id }) => id === app.params.id);
  if (name === routes.habitCreate)
    return <HabitsEditor suggestion={app.params.suggestion} />;
  if (name === routes.habitLibrary) return <HabitLibrary />;
  if (name === routes.habitInsights && (habit || app.params.id == null))
    return <HabitInsightsScreen key={habit?.id ?? "all"} habit={habit} />;
  if (name === routes.habitGarden) return <HabitGardenScreen />;
  if (name === routes.habits) return <HabitDashboard />;
  if (name === routes.habitReminders && app.params.id == null)
    return <HabitReminderList />;
  if (habit) {
    if (name === routes.habitEdit)
      return (
        <HabitsEditor
          key={habit.id}
          habit={habit}
          suggestion={app.params.suggestion}
          suggestionRevision={app.params.suggestionRevision}
        />
      );
    if (name === routes.habitDetails)
      return <HabitDetails key={habit.id} habit={habit} />;
    if (name === routes.habitReminders)
      return <HabitReminderEditor key={habit.id} habit={habit} />;
  }
  return (
    <Screen title="Habit unavailable" back={app.back}>
      <View style={styles.section}>
        <AppText>
          This habit may have been removed. Your current habits are still
          available.
        </AppText>
        <Button
          title="View your habits"
          onPress={() => app.navigate(routes.habits)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  section: { gap: 10 },
  heading: { gap: 8 },
  dashboardHeading: { minHeight: 80, justifyContent: "center" },
  botanical: {
    position: "absolute",
    width: 112,
    height: 86,
    right: -8,
    top: -16,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  fill: { flex: 1, gap: 4 },
  emptyHero: { padding: 12, gap: 13 },
  emptyArt: { overflow: "hidden", borderRadius: 14, height: 134 },
  habitRow: { padding: 12, gap: 10 },
  habitIdentity: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: 9,
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 13,
    minHeight: 44,
    alignSelf: "flex-start",
    paddingHorizontal: 11,
  },
  libraryStarter: {
    minHeight: 60,
    paddingVertical: 8,
    gap: 11,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.72 },
});
