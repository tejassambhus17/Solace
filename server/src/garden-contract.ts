import {
  addHabitDays,
  habitDay,
  habitRevisionOn,
  habitWeekStart,
  isHabitScheduled,
  type Habit,
  type HabitGarden,
  type HabitProgress,
} from "./habit-contract.ts";

export const gardenIntentionKinds = [
  "calming",
  "breathing",
  "sleep",
  "journal",
  "habit",
] as const;
export type GardenIntentionKind = (typeof gardenIntentionKinds)[number];
export type GardenIntentionChoice =
  | { kind: Exclude<GardenIntentionKind, "habit"> }
  | { kind: "habit"; habitId: string };
export type GardenContributor = {
  collection: "sessions" | "reflections" | "habitProgress";
  recordId: string;
  day: string;
};
export type GardenIntention = GardenIntentionChoice & {
  id: string;
  weekStart: string;
  timeZone: string;
  target: number;
  contributors: GardenContributor[];
  createdAt: string;
};
export type GardenState = {
  gardenIntentions: GardenIntention[];
  habitGarden: HabitGarden[];
};

export const gardenIntentionTargets = {
  calming: 2,
  breathing: 3,
  sleep: 2,
  journal: 2,
} as const;

export function currentGardenIntention(
  intentions: readonly GardenIntention[],
  now: Date,
) {
  // The selection's time zone stays fixed until its week ends.
  const latest = intentions[0];
  return latest &&
    habitWeekStart(habitDay(latest.timeZone, now)) === latest.weekStart
    ? latest
    : undefined;
}

export function remainingGardenHabitDays(
  habit: Habit,
  progress: readonly HabitProgress[],
  weekStart: string,
  now: Date,
) {
  if (habit.status !== "active") return 0;
  const habitToday = habitDay(habit.timeZone, now);
  const earned = new Set(
    progress
      .filter((log) => log.habitId === habit.id && log.earned)
      .map((log) => log.day),
  );
  let remaining = 0;
  let alreadyEarned = 0;
  for (let offset = 0; offset < 7; offset++) {
    const day = addHabitDays(weekStart, offset);
    if (earned.has(day)) alreadyEarned++;
    else if (day >= habitToday && isHabitScheduled(habit, day)) remaining++;
  }
  const revision = habitRevisionOn(habit, habitToday);
  return revision?.schedule.type === "weekly"
    ? Math.min(
        remaining,
        Math.max(0, revision.schedule.daysPerWeek - alreadyEarned),
      )
    : remaining;
}
