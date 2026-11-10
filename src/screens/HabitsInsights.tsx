import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  addHabitDays,
  habitInsights,
  habitWeekStart,
  type Habit,
} from "../../server/src/habit-contract";
import {
  displayHabitDay,
  GardenScene,
  HabitLink,
  HabitMeter,
  habitToday,
  occurrenceLabel,
  useHabitClock,
} from "../habits-ui";
import { spacing, useScreenGutter } from "../layout";
import { webRadioProps } from "../radio-keyboard";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, BotanicalBackdrop, Button, Card, Icon, Row } from "../ui";

type Period = "week" | "month";
type Range = { startDay: string; endDay: string };
type Summary = ReturnType<typeof habitInsights>;
const noHabits: Habit[] = [];
const dayMs = 86_400_000;
const shortDate = { month: "short", day: "numeric" } as const;
const longDate = { weekday: "long", month: "long", day: "numeric" } as const;

function daysBetween(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / dayMs;
}

function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(day);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === day
  );
}

function validRange(range?: Range) {
  if (!range || !validDay(range.startDay) || !validDay(range.endDay)) return;
  const distance = daysBetween(range.startDay, range.endDay);
  if (distance >= 0 && distance < 62) return range;
}

function rangeFor(today: string, period: Period, offset = 0): Range {
  if (period === "week") {
    const startDay = addHabitDays(habitWeekStart(today), offset * 7);
    return { startDay, endDay: addHabitDays(startDay, 6) };
  }
  const first = new Date(today.slice(0, 7) + "-01T12:00:00Z");
  first.setUTCMonth(first.getUTCMonth() + offset);
  const startDay = first.toISOString().slice(0, 10);
  first.setUTCMonth(first.getUTCMonth() + 1);
  return {
    startDay,
    endDay: addHabitDays(first.toISOString().slice(0, 10), -1),
  };
}

function selectedRange(
  today: string,
  period: Period,
  offset: number,
  custom?: Range,
): Range {
  if (!custom) return rangeFor(today, period, offset);
  if (offset === 0) return custom;
  const aligned = rangeFor(custom.startDay, period);
  if (aligned.startDay === custom.startDay && custom.endDay <= aligned.endDay) {
    return rangeFor(custom.startDay, period, offset);
  }
  const shift = (daysBetween(custom.startDay, custom.endDay) + 1) * offset;
  return {
    startDay: addHabitDays(custom.startDay, shift),
    endDay: addHabitDays(custom.endDay, shift),
  };
}

function rangeLabel({ startDay, endDay }: Range, today: string) {
  const year = today.slice(0, 4);
  const dateLabel = (day: string) =>
    displayHabitDay(
      day,
      day.startsWith(year) ? shortDate : { ...shortDate, year: "numeric" },
    );
  if (startDay === endDay) return dateLabel(startDay);
  return dateLabel(startDay) + " – " + dateLabel(endDay);
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
        styles.arrow,
        { opacity: disabled || pressed ? 0.45 : 1 },
      ]}
    >
      <Icon name={icon} color={colors.text} size={20} />
    </Pressable>
  );
}

function Metric({
  name,
  count,
  icon,
  tone,
}: {
  name: string;
  count: number;
  icon: string;
  tone?: "sage" | "lavender";
}) {
  const { colors } = useTheme();
  const color =
    tone === "sage"
      ? colors.sageText
      : tone === "lavender"
        ? colors.lavenderText
        : colors.text;
  return (
    <View style={styles.metric}>
      <Icon name={icon} color={color} size={21} />
      <AppText variant="label" style={styles.metricText}>
        {count} {name}
      </AppText>
    </View>
  );
}

function CompletionSummary({ summary }: { summary: Summary }) {
  const { colors } = useTheme();
  const missed = summary.days.reduce(
    (total, day) => total + day.closedMissed,
    0,
  );
  const remaining = summary.scheduled - summary.completed - missed;
  const hasSchedule = summary.scheduled > 0;
  return (
    <View style={[styles.summary, { backgroundColor: colors.lavenderSurface }]}>
      <BotanicalBackdrop style={styles.summaryLeaves} />
      <Row style={styles.summaryHeadline}>
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.copy}
        >
          Goal completion
        </AppText>
        {hasSchedule && (
          <AppText
            variant="title"
            color={colors.lavenderText}
            style={styles.percent}
          >
            {summary.percentage}%
          </AppText>
        )}
      </Row>
      {hasSchedule ? (
        <HabitMeter
          value={summary.completed}
          total={summary.scheduled}
          label="Scheduled goals completed"
        />
      ) : (
        <AppText color={colors.muted}>
          No goals scheduled in this period.
        </AppText>
      )}
      <View style={styles.metrics}>
        <Metric
          name="completed"
          count={summary.completed}
          icon="checkmark-circle"
          tone="sage"
        />
        {missed > 0 && (
          <Metric
            name="missed"
            count={missed}
            icon="ellipse-outline"
            tone="lavender"
          />
        )}
        {remaining > 0 && (
          <Metric
            name="remaining"
            count={remaining}
            icon="time-outline"
            tone="lavender"
          />
        )}
        <Metric
          name="scheduled"
          count={summary.scheduled}
          icon="calendar-outline"
        />
      </View>
      {summary.flexible.scheduled > 0 && (
        <AppText variant="caption" color={colors.muted}>
          Flexible goals count toward their weekly target.
        </AppText>
      )}
      {summary.completedActions > summary.completed && (
        <AppText variant="caption" color={colors.muted}>
          {summary.completedActions} actions recorded in total.
        </AppText>
      )}
    </View>
  );
}

function ProgressDates({
  period,
  range,
  summary,
  today,
  selected,
  onSelect,
  wrap,
}: {
  period: Period;
  range: Range;
  summary: Summary;
  today: string;
  selected?: string;
  onSelect: (day: string) => void;
  wrap: boolean;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const fillInk = dark ? colors.lavender : colors.accent;
  const monthly = period === "month";
  const compactMonth = monthly && wrap;
  const columns = compactMonth ? 4 : 7;
  const byDay = new Map(summary.days.map((day) => [day.day, day]));
  const alignedWeek = habitWeekStart(range.startDay);
  const singleWeek = !monthly && range.endDay <= addHabitDays(alignedWeek, 6);
  const start =
    (monthly && !compactMonth) || singleWeek ? alignedWeek : range.startDay;
  const end =
    monthly && !compactMonth
      ? addHabitDays(habitWeekStart(range.endDay), columns - 1)
      : singleWeek
        ? addHabitDays(alignedWeek, 6)
        : range.endDay;
  const count = daysBetween(start, end) + 1;
  const dateRows = Array.from(
    { length: Math.ceil(count / columns) },
    (_, row) =>
      Array.from(
        { length: Math.min(columns, count - row * columns) },
        (_, index) => addHabitDays(start, row * columns + index),
      ),
  );
  const peak = Math.max(1, ...summary.days.map((day) => day.completed));
  return (
    <View style={styles.dateGrid}>
      {monthly && !compactMonth && (
        <View aria-hidden style={styles.dateRow}>
          {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
            <AppText
              key={index}
              variant="caption"
              color={colors.muted}
              style={styles.weekday}
            >
              {label}
            </AppText>
          ))}
        </View>
      )}
      {dateRows.map((dates) => (
        <View key={dates[0]} style={[styles.dateRow, wrap && styles.wrapDates]}>
          {dates.map((day) => {
            if (day < range.startDay || day > range.endDay) {
              return (
                <View
                  key={day}
                  aria-hidden
                  style={[
                    styles.date,
                    styles.blankDate,
                    wrap && styles.wrappedDate,
                  ]}
                >
                  {!monthly && (
                    <AppText
                      variant="caption"
                      color={colors.muted}
                      style={styles.center}
                    >
                      {displayHabitDay(day, { weekday: "short" })}
                    </AppText>
                  )}
                </View>
              );
            }
            const item = byDay.get(day);
            const future = day > today;
            const isToday = day === today;
            const chosen = selected === day;
            const completed = item?.completed ?? 0;
            const percent = item?.scheduled
              ? Math.round((item.fixedCompleted / item.scheduled) * 100)
              : undefined;
            const flexible = completed - (item?.fixedCompleted ?? 0);
            const value = future
              ? "—"
              : percent !== undefined
                ? percent + "%"
                : completed
                  ? String(completed)
                  : "—";
            const fill = future
              ? 0
              : (percent ??
                (summary.fixed.scheduled
                  ? 0
                  : Math.round((completed / peak) * 100)));
            const description = future
              ? "Upcoming"
              : percent !== undefined
                ? percent +
                  "% of fixed goals completed" +
                  (flexible
                    ? `, plus ${flexible} flexible ${flexible === 1 ? "action" : "actions"}`
                    : "")
                : completed
                  ? `${completed} flexible ${completed === 1 ? "action" : "actions"} completed`
                  : "Not scheduled";
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={
                  displayHabitDay(day, longDate) +
                  (isToday ? ", today, " : ", ") +
                  description
                }
                accessibilityState={{ selected: chosen, disabled: future }}
                disabled={future}
                onPress={() => onSelect(day)}
                style={({ pressed }) => [
                  styles.date,
                  wrap && styles.wrappedDate,
                  {
                    borderColor: chosen
                      ? dark
                        ? colors.lavender
                        : colors.accent
                      : isToday
                        ? colors.sageText
                        : "transparent",
                    backgroundColor:
                      !dark && chosen
                        ? colors.lavenderSurface
                        : monthly
                          ? completed
                            ? colors.sageSurface
                            : colors.surface2
                          : chosen
                            ? colors.surface2
                            : "transparent",
                    opacity: future || pressed ? 0.58 : 1,
                  },
                ]}
              >
                {monthly ? (
                  <>
                    <AppText
                      variant="caption"
                      color={
                        !dark && chosen
                          ? colors.lavenderText
                          : completed || isToday
                            ? colors.sageText
                            : colors.text
                      }
                    >
                      {Number(day.slice(-2))}
                    </AppText>
                    {compactMonth && (
                      <AppText
                        variant="caption"
                        color={colors.muted}
                        style={styles.center}
                      >
                        {displayHabitDay(day, { weekday: "short" })}
                      </AppText>
                    )}
                    {completed > 0 && (
                      <View
                        aria-hidden
                        style={[
                          styles.dateMark,
                          { backgroundColor: colors.sageText },
                        ]}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <AppText
                      variant="caption"
                      color={colors.text}
                      style={styles.center}
                    >
                      {value}
                    </AppText>
                    <View
                      aria-hidden
                      style={[styles.bar, { backgroundColor: colors.surface2 }]}
                    >
                      {fill > 0 && (
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: fill + "%",
                              backgroundColor: fillInk,
                            },
                          ]}
                        />
                      )}
                    </View>
                    <AppText
                      variant="caption"
                      color={isToday ? colors.sageText : colors.muted}
                      style={styles.center}
                    >
                      {displayHabitDay(day, { weekday: "short" })}
                    </AppText>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function HabitsInsightsSection({
  active,
  requestedPeriod,
  requestedRange,
  viewRequest,
  habitId,
  onOpenHabit,
  onGoToday,
}: {
  active: boolean;
  requestedPeriod?: Period;
  requestedRange?: Range;
  viewRequest?: number;
  habitId?: string;
  onOpenHabit: (id: string, day?: string) => void;
  onGoToday: () => void;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const habit = app.data.habits.find((entry) => entry.id === habitId);
  const habits = useMemo(
    () => (habit ? [habit] : app.data.habits),
    [habit, app.data.habits],
  );
  const progress = app.data.habitProgress;
  const now = useHabitClock(active ? habits : noHabits);
  const today = habitToday(habit, now);
  const initialRange = validRange(requestedRange);
  const initialPeriod =
    requestedPeriod ??
    (initialRange && daysBetween(initialRange.startDay, initialRange.endDay) > 6
      ? "month"
      : "week");
  const scope =
    (initialRange?.startDay ?? "") +
    ":" +
    (initialRange?.endDay ?? "") +
    ":" +
    initialPeriod +
    ":" +
    (habitId ?? "") +
    ":" +
    (viewRequest ?? "");
  const [selection, setSelection] = useState<{
    scope: string;
    period: Period;
    offset: number;
    custom: boolean;
    day?: string;
  }>();
  const current =
    selection?.scope === scope
      ? selection
      : {
          scope,
          period: initialPeriod,
          offset: 0,
          custom: true,
          day: undefined,
        };
  const { period, offset } = current;
  const customRange = current.custom ? initialRange : undefined;
  const range = selectedRange(today, period, offset, customRange);
  const nextRange = selectedRange(today, period, offset + 1, customRange);
  const { startDay, endDay } = range;
  const earliest = habits.reduce(
    (day, item) =>
      item.revisions[0]?.day && item.revisions[0].day < day
        ? item.revisions[0].day
        : day,
    today,
  );
  const elapsed = Math.max(
    0,
    daysBetween(startDay, endDay < today ? endDay : today) + 1,
  );
  const previousRange = selectedRange(today, period, offset - 1, customRange);
  const previousElapsed = Math.min(
    elapsed,
    daysBetween(previousRange.startDay, previousRange.endDay) + 1,
  );
  const previousEnd = addHabitDays(
    previousRange.startDay,
    Math.max(0, previousElapsed - 1),
  );
  const monthRange = rangeFor(today, "month");
  const { summary, previous, monthly } = useMemo(() => {
    const calculate = (from: string, to: string) =>
      habitInsights(
        active ? habits : noHabits,
        active ? progress : [],
        from,
        to,
        today,
        now,
      );
    const summary = calculate(startDay, endDay);
    return {
      summary,
      previous:
        active && previousElapsed > 0 && earliest <= previousEnd
          ? calculate(previousRange.startDay, previousEnd)
          : undefined,
      monthly:
        monthRange.startDay === startDay && monthRange.endDay === endDay
          ? summary
          : calculate(monthRange.startDay, monthRange.endDay),
    };
  }, [
    active,
    habits,
    progress,
    today,
    now,
    startDay,
    endDay,
    earliest,
    previousElapsed,
    previousRange.startDay,
    previousEnd,
    monthRange.startDay,
    monthRange.endDay,
  ]);
  const daysPercent =
    elapsed > 0 ? Math.round((summary.daysWithCompletion / elapsed) * 100) : 0;
  const previousPercent =
    previousElapsed > 0 && previous
      ? Math.round((previous.daysWithCompletion / previousElapsed) * 100)
      : 0;
  const change =
    summary.scheduled > 0 && previous?.scheduled && elapsed === previousElapsed
      ? daysPercent - previousPercent
      : 0;
  const selected =
    current.day && current.day >= startDay && current.day <= endDay
      ? current.day
      : undefined;
  const [limit, setLimit] = useState(10);
  const byId = useMemo(
    () => new Map(habits.map((item) => [item.id, item])),
    [habits],
  );
  const selectedEntries = selected
    ? progress.filter((item) => item.day === selected && byId.has(item.habitId))
    : [];
  const stack = width < 350 || fontScale >= 1.45;
  const dateWrap =
    width - gutter * 2 - spacing.row * 2 - 2 < 7 * 44 + 6 || fontScale >= 1.35;
  const showEarly =
    monthly.daysWithCompletion < 2 && summary.daysWithCompletion < 2;

  function move(next: number) {
    setSelection({ ...current, offset: next, day: undefined });
  }

  if (habitId && !habit) {
    return (
      <Card style={styles.card}>
        <AppText variant="heading">Habit unavailable</AppText>
        <AppText color={colors.muted}>
          You can open your saved habits from Today.
        </AppText>
        <Button title="Back to Habits" onPress={onGoToday} />
      </Card>
    );
  }

  return (
    <View style={styles.page}>
      {habit && (
        <AppText variant="heading" accessibilityRole="header">
          {habit.name}
        </AppText>
      )}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Habit reporting period"
        style={[
          styles.segmented,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {(["week", "month"] as const).map((item) => {
          const chosen = period === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              {...webRadioProps(chosen)}
              accessibilityState={{ checked: chosen }}
              aria-checked={chosen}
              onPress={() => {
                if (!chosen)
                  setSelection({
                    scope,
                    period: item,
                    offset: 0,
                    custom: false,
                  });
              }}
              style={({ pressed }) => [
                styles.segment,
                {
                  backgroundColor: chosen
                    ? colors.lavenderSurface
                    : "transparent",
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Icon
                name={
                  item === "week" ? "calendar-outline" : "stats-chart-outline"
                }
                color={chosen ? colors.lavenderText : colors.muted}
                size={19}
              />
              <AppText
                variant="label"
                style={styles.segmentLabel}
                color={chosen ? colors.lavenderText : colors.text}
              >
                {item === "week" ? "Week" : "Month"}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View
        style={[
          styles.periodRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <PeriodArrow
          label={"Previous " + period}
          icon="chevron-back"
          disabled={startDay <= earliest}
          onPress={() => move(offset - 1)}
        />
        <AppText
          variant="label"
          accessibilityLiveRegion="polite"
          style={[styles.periodTitle, styles.center]}
        >
          {rangeLabel(range, today)}
        </AppText>
        <PeriodArrow
          label={"Next " + period}
          icon="chevron-forward"
          disabled={endDay >= today || nextRange.startDay > today}
          onPress={() => move(offset + 1)}
        />
      </View>
      <CompletionSummary summary={summary} />
      {summary.scheduled > 0 && (
        <Card
          style={[styles.card, styles.consistency, stack && styles.wrapped]}
        >
          <Icon name="flame-outline" color={colors.peach} size={24} />
          <View style={styles.copy}>
            <AppText variant="label">Consistency</AppText>
            <AppText variant="caption" color={colors.muted}>
              {summary.daysWithCompletion} of {elapsed} days with a completion
            </AppText>
            {change !== 0 && (
              <AppText
                variant="caption"
                color={change > 0 ? colors.sageText : colors.muted}
              >
                {(change > 0 ? "+" : "−") +
                  Math.abs(change) +
                  " percentage points from the previous " +
                  period}
              </AppText>
            )}
          </View>
          <View
            style={[styles.pill, { backgroundColor: colors.lavenderSurface }]}
          >
            <AppText variant="label" color={colors.lavenderText}>
              {daysPercent}%
            </AppText>
          </View>
        </Card>
      )}
      <Card style={styles.card}>
        <View style={styles.cardHeading}>
          <Icon
            name={period === "week" ? "trending-up" : "calendar-outline"}
            color={colors.lavenderText}
            size={22}
          />
          <View style={styles.copy}>
            <AppText variant="heading" accessibilityRole="header">
              {period === "week" ? "Weekly Trend" : "Monthly Calendar"}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {period === "month"
                ? "Highlighted days have recorded completions."
                : summary.fixed.scheduled > 0 && summary.flexible.scheduled > 0
                  ? "Bars show fixed goals. Plain counts show flexible actions."
                  : summary.fixed.scheduled > 0
                    ? "Habit completion across the week."
                    : "Completed actions across the week."}{" "}
              Choose a day for details.
            </AppText>
          </View>
        </View>
        <ProgressDates
          period={period}
          range={range}
          summary={summary}
          today={today}
          selected={selected}
          onSelect={(day) => setSelection({ ...current, day })}
          wrap={dateWrap}
        />
        {selected && (
          <View style={[styles.dateDetails, { borderTopColor: colors.border }]}>
            <AppText variant="label" accessibilityLiveRegion="polite">
              {displayHabitDay(selected, longDate)}
            </AppText>
            {selectedEntries.length === 0 && (
              <AppText variant="caption" color={colors.muted}>
                No actions recorded for this day.
              </AppText>
            )}
            {selectedEntries.map((entry) => {
              const source = byId.get(entry.habitId);
              if (!source) return null;
              return (
                <HabitLink
                  key={entry.id}
                  title={source.name}
                  detail={occurrenceLabel(source, selected, entry)}
                  icon={
                    entry.complete ? "checkmark-circle-outline" : "time-outline"
                  }
                  onPress={() => onOpenHabit(source.id, selected)}
                />
              );
            })}
          </View>
        )}
      </Card>
      {showEarly && (
        <Card style={[styles.card, styles.early, stack && styles.stacked]}>
          <View style={[styles.earlyArt, stack && styles.fullArt]}>
            <GardenScene
              compact
              stage={app.data.habitGarden[0]?.stage ?? "seed"}
            />
          </View>
          <View style={styles.copy}>
            <AppText variant="heading">No deeper insights yet</AppText>
            <AppText variant="caption" color={colors.muted}>
              Log habits on more days to see how your routine takes shape.
            </AppText>
            <Button
              title="Go to today’s habits"
              icon="sunny-outline"
              onPress={onGoToday}
            />
          </View>
        </Card>
      )}
      {summary.fixed.scheduled > 0 && (
        <Card style={styles.card}>
          <View style={styles.cardHeading}>
            <Icon name="flame-outline" color={colors.peach} size={21} />
            <AppText variant="heading" style={styles.metricText}>
              Fixed-day streaks
            </AppText>
          </View>
          <AppText variant="label">
            {summary.currentStreak} current · {summary.bestStreak} best
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            Streaks follow your fixed schedule across all recorded history.
          </AppText>
        </Card>
      )}
      {!habit && summary.habits.length > 0 && (
        <View style={styles.page}>
          <AppText variant="heading" accessibilityRole="header">
            Individual Habits
          </AppText>
          {summary.habits.slice(0, limit).map((item) => {
            const source = byId.get(item.habitId);
            if (!source) return null;
            return (
              <HabitLink
                key={item.habitId}
                title={source.name}
                detail={
                  item.scheduled
                    ? item.completed +
                      " of " +
                      item.scheduled +
                      " · " +
                      item.percentage +
                      "%"
                    : "No scheduled goals in this period"
                }
                icon="leaf-outline"
                onPress={() => onOpenHabit(source.id)}
              />
            );
          })}
          {summary.habits.length > limit && (
            <Button
              title="Show more habits"
              variant="ghost"
              onPress={() => setLimit((value) => value + 10)}
            />
          )}
        </View>
      )}
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
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.row },
  segmented: {
    flexDirection: "row",
    gap: 4,
    borderRadius: 24,
    borderWidth: 1,
    padding: 3,
  },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 4,
    borderRadius: 21,
  },
  segmentLabel: { textAlign: "center", flexShrink: 1 },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 23,
    borderWidth: 1,
  },
  arrow: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  periodTitle: { flex: 1, minWidth: 0, paddingVertical: 4 },
  center: { textAlign: "center" },
  card: {
    padding: spacing.row,
    gap: spacing.compact,
    borderRadius: 18,
    overflow: "hidden",
  },
  summary: {
    borderRadius: 16,
    padding: spacing.card,
    gap: spacing.row,
    overflow: "hidden",
  },
  summaryHeadline: { flexWrap: "wrap", gap: spacing.row },
  summaryLeaves: {
    top: -45,
    right: -35,
    width: 185,
    height: 185,
    opacity: 0.28,
  },
  percent: { fontSize: 32, lineHeight: 39, fontVariant: ["tabular-nums"] },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.row },
  metric: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  metricText: { flexShrink: 1, minWidth: 0 },
  consistency: { flexDirection: "row", alignItems: "center", gap: spacing.row },
  wrapped: { flexWrap: "wrap" },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  cardHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.compact,
  },
  dateGrid: { gap: spacing.compact },
  dateRow: { flexDirection: "row", gap: 1 },
  weekday: { flex: 1, minWidth: 44, textAlign: "center" },
  wrapDates: { flexWrap: "wrap", justifyContent: "center" },
  date: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  wrappedDate: { flexGrow: 0, flexBasis: "24%" },
  blankDate: { borderColor: "transparent", justifyContent: "flex-end" },
  bar: {
    width: "78%",
    height: 49,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", borderRadius: 8 },
  dateMark: { height: 4, width: 4, borderRadius: 2 },
  dateDetails: {
    borderTopWidth: 1,
    paddingTop: spacing.compact,
    gap: spacing.compact,
  },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  early: { flexDirection: "row", alignItems: "center", gap: spacing.row },
  earlyArt: { width: "34%", minWidth: 88 },
  fullArt: { width: "100%" },
});
