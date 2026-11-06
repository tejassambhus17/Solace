type DatedRecord = { record: Record<string, unknown>; day: string };

export function summarizeWeek({
  checkins,
  sessions,
  reflections,
}: {
  checkins: readonly DatedRecord[];
  sessions: readonly DatedRecord[];
  reflections: readonly DatedRecord[];
}) {
  const completed = sessions.filter(({ record }) => record.completed === true);
  const moments = completed.filter(({ record }) => record.type !== "resource");
  const seconds = completed.reduce((sum, { record }) => {
    const duration =
      record.durationSec ?? record.durationSeconds ?? record.duration;
    return typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration >= 0 &&
      duration <= 7200
      ? sum + duration
      : sum;
  }, 0);
  return {
    checkins: checkins.length,
    completedSessions: moments.length,
    minutes: Math.floor(seconds / 60),
    reflections: reflections.length,
    helpfulSessions: moments.filter(
      ({ record }) =>
        record.feedback === "Helped" || record.feedback === "A little",
    ).length,
    days: [...new Set(checkins.map(({ day }) => day))].sort(),
  };
}

export type WeeklyFacts = ReturnType<typeof summarizeWeek>;

export function hasWeeklyActivity(facts: WeeklyFacts) {
  return (
    facts.checkins +
      facts.completedSessions +
      facts.minutes +
      facts.reflections >
    0
  );
}

export function savedWeeklyStory<T extends Record<string, unknown>>(
  records: readonly T[],
  end: string,
) {
  return records.reduce<T | undefined>((latest, record) => {
    const period = record.weeklyPeriod;
    if (
      !period ||
      typeof period !== "object" ||
      !("end" in period) ||
      period.end !== end
    )
      return latest;
    return !latest || String(record.createdAt) > String(latest.createdAt)
      ? record
      : latest;
  }, undefined);
}
