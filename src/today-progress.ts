import type { pickDailyRoutine } from "./routine";

export type ProgressCount = { completed: number; scheduled: number };
export type TodayPauseProgress = Pick<
  ReturnType<typeof pickDailyRoutine>,
  "settings" | "steps" | "practiceSkipped" | "completedCount"
>;

export function buildTodayProgress(
  routine: TodayPauseProgress,
  habits: ProgressCount,
) {
  const dailyPause = routine.settings.enabled
    ? {
        completed: routine.completedCount,
        scheduled: routine.steps.length - Number(routine.practiceSkipped),
      }
    : { completed: 0, scheduled: 0 };
  const completed = dailyPause.completed + habits.completed;
  const scheduled = dailyPause.scheduled + habits.scheduled;
  return {
    dailyPause,
    habits,
    completed,
    scheduled,
    percentage: scheduled ? Math.round((completed / scheduled) * 100) : null,
  };
}
