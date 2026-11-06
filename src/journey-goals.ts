import {
  goalMetrics,
  goalPeriods,
  validGoalTarget,
  type GoalMetric,
  type GoalPeriod,
} from "../server/src/goal-contract";
import { localDay, recordDay } from "./content";
import { journeyRange } from "./journey-analytics";
import {
  activeSeconds,
  isCompletedMoment,
  journeyRecords,
  type DayEntry,
  type JourneyData,
} from "./progress";

export type JourneyGoal = {
  id: string;
  title: string;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  active: boolean;
  legacyWeekly?: true;
};

export const journeyGoalLabels: Record<GoalMetric, string> = {
  "checkin-days": "Check-in days",
  moments: "Completed Moments",
  "mindful-minutes": "Mindful minutes",
  reflections: "Saved reflections",
};

export const journeyGoalPeriodLabels: Record<GoalPeriod, string> = {
  week: "This week",
  month: "This month",
  all: "All time",
};

function readGoal(value: unknown): JourneyGoal | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.title !== "string" ||
    !record.title.trim()
  )
    return;
  const legacy =
    record.metric === undefined &&
    record.period === undefined &&
    record.target === undefined;
  const metric = legacy
    ? "mindful-minutes"
    : goalMetrics.find((value) => value === record.metric);
  const period = legacy
    ? "week"
    : goalPeriods.find((value) => value === record.period);
  const target = legacy ? record.targetMinutesPerWeek : record.target;
  if (!metric || !period || !validGoalTarget(metric, period, target)) return;
  return {
    id: record.id,
    title: record.title,
    metric,
    period,
    target,
    active: record.active !== false,
    ...(legacy ? { legacyWeekly: true as const } : {}),
  };
}

export function selectJourneyGoal(records: readonly unknown[] = []) {
  const goals = records.map(readGoal);
  return goals.find((goal) => goal?.active) ?? goals.find(Boolean);
}

export function journeyGoalProgress(
  goal: JourneyGoal,
  data: JourneyData,
  now = new Date(),
) {
  const today = localDay(now);
  const rollingStart = new Date(now);
  rollingStart.setDate(rollingStart.getDate() - 6);
  const { startDay, endDay } = goal.legacyWeekly
    ? { startDay: localDay(rollingStart), endDay: today }
    : journeyRange(goal.period, today);
  const collection =
    goal.metric === "checkin-days"
      ? "checkins"
      : goal.metric === "reflections"
        ? "reflections"
        : "sessions";
  const records = journeyRecords({ [collection]: data[collection] }, now);
  const days = new Set<string>();
  const activities: DayEntry[] = records[collection]
    .filter((record) => {
      const day = recordDay(record);
      if (!day || (startDay && day < startDay) || day > endDay) return false;
      if (goal.metric === "moments") return isCompletedMoment(record);
      if (goal.metric === "mindful-minutes")
        return record.completed === true && activeSeconds(record) > 0;
      if (collection !== "checkins") return true;
      if (days.has(day)) return false;
      days.add(day);
      return true;
    })
    .map((record, index) => ({
      key: `${collection}:${record.id || index}`,
      collection,
      record,
    }));
  const isTime = goal.metric === "mindful-minutes";
  const seconds = isTime
    ? activities.reduce(
        (seconds, { record }) => seconds + activeSeconds(record),
        0,
      )
    : 0;
  const value = isTime ? seconds / 60 : activities.length;
  const target = validGoalTarget(goal.metric, goal.period, goal.target)
    ? goal.target
    : 0;
  const fraction = target > 0 ? Math.min(1, value / target) : 0;
  const unit = {
    "checkin-days": "check-in days",
    moments: "Moments",
    "mindful-minutes": "minutes",
    reflections: "reflections",
  }[goal.metric];
  const current = Math.floor(value);
  const remainder = Math.floor(seconds % 60);
  const description =
    isTime && remainder
      ? `${current ? `${current} min ` : ""}${remainder} sec of ${target} minutes`
      : `${current} of ${target} ${unit}`;
  return {
    current,
    target,
    fraction,
    percentage: Math.floor(fraction * 100),
    reached: target > 0 && value >= target,
    unit,
    description,
    period: goal.legacyWeekly
      ? "Last 7 days"
      : journeyGoalPeriodLabels[goal.period],
    activities,
  };
}
