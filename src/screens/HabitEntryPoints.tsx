import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import {
  habitDay,
  habitInsights,
  habitRevisionOn,
  habitTarget,
  isHabitScheduled,
  type Habit,
  type HabitProgress,
} from "../../server/src/habit-contract";
import { gardenLabels } from "../habits-ui";
import type { JourneyPeriod } from "../journey-analytics";
import { spacing } from "../layout";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Card, Icon } from "../ui";

function TodayHabit({
  habit,
  day,
  log,
}: {
  habit: Habit;
  day: string;
  log?: HabitProgress;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const revision = habitRevisionOn(habit, day);
  if (!revision) return null;
  const { goal, schedule } = revision;
  const binary = goal.type === "completion";
  const complete = !!log?.complete;
  const unit = goal.type === "quantity" ? goal.unit : "min";
  const detail = complete
    ? "Completed"
    : binary
      ? habit.reminderTime && `Reminder at ${habit.reminderTime}`
      : `${log?.amount ?? 0} of ${goal.target} ${unit}`;
  const flexible = schedule.type === "weekly";
  const canQuickLog = binary || !complete;
  const add = async () => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await app.setHabitProgress(habit.id, {
        day,
        amount:
          binary && complete
            ? 0
            : Math.min(habitTarget(goal), (log?.amount ?? 0) + 1),
        expectedRevision: log?.revision ?? 0,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Progress couldn’t be saved. Try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const open = () => app.navigate(routes.habitDetails, { id: habit.id });
  return (
    <View style={[styles.habitRow, { borderColor: colors.heroBorder }]}>
      <View style={styles.previewRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${habit.name}`}
          accessibilityHint={complete ? "Completed" : undefined}
          onPress={open}
          style={({ pressed }) => [styles.habitInfo, pressed && styles.pressed]}
        >
          <AppText variant="label">{habit.name}</AppText>
          {(detail || flexible) && (
            <View style={styles.habitMeta}>
              {complete && (
                <Icon
                  name="checkmark-circle"
                  size={15}
                  color={colors.sageText}
                />
              )}
              <AppText
                variant="caption"
                color={complete ? colors.sageText : colors.heroMuted}
                style={styles.metaText}
              >
                {detail}
                {flexible ? (detail ? " · Flexible" : "Flexible schedule") : ""}
              </AppText>
            </View>
          )}
        </Pressable>
        {canQuickLog && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              complete
                ? `Undo ${habit.name}`
                : binary
                  ? `Complete ${habit.name}`
                  : `Add 1 ${unit} to ${habit.name}`
            }
            accessibilityState={{ disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => void add()}
            style={({ pressed }) => [styles.log, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.logLabel,
                !complete && { backgroundColor: colors.sageSurface },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.sageText} />
              ) : (
                <>
                  {binary && (
                    <Icon
                      name={complete ? "arrow-undo-outline" : "checkmark"}
                      size={15}
                      color={colors.sageText}
                    />
                  )}
                  <AppText
                    variant="label"
                    color={colors.sageText}
                    style={styles.actionText}
                  >
                    {complete ? "Undo" : binary ? "Done" : "+1"}
                  </AppText>
                </>
              )}
            </View>
          </Pressable>
        )}
      </View>
      {!!error && (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          color={colors.danger}
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

export function TodayHabits({
  surfaceStyle,
}: {
  surfaceStyle?: StyleProp<ViewStyle>;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const eligible = app.data.habits.flatMap((habit) => {
    if (habit.status !== "active") return [];
    const day = habitDay(habit.timeZone);
    return isHabitScheduled(habit, day) ? [{ habit, day }] : [];
  });
  const currentDays = new Map(
    eligible.map(({ habit, day }) => [habit.id, day]),
  );
  const logs = new Map(
    app.data.habitProgress
      .filter((log) => currentDays.get(log.habitId) === log.day)
      .map((log) => [log.habitId, log]),
  );
  const fixed = eligible.filter(
    ({ habit, day }) => habitRevisionOn(habit, day)?.schedule.type !== "weekly",
  );
  const done = fixed.filter(({ habit }) => logs.get(habit.id)?.complete).length;
  const flexible = eligible.length - fixed.length;
  const flexibleDone = eligible.filter(
    ({ habit, day }) =>
      habitRevisionOn(habit, day)?.schedule.type === "weekly" &&
      logs.get(habit.id)?.complete,
  ).length;
  const preview = eligible.slice(0, 3);
  const hasHabits = app.data.habits.length > 0;
  const summary = !hasHabits
    ? "Start with one small habit."
    : !eligible.length
      ? "Nothing is scheduled today. Enjoy the breathing room."
      : [
          fixed.length
            ? `${done} of ${fixed.length} scheduled completed`
            : null,
          flexible
            ? `${flexibleDone} flexible ${flexibleDone === 1 ? "action" : "actions"} today`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
  const headerAction = !hasHabits
    ? "Create a habit"
    : preview.length > 1
      ? "View all"
      : null;
  return (
    <Card style={[styles.preview, surfaceStyle]}>
      <View style={styles.previewContent}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasHabits ? "View all habits" : "Create a habit"}
          accessibilityHint={`Today’s Habits. ${summary}`}
          onPress={() => app.navigate(routes.habits)}
          style={({ pressed }) => [
            styles.previewHeader,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.previewIcon,
              { backgroundColor: colors.lavenderSurface },
            ]}
          >
            <Icon name="leaf-outline" color={colors.lavenderText} size={20} />
          </View>
          <View style={styles.grow}>
            <AppText variant="heading" style={styles.previewTitle}>
              Today’s Habits
            </AppText>
            <AppText
              variant="caption"
              color={colors.heroMuted}
              style={styles.metaText}
            >
              {summary}
            </AppText>
          </View>
          <View style={styles.headerAction}>
            {headerAction && (
              <AppText
                variant="label"
                color={colors.lavenderText}
                style={styles.actionText}
              >
                {headerAction}
              </AppText>
            )}
            <Icon
              name="chevron-forward"
              size={17}
              color={colors.lavenderText}
            />
          </View>
        </Pressable>
        {preview.map(({ habit, day }) => (
          <TodayHabit
            key={habit.id}
            habit={habit}
            day={day}
            log={logs.get(habit.id)}
          />
        ))}
      </View>
    </Card>
  );
}

const habitPeriodCopy: Record<JourneyPeriod, string> = {
  week: "Your week at a glance.",
  month: "Your month at a glance.",
  all: "Your habits over time.",
};
const gardenFoliage = require("../../assets/botanical-compact.png");
const gardenBloom = require("../../assets/redesign-lotus.png");

export function HabitJourneyEntry({
  now,
  period,
  startDay,
  endDay,
  today,
  style,
  mutedColor,
}: {
  now: Date;
  period: JourneyPeriod;
  startDay: string | null;
  endDay: string;
  today: string;
  style: StyleProp<ViewStyle>;
  mutedColor: string;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const { habits, habitProgress, habitGarden } = app.data;
  const { completedActions, percentage, scheduled } = useMemo(() => {
    const start =
      startDay ??
      habits.reduce((earliest, habit) => {
        const first = habit.revisions[0]?.day;
        return first && first < earliest ? first : earliest;
      }, endDay);
    return habitInsights(habits, habitProgress, start, endDay, today, now);
  }, [habits, habitProgress, startDay, endDay, today, now]);
  const stage = habitGarden[0]?.stage;
  const gardenStatus = `Garden · ${stage ? gardenLabels[stage] : "Ready to grow"}`;
  const subtitle = habitPeriodCopy[period];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        "Habit Progress.",
        subtitle,
        `${completedActions} completed habit ${completedActions === 1 ? "action" : "actions"}.`,
        scheduled
          ? `${percentage}% of scheduled goals met.`
          : "No scheduled goals.",
        gardenStatus,
      ].join(" ")}
      accessibilityHint="Opens Habit Insights"
      onPress={() => app.navigate(routes.habitInsights)}
      style={({ pressed }) => [
        style,
        styles.journeyCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.journeyHeader}>
        <View
          style={[styles.journeyIcon, { backgroundColor: colors.sageSurface }]}
        >
          <Icon name="leaf-outline" size={18} color={colors.sageText} />
        </View>
        <View style={styles.grow}>
          <AppText variant="heading" style={styles.journeyTitle}>
            Habit Progress
          </AppText>
          <AppText
            variant="caption"
            color={mutedColor}
            style={styles.journeyCaption}
          >
            {subtitle}
          </AppText>
        </View>
        <View style={styles.journeyChevron}>
          <Icon name="chevron-forward" size={17} />
        </View>
      </View>
      <View style={styles.journeyMetrics}>
        <View style={styles.grow}>
          <AppText variant="label" style={styles.journeyValue}>
            {completedActions}
          </AppText>
          <AppText
            variant="caption"
            color={mutedColor}
            style={styles.journeyCaption}
          >
            Actions completed
          </AppText>
        </View>
        <View
          style={[
            styles.journeyMetricDivider,
            { backgroundColor: colors.border },
          ]}
        />
        <View style={styles.grow}>
          <AppText variant="label" style={styles.journeyValue}>
            {scheduled ? `${percentage}%` : "—"}
          </AppText>
          <AppText
            variant="caption"
            color={mutedColor}
            style={styles.journeyCaption}
          >
            {scheduled ? "Scheduled goals met" : "No scheduled goals"}
          </AppText>
        </View>
      </View>
      <View style={[styles.journeyGarden, { borderTopColor: colors.border }]}>
        {stage && stage !== "seed" ? (
          <Image
            source={
              stage === "blooming" || stage === "flourishing"
                ? gardenBloom
                : gardenFoliage
            }
            accessible={false}
            resizeMode="contain"
            resizeMethod="resize"
            fadeDuration={0}
            style={styles.journeyGardenArt}
          />
        ) : (
          <Icon name="ellipse-outline" size={16} color={colors.sageText} />
        )}
        <AppText
          variant="caption"
          color={mutedColor}
          style={[styles.grow, styles.journeyCaption]}
        >
          {gardenStatus}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  journeyCard: {
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.row,
    gap: spacing.compact,
  },
  journeyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  journeyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyChevron: { alignSelf: "flex-start", marginTop: 3 },
  journeyTitle: { fontSize: 20, lineHeight: 24 },
  journeyCaption: { fontSize: 12, lineHeight: 17 },
  journeyMetrics: { flexDirection: "row", gap: spacing.row },
  journeyMetricDivider: { width: StyleSheet.hairlineWidth },
  journeyValue: { fontSize: 21, lineHeight: 27, fontVariant: ["tabular-nums"] },
  journeyGarden: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    paddingTop: spacing.compact,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  journeyGardenArt: { width: 24, height: 20 },
  preview: {
    marginTop: spacing.section,
    borderRadius: 18,
    borderWidth: 1,
    padding: 0,
  },
  previewContent: {
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.compact,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    minHeight: 48,
    paddingVertical: 3,
  },
  previewIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitle: { fontSize: 19, lineHeight: 23 },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: "40%",
  },
  actionText: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
  metaText: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  habitRow: { borderTopWidth: StyleSheet.hairlineWidth },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
  },
  habitInfo: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 3,
  },
  habitMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  log: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "45%",
  },
  logLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: spacing.compact,
    paddingVertical: 5,
    minWidth: 62,
    minHeight: 28,
  },
});
