export const wellnessGoalIds = [
  "calm",
  "sleep",
  "feelings",
  "habits",
  "focus",
  "explore",
] as const;

export type WellnessGoal = (typeof wellnessGoalIds)[number];
export type WellnessOnboarding = "legacy" | "pending" | "completed";
export const wellnessGoalsActionHeader = "X-Solace-Wellness-Goals";

export function isWellnessGoal(value: unknown): value is WellnessGoal {
  return wellnessGoalIds.some((goal) => goal === value);
}

export function readWellnessGoals(value: unknown): WellnessGoal[] {
  return Array.isArray(value)
    ? wellnessGoalIds.filter((goal) => value.includes(goal))
    : [];
}
