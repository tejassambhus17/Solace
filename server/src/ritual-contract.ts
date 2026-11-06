export const ritualActivities = [
  "breathing",
  "grounding",
  "reflection",
  "rest",
] as const;
export const ritualDurations = [3, 5, 10] as const;

export type RitualActivity = (typeof ritualActivities)[number];
export type RitualDuration = (typeof ritualDurations)[number];
export type DailyRitualSettings = {
  enabled: boolean;
  day: string;
  skipPractice: boolean;
  activity?: RitualActivity;
  durationMinutes?: RitualDuration;
};
