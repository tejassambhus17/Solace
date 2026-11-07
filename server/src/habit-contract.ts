export const habitCategories = [
  "mindfulness",
  "movement",
  "hydration",
  "sleep",
  "reading",
  "journaling",
  "self-care",
  "personal-growth",
] as const;
export const habitIcons = [
  "leaf",
  "walk",
  "water",
  "moon",
  "book",
  "journal",
  "heart",
  "sparkles",
] as const;
export const habitColors = ["sage", "lavender", "peach"] as const;
export const habitStatuses = ["active", "paused", "archived"] as const;

export type HabitCategory = (typeof habitCategories)[number];
export type HabitIcon = (typeof habitIcons)[number];
export type HabitColor = (typeof habitColors)[number];
export type HabitStatus = (typeof habitStatuses)[number];
export type HabitGoal =
  | { type: "completion" }
  | { type: "quantity"; target: number; unit: string }
  | { type: "duration"; target: number };
export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekdays"; days: number[] }
  | { type: "weekly"; daysPerWeek: number };
export type HabitDraft = {
  name: string;
  description?: string;
  category: HabitCategory;
  icon: HabitIcon;
  color: HabitColor;
  goal: HabitGoal;
  schedule: HabitSchedule;
  reminderTime: string | null;
  activity?: "breathing";
};
export type HabitRevision = Pick<
  HabitDraft,
  "goal" | "schedule" | "activity"
> & {
  day: string;
  status: HabitStatus;
};
export type Habit = HabitDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
  timeZone: string;
  status: HabitStatus;
  revision: number;
  revisions: HabitRevision[];
};
export type HabitProgress = {
  id: string;
  habitId: string;
  day: string;
  amount: number;
  target: number;
  complete: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  // The day earns at most one lifetime garden credit, even after correction.
  earned: boolean;
  linkedSessionIds?: string[];
};

export const habitGardenStages = [
  { stage: "seed", minimum: 0 },
  { stage: "sprout", minimum: 1 },
  { stage: "growing", minimum: 5 },
  { stage: "blooming", minimum: 12 },
  { stage: "flourishing", minimum: 25 },
] as const;
export type HabitGardenStage = (typeof habitGardenStages)[number]["stage"];
export type HabitGarden = {
  id: "garden";
  earnedTotal: number;
  stage: HabitGardenStage;
  createdAt: string;
  updatedAt: string;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

export function habitDay(timeZone: string, now = new Date()) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addHabitDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function habitWeekday(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function habitWeekStart(day: string) {
  return addHabitDays(day, -((habitWeekday(day) + 6) % 7));
}

export function habitRevisionOn(habit: Habit, day: string) {
  for (let index = habit.revisions.length - 1; index >= 0; index--) {
    if (habit.revisions[index].day <= day) return habit.revisions[index];
  }
  return undefined;
}

function scheduleEligible(revision: HabitRevision | undefined, day: string) {
  return (
    revision?.status === "active" &&
    (revision.schedule.type !== "weekdays" ||
      revision.schedule.days.includes(habitWeekday(day)))
  );
}

/** Flexible days are eligible for logging but aren't daily requirements. */
export function isHabitScheduled(habit: Habit, day: string) {
  return scheduleEligible(habitRevisionOn(habit, day), day);
}

export function habitTarget(goal: HabitGoal) {
  return goal.type === "completion" ? 1 : goal.target;
}

export function habitGardenStage(earnedTotal: number): HabitGardenStage {
  return (
    [...habitGardenStages]
      .reverse()
      .find(({ minimum }) => earnedTotal >= minimum)?.stage ?? "seed"
  );
}

const percentage = (completed: number, scheduled: number) =>
  scheduled ? Math.round((completed * 100) / scheduled) : 0;

export function habitInsights(
  habits: readonly Habit[],
  progress: readonly HabitProgress[],
  start: string,
  end: string,
  today: string,
  now?: Date,
) {
  const rangeEnd = end < today ? end : today;
  const completedByHabit = new Map<string, Set<string>>();
  for (const log of progress) {
    if (!log.complete) continue;
    const dates = completedByHabit.get(log.habitId) ?? new Set<string>();
    dates.add(log.day);
    completedByHabit.set(log.habitId, dates);
  }

  type CalendarDay = { day: string; completed: number; scheduled: number };
  const dayStats = new Map<string, CalendarDay>();
  for (let day = start; day <= rangeEnd; day = addHabitDays(day, 1)) {
    dayStats.set(day, { day, completed: 0, scheduled: 0 });
  }
  const fixedDays = new Map<
    string,
    { scheduled: number; completed: number; closedMiss: boolean }
  >();
  let completedActions = 0;
  const habitStats = habits.map((habit) => {
    let scheduled = 0;
    let completed = 0;
    let revisionIndex = 0;
    const dates = completedByHabit.get(habit.id);
    const weeks = new Map<
      string,
      { eligible: number; complete: number; target: number }
    >();
    const first = habit.revisions[0]?.day;
    const habitToday = now ? habitDay(habit.timeZone, now) : today;
    const elapsedThrough = habitToday < today ? habitToday : today;
    if (first) {
      for (let day = first; day <= elapsedThrough; day = addHabitDays(day, 1)) {
        while (habit.revisions[revisionIndex + 1]?.day <= day) revisionIndex++;
        const revision = habit.revisions[revisionIndex];
        if (!scheduleEligible(revision, day)) continue;
        const done = dates?.has(day) ? 1 : 0;
        const row = dayStats.get(day);
        if (revision.schedule.type !== "weekly") {
          const streakDay = fixedDays.get(day) ?? {
            scheduled: 0,
            completed: 0,
            closedMiss: false,
          };
          streakDay.scheduled++;
          streakDay.completed += done;
          if (!done && day < habitToday) streakDay.closedMiss = true;
          fixedDays.set(day, streakDay);
        }
        if (!row) continue;
        row.completed += done;
        completedActions += done;
        if (revision.schedule.type === "weekly") {
          const week = habitWeekStart(day);
          const target = revision.schedule.daysPerWeek;
          const bucket = weeks.get(week) ?? {
            eligible: 0,
            complete: 0,
            target,
          };
          bucket.eligible++;
          bucket.complete += done;
          // The final effective target in a week applies to that week's flexible plan.
          bucket.target = target;
          weeks.set(week, bucket);
        } else {
          scheduled++;
          completed += done;
          row.scheduled++;
        }
      }
    }
    for (const { eligible, complete, target } of weeks.values()) {
      const due = Math.min(eligible, target);
      scheduled += due;
      completed += Math.min(due, complete);
    }
    return {
      habitId: habit.id,
      scheduled,
      completed,
      percentage: percentage(completed, scheduled),
    };
  });
  let currentStreak = 0;
  let bestStreak = 0;
  for (const [, { scheduled, completed, closedMiss }] of [...fixedDays].sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    if (completed === scheduled) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else if (closedMiss) {
      currentStreak = 0;
    }
  }
  const scheduled = habitStats.reduce(
    (total, habit) => total + habit.scheduled,
    0,
  );
  const completed = habitStats.reduce(
    (total, habit) => total + habit.completed,
    0,
  );
  return {
    scheduled,
    completed,
    completedActions,
    percentage: percentage(completed, scheduled),
    currentStreak,
    bestStreak,
    days: [...dayStats.values()],
    habits: habitStats,
  };
}
