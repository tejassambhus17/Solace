import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  addHabitDays,
  habitGardenStages,
  habitInsights,
  habitWeekStart,
  type Habit,
} from "../../server/src/habit-contract";
import {
  displayHabitDay,
  gardenLabels,
  GardenScene,
  HabitChoice,
  HabitLink,
  HabitMeter,
  habitToday,
  habitWeekdays,
  occurrenceLabel,
  useHabitClock,
} from "../habits-ui";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon, Screen } from "../ui";

const daysInWeek = 7;
type Period = "week" | "month";

function rangeFor(today: string, period: Period, offset: number) {
  if (period === "week") {
    const start = addHabitDays(habitWeekStart(today), offset * daysInWeek);
    return { start, end: addHabitDays(start, 6) };
  }
  const first = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + offset);
  const start = first.toISOString().slice(0, 10);
  first.setUTCMonth(first.getUTCMonth() + 1);
  return { start, end: addHabitDays(first.toISOString().slice(0, 10), -1) };
}

function PeriodCalendar({
  start,
  end,
  today,
  selected,
  onSelect,
  days,
}: {
  start: string;
  end: string;
  today: string;
  selected: string | null;
  onSelect: (day: string) => void;
  days: ReturnType<typeof habitInsights>["days"];
}) {
  const { colors } = useTheme();
  const first = habitWeekStart(start);
  const calendarEnd = addHabitDays(habitWeekStart(end), 6);
  const byDay = new Map(days.map((item) => [item.day, item]));
  const weeks: string[][] = [];
  for (
    let week = first;
    week <= calendarEnd;
    week = addHabitDays(week, daysInWeek)
  ) {
    weeks.push(
      Array.from({ length: daysInWeek }, (_, offset) =>
        addHabitDays(week, offset),
      ),
    );
  }
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarRow} aria-hidden>
        {habitWeekdays.map(({ label }) => (
          <AppText
            key={label}
            variant="caption"
            color={colors.muted}
            style={styles.calendarHeading}
          >
            {label.slice(0, 1)}
          </AppText>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.calendarRow}>
          {week.map((day) => {
            if (day < start || day > end)
              return <View key={day} style={styles.calendarGap} aria-hidden />;
            const actions = byDay.get(day)?.completed ?? 0;
            const chosen = selected === day;
            const future = day > today;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${displayHabitDay(day, { weekday: "long", day: "numeric", month: "long" })}${actions ? `, ${actions} completed ${actions === 1 ? "habit" : "habits"}` : ""}`}
                accessibilityState={{ selected: chosen, disabled: future }}
                aria-pressed={chosen}
                disabled={future}
                onPress={() => onSelect(day)}
                style={({ pressed }) => [
                  styles.calendarDay,
                  {
                    borderColor:
                      chosen || day === today ? colors.primary : colors.border,
                    backgroundColor: actions
                      ? colors.sageSurface
                      : colors.surface,
                    opacity: future || pressed ? 0.55 : 1,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={actions ? colors.sageText : colors.text}
                >
                  {Number(day.slice(-2))}
                </AppText>
                {actions > 0 && (
                  <View
                    style={[
                      styles.calendarMark,
                      { backgroundColor: colors.sageText },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function HabitInsightsScreen({ habit }: { habit?: Habit }) {
  const app = useApp();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const habits = useMemo(
    () => (habit ? [habit] : app.data.habits),
    [habit, app.data.habits],
  );
  const now = useHabitClock(habits);
  const today = habitToday(habit, now);
  const { start, end } = rangeFor(today, period, offset);
  const summary = useMemo(
    () => habitInsights(habits, app.data.habitProgress, start, end, today, now),
    [habits, app.data.habitProgress, start, end, today, now],
  );
  const names = useMemo(
    () => new Map(habits.map((item) => [item.id, item])),
    [habits],
  );
  const earliest = habits.reduce(
    (day, item) =>
      item.revisions[0]?.day && item.revisions[0].day < day
        ? item.revisions[0].day
        : day,
    today,
  );
  const fixed = habits.some((item) =>
    item.revisions.some(
      (revision) =>
        revision.status === "active" && revision.schedule.type !== "weekly",
    ),
  );
  const selectedEntries = selected
    ? app.data.habitProgress.filter(
        (item) => item.day === selected && names.has(item.habitId),
      )
    : [];
  const window =
    period === "month"
      ? displayHabitDay(start, { month: "long", year: "numeric" })
      : `${displayHabitDay(start, { month: "short", day: "numeric" })} – ${displayHabitDay(end, { month: "short", day: "numeric" })}`;

  function move(next: number) {
    setOffset(next);
    setSelected(null);
  }

  return (
    <Screen title="Habit history & insights" back={app.back}>
      <View style={styles.page}>
        <View style={styles.section}>
          <AppText variant="title" accessibilityRole="header">
            {habit?.name ?? "Habit progress"}
          </AppText>
          <AppText color={colors.muted}>
            Notice the small actions you made time for.
          </AppText>
        </View>
        <View style={styles.filters}>
          {(["week", "month"] as const).map((item) => (
            <HabitChoice
              key={item}
              label={item === "week" ? "Week" : "Month"}
              selected={period === item}
              onPress={() => {
                setPeriod(item);
                move(0);
              }}
            />
          ))}
        </View>
        <Card style={styles.section}>
          <View style={styles.periodRow}>
            <PeriodArrow
              label={`Previous ${period}`}
              icon="chevron-back"
              disabled={start <= earliest}
              onPress={() => move(offset - 1)}
            />
            <AppText
              variant="label"
              accessibilityLiveRegion="polite"
              style={styles.periodTitle}
            >
              {window}
            </AppText>
            <PeriodArrow
              label={`Next ${period}`}
              icon="chevron-forward"
              disabled={offset === 0}
              onPress={() => move(offset + 1)}
            />
          </View>
          <AppText variant="heading">
            {summary.completed} of {summary.scheduled} planned steps
          </AppText>
          {summary.scheduled > 0 ? (
            <>
              <HabitMeter
                value={summary.completed}
                total={summary.scheduled}
                label="Habit completion percentage"
              />
              <AppText variant="caption" color={colors.muted}>
                {summary.percentage}% of planned steps
              </AppText>
            </>
          ) : (
            <AppText color={colors.muted}>
              There are no scheduled occurrences in this period.
            </AppText>
          )}
          <AppText variant="caption" color={colors.muted}>
            {summary.completedActions} completed{" "}
            {summary.completedActions === 1 ? "action" : "actions"} recorded.
            Flexible goals count toward their weekly target.
          </AppText>
        </Card>
        <View style={styles.section}>
          <AppText variant="heading">
            {period === "week" ? "Weekly trend" : "Monthly calendar"}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            A dot marks a day with a completed habit. Choose a date to see what
            you recorded.
          </AppText>
          <PeriodCalendar
            start={start}
            end={end}
            today={today}
            days={summary.days}
            selected={selected}
            onSelect={setSelected}
          />
          {selected && (
            <Card style={styles.section}>
              <AppText variant="label">
                {displayHabitDay(selected, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </AppText>
              {!selectedEntries.length && (
                <AppText variant="caption" color={colors.muted}>
                  No actions recorded for this day.
                </AppText>
              )}
              {selectedEntries.map((entry) => {
                const source = names.get(entry.habitId);
                if (!source) return null;
                return (
                  <HabitLink
                    key={entry.id}
                    title={source.name}
                    detail={occurrenceLabel(source, selected, entry)}
                    icon={
                      entry.complete
                        ? "checkmark-circle-outline"
                        : "time-outline"
                    }
                    onPress={() =>
                      app.navigate(routes.habitDetails, {
                        id: source.id,
                        day: selected,
                      })
                    }
                  />
                );
              })}
            </Card>
          )}
        </View>
        <View style={styles.section}>
          <AppText variant="heading">Consistency</AppText>
          {fixed ? (
            <Card style={styles.section}>
              <View style={styles.streaks}>
                <View style={styles.metric}>
                  <AppText variant="title">{summary.currentStreak}</AppText>
                  <AppText variant="caption" color={colors.muted}>
                    Current streak
                  </AppText>
                </View>
                <View style={styles.metric}>
                  <AppText variant="title">{summary.bestStreak}</AppText>
                  <AppText variant="caption" color={colors.muted}>
                    Best historical streak
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" color={colors.muted}>
                Streaks follow the fixed days you chose. Flexible goals are
                measured by week.
              </AppText>
            </Card>
          ) : (
            <AppText color={colors.muted}>
              Flexible habits use weekly targets and leave the choice of day
              with you.
            </AppText>
          )}
        </View>
        {!habit && (
          <View style={styles.section}>
            <AppText variant="heading">Individual habits</AppText>
            {!summary.habits.length && (
              <AppText color={colors.muted}>
                Your saved habits will appear here.
              </AppText>
            )}
            {summary.habits.slice(0, limit).map((item) => {
              const source = names.get(item.habitId);
              if (!source) return null;
              return (
                <HabitLink
                  key={item.habitId}
                  title={source.name}
                  detail={
                    item.scheduled
                      ? `${item.completed} of ${item.scheduled} · ${item.percentage}%`
                      : "No scheduled occurrences in this period"
                  }
                  icon="leaf-outline"
                  onPress={() =>
                    app.navigate(routes.habitInsights, { id: item.habitId })
                  }
                />
              );
            })}
            {summary.habits.length > limit && (
              <Button
                title="Show more habits"
                variant="ghost"
                onPress={() => setLimit((old) => old + 10)}
              />
            )}
          </View>
        )}
        <HabitLink
          title="Open your garden"
          detail="See the milestones your habits have grown."
          icon="flower-outline"
          onPress={() => app.navigate(routes.habitGarden)}
        />
        <HabitLink
          title="Reflect on your habits with Solace"
          detail="Choose whether to share a summary of your progress."
          icon="sparkles-outline"
          onPress={() =>
            app.navigate(routes.companion, {
              habitAssistant: "reflect",
              ...(habit ? { habitAssistantId: habit.id } : {}),
            })
          }
        />
      </View>
    </Screen>
  );
}

function PeriodArrow({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.periodArrow,
        { opacity: disabled || pressed ? 0.45 : 1 },
      ]}
    >
      <Icon name={icon} color={colors.text} size={20} />
    </Pressable>
  );
}

export function HabitGardenScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const garden = app.data.habitGarden[0];
  const stage = garden?.stage ?? "seed";
  const earned = garden?.earnedTotal ?? 0;
  const next = habitGardenStages.find(({ minimum }) => minimum > earned);
  return (
    <Screen title="Your Growing Garden" back={app.back}>
      <View style={styles.page}>
        <View style={styles.section}>
          <AppText variant="title" accessibilityRole="header">
            Small steps take root
          </AppText>
          <AppText color={colors.muted}>
            Each completed habit day adds to this garden. Growth stays with you
            through pauses and missed days.
          </AppText>
        </View>
        <GardenScene stage={stage} />
        <Card style={styles.section}>
          <AppText variant="heading">{gardenLabels[stage]}</AppText>
          <AppText>
            {earned}{" "}
            {earned === 1 ? "completed habit day" : "completed habit days"}{" "}
            earned
          </AppText>
          {next && (
            <>
              <HabitMeter
                value={earned}
                total={next.minimum}
                label={`Progress toward ${gardenLabels[next.stage]}`}
              />
              <AppText variant="caption" color={colors.muted}>
                {next.minimum - earned} more{" "}
                {next.minimum - earned === 1 ? "completion" : "completions"} to{" "}
                {gardenLabels[next.stage].toLowerCase()}.
              </AppText>
            </>
          )}
          {!next && (
            <AppText variant="caption" color={colors.muted}>
              Your garden has reached its final stage. Every next step still
              counts.
            </AppText>
          )}
        </Card>
        <View style={styles.section}>
          <AppText variant="heading">Garden milestones</AppText>
          {habitGardenStages.map((item) => (
            <View
              key={item.stage}
              style={[styles.milestone, { borderColor: colors.border }]}
            >
              <Icon
                name={
                  earned >= item.minimum
                    ? "checkmark-circle-outline"
                    : "leaf-outline"
                }
                color={earned >= item.minimum ? colors.sageText : colors.muted}
              />
              <View style={styles.metric}>
                <AppText variant="label">{gardenLabels[item.stage]}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {item.minimum === 0
                    ? "Starting stage"
                    : `${item.minimum} completed ${item.minimum === 1 ? "day" : "days"}`}
                </AppText>
              </View>
              {earned >= item.minimum && (
                <AppText variant="caption" color={colors.sageText}>
                  {item.minimum === 0 ? "Starting" : "Earned"}
                </AppText>
              )}
            </View>
          ))}
        </View>
        <Button
          title="View your habits"
          variant="secondary"
          onPress={() => app.navigate(routes.habits)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  section: { gap: 10 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  periodTitle: { flex: 1, textAlign: "center" },
  periodArrow: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  calendar: { gap: 5 },
  calendarRow: { flexDirection: "row", gap: 4, alignItems: "stretch" },
  calendarHeading: { flex: 1, textAlign: "center", minWidth: 0 },
  calendarDay: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingVertical: 6,
    gap: 3,
  },
  calendarGap: { flex: 1, minWidth: 0 },
  calendarMark: { width: 4, height: 4, borderRadius: 2 },
  streaks: { flexDirection: "row", gap: 15 },
  metric: { flex: 1, gap: 4 },
  milestone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 53,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
