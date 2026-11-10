import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  habitGardenStages,
  habitRevisionOn,
  habitTarget,
  habitWeekStart,
  isHabitScheduled,
} from "../../server/src/habit-contract";
import {
  displayHabitDay,
  GardenScene,
  gardenLabels,
  goalLabel,
  HabitChoice,
  HabitIconBadge,
  HabitLink,
  HabitMeter,
  habitToday,
  occurrenceLabel,
  scheduleLabel,
  starterHabits,
  useHabitClock,
} from "../habits-ui";
import { spacing } from "../layout";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon } from "../ui";
import {
  HabitLogAction,
  useHabitLog,
  useHabitOccurrences,
} from "./HabitsSectionPieces";

type Occurrence = ReturnType<typeof useHabitOccurrences>["all"][number];
const rowLimit = 8;
const gardenMilestones = habitGardenStages.filter(({ minimum }) => minimum > 0);

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.titleGroup}>
      <Icon name={icon} color={colors.sageText} size={21} />
      <AppText accessibilityRole="header" variant="heading" style={styles.wrap}>
        {title}
      </AppText>
    </View>
  );
}

function TodayHabitRow({ occurrence }: { occurrence: Occurrence }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { habit, day, log, logs } = occurrence;
  const { write, pending, error } = useHabitLog(occurrence);
  const revision = habitRevisionOn(habit, day);
  const goal = revision?.goal ?? habit.goal;
  const details =
    revision?.schedule.type === "weekly"
      ? scheduleLabel(revision.schedule)
      : revision?.schedule.type === "daily"
        ? "Daily"
        : scheduleLabel(revision?.schedule ?? habit.schedule);
  const weekStart = habitWeekStart(day);
  const weekCompletions =
    revision?.schedule.type === "weekly"
      ? logs.filter(
          (item) =>
            item.complete &&
            item.day >= weekStart &&
            item.day <= day &&
            habitRevisionOn(habit, item.day)?.schedule.type === "weekly" &&
            isHabitScheduled(habit, item.day),
        ).length
      : undefined;
  const progress = occurrenceLabel(habit, day, log);
  const open = () => app.navigate(routes.habitDetails, { id: habit.id });
  return (
    <Card
      style={[
        styles.habitRow,
        {
          backgroundColor:
            resolved === "dark" ? colors.surface : colors.lavenderSurface,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${habit.name}`}
          accessibilityHint={progress}
          onPress={open}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <HabitIconBadge icon={habit.icon} color={habit.color} size={42} />
          <View style={styles.fill}>
            <AppText variant="label">{habit.name}</AppText>
            <AppText variant="caption" color={colors.muted}>
              {details} · {goalLabel(goal)}
            </AppText>
          </View>
        </Pressable>
        {habit.status === "active" ? (
          <HabitLogAction
            occurrence={occurrence}
            disabled={pending}
            onLog={write}
          />
        ) : (
          <AppText variant="caption" color={colors.muted} style={styles.wrap}>
            {habit.status === "paused" ? "Paused" : "Archived"}
          </AppText>
        )}
      </View>
      {goal.type !== "completion" && (
        <View style={styles.smallGap}>
          <HabitMeter
            value={log?.amount ?? 0}
            total={log?.target ?? habitTarget(goal)}
            label={`Today's progress for ${habit.name}`}
          />
          <AppText variant="caption" color={colors.muted}>
            {progress}
          </AppText>
        </View>
      )}
      {weekCompletions !== undefined &&
        revision?.schedule.type === "weekly" && (
          <AppText variant="caption" color={colors.muted}>
            {weekCompletions > revision.schedule.daysPerWeek
              ? `${weekCompletions} days completed this week · goal met`
              : `${weekCompletions} of ${revision.schedule.daysPerWeek} days this week`}
          </AppText>
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

export function HabitsTodaySection({
  onOpenGarden,
  onOpenInsights,
}: {
  onOpenGarden: () => void;
  onOpenInsights: () => void;
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { habits, habitProgress, habitGarden } = app.data;
  const now = useHabitClock(habits);
  const today = habitToday(undefined, now);
  const { fixed, flexible, completed } = useHabitOccurrences(
    habits,
    habitProgress,
    now,
  );
  const scheduled = useMemo(
    () =>
      [...fixed].sort(
        (a, b) =>
          Number(!!a.log?.complete) - Number(!!b.log?.complete) ||
          (a.habit.reminderTime ?? "99:99").localeCompare(
            b.habit.reminderTime ?? "99:99",
          ),
      ),
    [fixed],
  );
  const [limit, setLimit] = useState(rowLimit);
  const [flexibleLimit, setFlexibleLimit] = useState(rowLimit);
  const stackCards = width < 330 || fontScale > 1.3;
  const garden = habitGarden[0];
  const stage = garden?.stage ?? "seed";
  const panel = resolved === "dark" ? colors.surface : colors.lavenderSurface;
  const milestones = gardenMilestones.filter(
    ({ minimum }) => (garden?.earnedTotal ?? 0) >= minimum,
  ).length;
  const scheduleCount = fixed.length;
  const remaining = scheduleCount - completed;
  const flexDone = flexible.filter(({ log }) => log?.complete).length;
  return (
    <View style={styles.section}>
      <View style={[styles.progress, { backgroundColor: colors.sageSurface }]}>
        <View style={styles.heading}>
          <SectionTitle title="Today's Progress" icon="leaf-outline" />
          <View style={styles.date}>
            <Icon name="calendar-outline" size={16} color={colors.muted} />
            <AppText variant="caption" color={colors.muted}>
              {displayHabitDay(today, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </AppText>
          </View>
        </View>
        {scheduleCount ? (
          <>
            <HabitMeter
              value={completed}
              total={scheduleCount}
              label="Today's scheduled habits"
            />
            <View style={styles.stats}>
              {[
                ["checkmark-circle", `${completed} completed`],
                ["ellipse-outline", `${remaining} remaining`],
                ["calendar-outline", `${scheduleCount} scheduled`],
              ].map(([icon, label]) => (
                <View style={styles.stat} key={icon}>
                  <Icon
                    name={icon}
                    color={
                      icon === "checkmark-circle"
                        ? colors.sageText
                        : colors.muted
                    }
                    size={18}
                  />
                  <AppText variant="label" style={styles.wrap}>
                    {label}
                  </AppText>
                </View>
              ))}
            </View>
          </>
        ) : (
          <AppText color={colors.muted}>Nothing scheduled today.</AppText>
        )}
        {!!flexible.length && (
          <AppText variant="caption" color={colors.muted}>
            {flexDone} of {flexible.length} flexible habits completed today
          </AppText>
        )}
      </View>

      <View style={styles.list}>
        <View style={[styles.scheduleHeading, { borderColor: colors.border }]}>
          <SectionTitle title="Today’s habits" icon="leaf-outline" />
        </View>
        {!habits.length ? (
          <Card style={styles.smallGap}>
            <AppText variant="label">Begin with one small habit</AppText>
            <AppText variant="caption" color={colors.muted}>
              Choose a starter and make it your own.
            </AppText>
            <View style={styles.choices}>
              {[starterHabits[0], starterHabits[1], starterHabits[4]].map(
                (suggestion) => (
                  <HabitChoice
                    key={suggestion.name}
                    label={suggestion.name}
                    selected={false}
                    onPress={() =>
                      app.navigate(routes.habitCreate, { suggestion })
                    }
                  />
                ),
              )}
            </View>
          </Card>
        ) : (
          <>
            {!scheduleCount && (
              <AppText color={colors.muted}>
                {flexible.length
                  ? "No fixed habits today. Your flexible habits are below."
                  : "No habits are due today."}
              </AppText>
            )}
            {!!scheduleCount && !remaining && (
              <AppText variant="caption" color={colors.sageText}>
                All your scheduled habits are complete for today.
              </AppText>
            )}
            {scheduled.slice(0, limit).map((occurrence) => (
              <TodayHabitRow
                key={`${occurrence.habit.id}:${occurrence.day}`}
                occurrence={occurrence}
              />
            ))}
            {fixed.length > limit && (
              <Button
                title="Show more scheduled habits"
                variant="ghost"
                onPress={() => setLimit(limit + rowLimit)}
              />
            )}
            {!!flexible.length && (
              <View style={styles.list}>
                <AppText variant="label" accessibilityRole="header">
                  Flexible this week
                </AppText>
                {flexible.slice(0, flexibleLimit).map((occurrence) => (
                  <TodayHabitRow
                    key={`${occurrence.habit.id}:${occurrence.day}`}
                    occurrence={occurrence}
                  />
                ))}
                {flexible.length > flexibleLimit && (
                  <Button
                    title="Show more flexible habits"
                    variant="ghost"
                    onPress={() => setFlexibleLimit(flexibleLimit + rowLimit)}
                  />
                )}
              </View>
            )}
          </>
        )}
      </View>

      <Card
        style={[
          styles.garden,
          stackCards && styles.stack,
          { backgroundColor: panel },
        ]}
      >
        <View style={!stackCards && styles.gardenArt}>
          <GardenScene compact stage={stage} />
        </View>
        <View style={[styles.gardenCopy, !stackCards && styles.fill]}>
          <SectionTitle title="Your Growing Garden" icon="leaf-outline" />
          <AppText variant="caption" color={colors.muted}>
            {gardenLabels[stage]} · {milestones} of {gardenMilestones.length}{" "}
            milestones
          </AppText>
          <View style={styles.segments} aria-hidden>
            {gardenMilestones.map((item, index) => (
              <View
                key={item.stage}
                style={[
                  styles.milestone,
                  {
                    backgroundColor:
                      index < milestones ? colors.lavenderText : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Button
            title="Open Garden"
            icon="chevron-forward"
            variant="secondary"
            onPress={onOpenGarden}
            style={styles.gardenButton}
          />
        </View>
      </Card>

      <HabitLink
        title="Habit history & insights"
        detail="Review your weekly and monthly progress."
        icon="bar-chart-outline"
        onPress={onOpenInsights}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.section },
  list: { gap: spacing.compact },
  smallGap: { gap: spacing.compact },
  fill: { flex: 1, minWidth: 0 },
  wrap: { flexShrink: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.compact },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.compact,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    flexShrink: 1,
  },
  progress: { borderRadius: 16, padding: spacing.card, gap: spacing.row },
  date: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  stack: { flexDirection: "column", alignItems: "stretch" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.row },
  stat: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  scheduleHeading: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.compact,
  },
  habitRow: {
    borderRadius: 19,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    gap: 6,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.row,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  garden: {
    flexDirection: "row",
    borderRadius: 22,
    padding: spacing.compact,
    gap: spacing.row,
  },
  gardenArt: { width: "40%", justifyContent: "center" },
  gardenCopy: { padding: 4, gap: spacing.compact, justifyContent: "center" },
  gardenButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.row,
  },
  segments: { flexDirection: "row", gap: 4 },
  milestone: { flex: 1, height: 7, borderRadius: 6 },
  pressed: { opacity: 0.74 },
});
