import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import {
  habitRevisionOn,
  habitTarget,
  isHabitScheduled,
  type Habit,
  type HabitProgress,
} from "../../server/src/habit-contract";
import { habitToday } from "../habits-ui";
import { spacing } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Icon } from "../ui";

type HabitOccurrence = {
  habit: Habit;
  day: string;
  log?: HabitProgress;
};
const emptyProgress: readonly HabitProgress[] = [];

export function useHabitOccurrences(
  habits: readonly Habit[],
  progress: readonly HabitProgress[],
  now: Date,
) {
  return useMemo(() => {
    const byDay = new Map<string, HabitProgress>();
    const byHabit = new Map<string, HabitProgress[]>();
    for (const item of progress) {
      byDay.set(`${item.habitId}:${item.day}`, item);
      const logs = byHabit.get(item.habitId);
      if (logs) logs.push(item);
      else byHabit.set(item.habitId, [item]);
    }
    const all = habits.map((habit) => {
      const day = habitToday(habit, now);
      return {
        habit,
        day,
        log: byDay.get(`${habit.id}:${day}`),
        logs: byHabit.get(habit.id) ?? emptyProgress,
      };
    });
    const scheduled = all.filter(
      ({ habit, day }) =>
        habit.status === "active" && isHabitScheduled(habit, day),
    );
    const fixed = scheduled.filter(
      ({ habit, day }) =>
        habitRevisionOn(habit, day)?.schedule.type !== "weekly",
    );
    const flexible = scheduled.filter(
      ({ habit, day }) =>
        habitRevisionOn(habit, day)?.schedule.type === "weekly",
    );
    return {
      all,
      fixed,
      flexible,
      completed: fixed.filter(({ log }) => log?.complete).length,
    };
  }, [habits, now, progress]);
}

export function useHabitLog({ habit, day, log }: HabitOccurrence) {
  const { setHabitProgress } = useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const writing = useRef(false);

  async function write(amount: number) {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    setError("");
    try {
      await setHabitProgress(habit.id, {
        day,
        amount,
        expectedRevision: log?.revision ?? 0,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Progress could not be saved. Try again.",
      );
    } finally {
      writing.current = false;
      setPending(false);
    }
  }
  return { write, pending, error };
}

export function HabitLogAction({
  occurrence,
  disabled,
  onLog,
}: {
  occurrence: HabitOccurrence;
  disabled: boolean;
  onLog: ReturnType<typeof useHabitLog>["write"];
}) {
  const { colors } = useTheme();
  const { habit, day, log } = occurrence;
  const goal = habitRevisionOn(habit, day)?.goal ?? habit.goal;
  const target = log?.target ?? habitTarget(goal);
  const binary = goal.type === "completion";
  const complete = !!log?.complete;
  if (complete && !binary) {
    return (
      <View
        accessible
        accessibilityLabel={`${habit.name} completed`}
        style={[styles.check, { backgroundColor: colors.sageSurface }]}
      >
        <Icon name="checkmark" size={20} color={colors.sageText} />
      </View>
    );
  }
  const label = binary
    ? `${complete ? "Undo" : "Complete"} ${habit.name}`
    : `Add ${goal.type === "duration" ? "1 minute" : "1"} to ${habit.name}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        goal.type === "quantity"
          ? `Updates the total in ${goal.unit}.`
          : undefined
      }
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={() =>
        void onLog(
          binary
            ? complete
              ? 0
              : 1
            : Math.min(target, (log?.amount ?? 0) + 1),
        )
      }
      style={({ pressed }) => [
        styles.check,
        {
          borderWidth: complete || !binary ? 0 : 1,
          borderColor: colors.lavender,
          backgroundColor: complete
            ? colors.sageSurface
            : binary
              ? colors.surface
              : colors.lavenderSurface,
          opacity: pressed || disabled ? 0.65 : 1,
        },
      ]}
    >
      {disabled ? (
        <ActivityIndicator size="small" color={colors.lavenderText} />
      ) : complete ? (
        <Icon name="checkmark" size={20} color={colors.sageText} />
      ) : !binary ? (
        <AppText variant="label" color={colors.lavenderText}>
          +1
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.compact,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
