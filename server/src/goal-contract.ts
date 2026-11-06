export const goalMetrics = [
  "checkin-days",
  "moments",
  "mindful-minutes",
  "reflections",
] as const;
export const goalPeriods = ["week", "month", "all"] as const;

export type GoalMetric = (typeof goalMetrics)[number];
export type GoalPeriod = (typeof goalPeriods)[number];

const maximums: Record<GoalMetric, Record<GoalPeriod, number>> = {
  "checkin-days": { week: 7, month: 28, all: 10000 },
  moments: { week: 28, month: 120, all: 10000 },
  "mindful-minutes": { week: 210, month: 840, all: 100000 },
  reflections: { week: 28, month: 120, all: 10000 },
};

export function goalTargetBounds(metric: GoalMetric, period: GoalPeriod) {
  return {
    min: metric === "mindful-minutes" ? 5 : 1,
    max: maximums[metric][period],
  };
}

export function validGoalTarget(
  metric: GoalMetric,
  period: GoalPeriod,
  target: unknown,
): target is number {
  const { min, max } = goalTargetBounds(metric, period);
  return (
    typeof target === "number" &&
    Number.isInteger(target) &&
    target >= min &&
    target <= max
  );
}
