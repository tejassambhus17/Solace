import { localDay, recordDay } from "./content";

const MOODS = ["Okay", "Calm", "Low", "Stressed", "Great"] as const;
export type WeeklyMood = (typeof MOODS)[number];
type WeeklyRecord = Record<string, any>;
export type WeeklyData = {
  checkins?: readonly WeeklyRecord[];
  sessions?: readonly WeeklyRecord[];
  reflections?: readonly WeeklyRecord[];
};
export type WeeklyReview = {
  startDay: string;
  endDay: string;
  daysCheckedIn: number;
  checkinCount: number;
  moods: { mood: WeeklyMood; count: number }[];
  leadingMood: WeeklyMood | null;
  completedMoments: number;
  supportiveMoments: number;
  reflectionCount: number;
  suggestedPrompt: string;
};

/** A factual seven-calendar-day summary, never a wellbeing score or diagnosis. */
export function weeklyReview(
  data: WeeklyData = {},
  now = new Date(),
): WeeklyReview {
  if (Number.isNaN(now.valueOf())) {
    throw new RangeError("A valid date is required for the weekly review.");
  }
  const endDay = localDay(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const startDay = localDay(start);
  const withinWeek = (records: readonly WeeklyRecord[] | undefined) => {
    const seen = new Set<string>();
    return (Array.isArray(records) ? records : []).filter((record) => {
      if (!record || typeof record !== "object") return false;
      const day = recordDay(record);
      if (!day || day < startDay || day > endDay) return false;
      // The explicit local day determines the calendar bucket. A known future
      // timestamp still cannot describe activity that has already happened.
      const timestamp = new Date(record.createdAt).valueOf();
      if (!Number.isNaN(timestamp) && timestamp > now.valueOf()) return false;
      if (typeof record.id === "string" && record.id) {
        if (seen.has(record.id)) return false;
        seen.add(record.id);
      }
      return true;
    });
  };
  const checkins = withinWeek(data.checkins);
  const daysCheckedIn = new Set(checkins.map(recordDay)).size;
  const counts = new Map<string, number>(MOODS.map((mood) => [mood, 0]));
  for (const checkin of checkins) {
    if (counts.has(checkin.mood)) {
      counts.set(checkin.mood, counts.get(checkin.mood)! + 1);
    }
  }
  const moods = MOODS.map((mood) => ({ mood, count: counts.get(mood)! }));
  const maximum = Math.max(...moods.map(({ count }) => count));
  const leaders = moods.filter(({ count }) => count === maximum && count > 0);
  const completed = withinWeek(data.sessions).filter(
    (session) => session.completed === true,
  );
  const supportiveMoments = completed.filter(
    (session) =>
      session.feedback === "Helped" || session.feedback === "A little",
  ).length;
  const reflectionCount = withinWeek(data.reflections).length;
  const suggestedPrompt = supportiveMoments
    ? "Which practices felt useful, even a little, and what might you want to return to?"
    : checkins.length
      ? "Looking back at your check-ins this week, what stands out, and what would you like to make room for next?"
      : reflectionCount
        ? "When you look back at what you wrote this week, what would you like to carry with you?"
        : completed.length
          ? "What did you notice while making time for yourself this week, and what would you like to try next?"
          : "What would you like to make a little room for this week?";
  return {
    startDay,
    endDay,
    daysCheckedIn,
    checkinCount: checkins.length,
    moods,
    leadingMood: leaders.length === 1 ? leaders[0].mood : null,
    completedMoments: completed.length,
    supportiveMoments,
    reflectionCount,
    suggestedPrompt,
  };
}
