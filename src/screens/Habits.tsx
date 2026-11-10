import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
  useHabitClock,
} from "../habits-ui";
import { routes } from "../routes";
import { spacing } from "../layout";
import { EditorialSection } from "../NestedDesign";
import { useTabResetGuard } from "../navigation-reset";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  Card,
  Icon,
  Input,
  NestedState,
  Row,
  Screen,
} from "../ui";
import { HabitReminderEditor, HabitsEditor } from "./HabitsEditor";
import { HabitsHub } from "./HabitsHub";

const statusLabels: Record<HabitStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};
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
  useTabResetGuard(
    pending ||
      (canLog &&
        goal.type !== "completion" &&
        entered.trim() !== String(amount)),
    pending ? "saving" : "dirty",
  );
  const canLinkSession =
    canLog &&
    day === today &&
    revision?.activity === "breathing" &&
    goal.type === "duration";
  const { habitProgress, sessions: savedSessions } = app.data;
  const sessions = useMemo(() => {
    if (!canLinkSession) return [];
    const usedSessions = new Set(
      habitProgress.flatMap((item) => item.linkedSessionIds ?? []),
    );
    return savedSessions.flatMap((item) => {
      if (
        typeof item.id !== "string" ||
        item.completed !== true ||
        (item.activity?.type ?? item.type) !== "breathing" ||
        usedSessions.has(item.id)
      )
        return [];
      const duration = Number(item.durationSec ?? item.durationSeconds);
      const date = new Date(item.createdAt);
      if (
        duration < 60 ||
        !Number.isFinite(date.valueOf()) ||
        habitDay(habit.timeZone, date) !== day ||
        !Number.isFinite(duration)
      )
        return [];
      return [
        {
          id: item.id,
          title: item.title as string | undefined,
          minutes: Math.floor(duration / 60),
        },
      ];
    });
  }, [canLinkSession, day, habit.timeZone, habitProgress, savedSessions]);
  return (
    <View
      style={[
        styles.progressSheet,
        { backgroundColor: colors.lavenderSurface },
      ]}
    >
      <AppText variant="heading" accessibilityRole="header">
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
    </View>
  );
}

function HabitDetails({
  habit,
  embedded,
}: {
  habit: Habit;
  embedded: boolean;
}) {
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
      setError(errorText(cause, "Your changes could not be saved."));
    } finally {
      writing.current = false;
      setPending(false);
    }
  }

  return (
    <Screen
      variant="nested"
      edgeToEdgeTop={embedded}
      title={embedded ? undefined : "Habit details"}
      back={embedded ? undefined : app.back}
      scrollRef={scroll}
    >
      <View style={styles.page}>
        <View style={[styles.heading, { backgroundColor: colors.sageSurface }]}>
          <BotanicalBackdrop style={styles.coverLeaves} />
          <Row style={styles.headingStatus}>
            <HabitIconBadge icon={habit.icon} color={habit.color} size={48} />
            <AppText
              variant="label"
              color={colors.sageText}
              style={styles.fill}
            >
              {habitCategoryLabels[habit.category]} ·{" "}
              {statusLabels[habit.status]}
            </AppText>
          </Row>
          <AppText
            variant="display"
            accessibilityRole="header"
            style={styles.habitTitle}
          >
            {habit.name}
          </AppText>
          {!!habit.description && (
            <AppText color={colors.muted}>{habit.description}</AppText>
          )}
          <View style={[styles.schedule, { borderColor: colors.border }]}>
            <AppText variant="label">
              {goalLabel(habit.goal)} · {scheduleLabel(habit.schedule)}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              Calendar time zone {habit.timeZone}
            </AppText>
          </View>
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
          <EditorialSection title="Your week" />
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
          <EditorialSection title="Completion history" />
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
          <EditorialSection title="Manage habit" />
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

function HabitReminderList({ embedded }: { embedded: boolean }) {
  const app = useApp();
  const { colors } = useTheme();
  const habits = app.data.habits.filter(({ status }) => status !== "archived");
  return (
    <Screen
      variant="nested"
      edgeToEdgeTop={embedded}
      title={embedded ? undefined : "Habit reminders"}
      back={embedded ? undefined : app.back}
    >
      <View style={styles.page}>
        {habits.length ? (
          <View
            style={[
              styles.reminderLead,
              { backgroundColor: colors.lavenderSurface },
            ]}
          >
            <BotanicalBackdrop style={styles.coverLeaves} />
            <Icon
              name="notifications-outline"
              size={27}
              color={colors.lavenderText}
            />
            <AppText variant="title" accessibilityRole="header">
              Daily nudges
            </AppText>
            <AppText color={colors.muted}>
              Choose which habits you want a reminder for. Delivery uses your
              device notification settings.
            </AppText>
          </View>
        ) : (
          <NestedState
            title="No habits to remind you about"
            icon="notifications-outline"
            description="Create a habit, then set a quiet reminder for the days you want a nudge."
          >
            <Button
              title="View your habits"
              variant="secondary"
              onPress={() => app.navigate(routes.habits)}
            />
          </NestedState>
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
        {!!habits.length && (
          <Button
            title="View your habits"
            variant="secondary"
            onPress={() => app.navigate(routes.habits)}
          />
        )}
      </View>
    </Screen>
  );
}

export function HabitsScreen({ name }: { name: string }) {
  const { habitHub, routeKey } = useApp();
  if (name === routes.habits) return <HabitsHub />;
  const drillDown = (
    <HabitDrillDown key={routeKey} name={name} embedded={!!habitHub} />
  );
  return habitHub ? <HabitsHub drillDown={drillDown} /> : drillDown;
}

function HabitDrillDown({
  name,
  embedded,
}: {
  name: string;
  embedded: boolean;
}) {
  const app = useApp();
  const habit = app.data.habits.find(({ id }) => id === app.params.id);
  if (name === routes.habitCreate)
    return (
      <HabitsEditor suggestion={app.params.suggestion} embedded={embedded} />
    );
  if (name === routes.habitReminders && app.params.id == null)
    return <HabitReminderList embedded={embedded} />;
  if (habit) {
    if (name === routes.habitEdit)
      return (
        <HabitsEditor
          key={habit.id}
          habit={habit}
          embedded={embedded}
          suggestion={app.params.suggestion}
          suggestionRevision={app.params.suggestionRevision}
        />
      );
    if (name === routes.habitDetails)
      return <HabitDetails key={habit.id} habit={habit} embedded={embedded} />;
    if (name === routes.habitReminders)
      return (
        <HabitReminderEditor key={habit.id} habit={habit} embedded={embedded} />
      );
  }
  return (
    <Screen
      variant="nested"
      edgeToEdgeTop={embedded}
      title={embedded ? undefined : "Habit details"}
      back={embedded ? undefined : app.back}
    >
      <NestedState
        title="Habit unavailable"
        icon="leaf-outline"
        description="This habit may have been removed. Your current habits are still available."
      >
        <Button
          title="View your habits"
          onPress={() => app.navigate(routes.habits)}
        />
      </NestedState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.section },
  section: { gap: 10 },
  progressSheet: { gap: spacing.row, padding: spacing.card, borderRadius: 16 },
  heading: {
    gap: spacing.row,
    padding: spacing.card,
    borderRadius: 18,
    overflow: "hidden",
  },
  headingStatus: { gap: spacing.compact },
  habitTitle: { fontSize: 39, lineHeight: 45 },
  fill: { flex: 1, minWidth: 0 },
  coverLeaves: { width: 190, height: 190, top: -42, right: -28, opacity: 0.3 },
  schedule: {
    gap: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.row,
  },
  reminderLead: {
    gap: spacing.compact,
    padding: spacing.card,
    borderRadius: 16,
    overflow: "hidden",
  },
  pressed: { opacity: 0.72 },
});
