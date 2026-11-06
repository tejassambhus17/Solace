import { localDay, recordDay } from "./content";
import {
  activeSeconds,
  adjacentCalendarDay,
  calendarMonthDays,
  journeyRecords,
  visibleJourneyRecords,
  type DayEntry,
  type JourneyData,
} from "./progress";

export type JourneyPeriod = "week" | "month" | "all";
type JourneyStats = {
  checkinDays: number;
  moments: number;
  seconds: number;
};
type CalendarRange = { startDay: string; endDay: string };
type JourneyDay = {
  entries: DayEntry[];
  checkins: number;
  moments: number;
  reflections: number;
  assessments: number;
  seconds: number;
};

const collections = [
  "checkins",
  "sessions",
  "reflections",
  "assessments",
] as const;
const minCalendarDay = "1900-01-01";

function parseDay(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDay(date) === value ? date : null;
}

function dateForDay(value: string) {
  const date = parseDay(value);
  if (!date) throw new RangeError("Choose a valid calendar date.");
  return date;
}

function shiftedDay(day: string, offset: number) {
  const date = dateForDay(day);
  date.setDate(date.getDate() + offset);
  return localDay(date);
}

/** Keep reporting dates on the device calendar, including when clocks change. */
export function journeyWeek(day: string): CalendarRange {
  const date = dateForDay(day);
  const startDay = shiftedDay(day, -((date.getDay() + 6) % 7));
  return { startDay, endDay: shiftedDay(startDay, 6) };
}

function periodBounds(period: "week" | "month", day: string): CalendarRange {
  if (period === "week") return journeyWeek(day);
  const date = dateForDay(day);
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    startDay: localDay(new Date(year, month, 1, 12)),
    endDay: localDay(new Date(year, month + 1, 0, 12)),
  };
}

export function journeyRange(
  period: JourneyPeriod,
  selectedDay: string,
  today = selectedDay,
): { startDay: string | null; endDay: string } {
  dateForDay(today);
  dateForDay(selectedDay);
  if (period === "all") return { startDay: null, endDay: today };
  const bounds = periodBounds(
    period,
    selectedDay > today ? today : selectedDay,
  );
  return {
    startDay: bounds.startDay,
    endDay: bounds.endDay > today ? today : bounds.endDay,
  };
}

function emptyDay(): JourneyDay {
  return {
    entries: [],
    checkins: 0,
    moments: 0,
    reflections: 0,
    assessments: 0,
    seconds: 0,
  };
}

function earnedMilestone(
  id: string,
  title: string,
  description: string,
  icon: string,
  value: number,
  target: number,
  earnedDay: string | null,
) {
  return {
    id,
    title,
    description,
    icon,
    value,
    target,
    earned: !!earnedDay,
    earnedDay,
  };
}

function deriveMilestones(days: Map<string, JourneyDay>) {
  const savedDays = [...days.keys()].sort();
  const checkinDays = savedDays.filter((day) => days.get(day)!.checkins > 0);
  let previousDay = "";
  let run = 0;
  let longest = 0;
  let thirdDay: string | null = null;
  let seventhDay: string | null = null;
  for (const day of checkinDays) {
    run = previousDay && shiftedDay(previousDay, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    if (run === 3) thirdDay ??= day;
    if (run === 7) seventhDay ??= day;
    previousDay = day;
  }

  let completed = 0;
  let reflections = 0;
  let firstMomentDay: string | null = null;
  let fifthMomentDay: string | null = null;
  let thirdReflectionDay: string | null = null;
  let weeklyReflectionDay: string | null = null;
  for (const key of savedDays) {
    const day = days.get(key)!;
    completed += day.moments;
    reflections += day.reflections;
    if (completed >= 1) firstMomentDay ??= key;
    if (completed >= 5) fifthMomentDay ??= key;
    if (reflections >= 3) thirdReflectionDay ??= key;
    if (
      !weeklyReflectionDay &&
      day.entries.some(({ collection, record }) => {
        if (collection !== "reflections" || record.localOnly === true)
          return false;
        const period = record.weeklyPeriod;
        const start = parseDay(period?.start);
        return (
          start?.getDay() === 1 &&
          period.start <= key &&
          shiftedDay(period.start, 6) === period.end
        );
      })
    )
      weeklyReflectionDay = key;
  }

  return [
    earnedMilestone(
      "first-checkin",
      "First Check-in",
      "Save your first mood check-in.",
      "leaf-outline",
      checkinDays.length,
      1,
      checkinDays[0] ?? null,
    ),
    earnedMilestone(
      "three-day-streak",
      "3-Day Streak",
      "Save a mood check-in on three consecutive local calendar days.",
      "flower-outline",
      longest,
      3,
      thirdDay,
    ),
    earnedMilestone(
      "weekly-reflection",
      "Weekly Reflection",
      "Save a reflection from the weekly reflection experience.",
      "layers-outline",
      weeklyReflectionDay ? 1 : 0,
      1,
      weeklyReflectionDay,
    ),
    earnedMilestone(
      "seven-day-streak",
      "7-Day Streak",
      "Save a mood check-in on seven consecutive local calendar days.",
      "trail-sign-outline",
      longest,
      7,
      seventhDay,
    ),
    earnedMilestone(
      "first-moment",
      "A little beginning",
      "Complete your first Moment.",
      "leaf-outline",
      completed,
      1,
      firstMomentDay,
    ),
    earnedMilestone(
      "three-reflections",
      "Room for your thoughts",
      "Save three reflections.",
      "create-outline",
      reflections,
      3,
      thirdReflectionDay,
    ),
    earnedMilestone(
      "five-pauses",
      "Making space",
      "Complete five mindful pauses.",
      "flower-outline",
      completed,
      5,
      fifthMomentDay,
    ),
    earnedMilestone(
      "seven-checkins",
      "Getting to know you",
      "Check in on seven different days.",
      "sunny-outline",
      checkinDays.length,
      7,
      checkinDays[6] ?? null,
    ),
  ];
}

export function journeyAnalytics(
  data: JourneyData & { plans?: readonly DayEntry["record"][] },
  now = new Date(),
) {
  const records = journeyRecords(data, now);
  const days = new Map<string, JourneyDay>();
  let firstDay: string | null = null;
  for (const collection of collections) {
    const saved = records[collection];
    const raw = data[collection];
    const pending = visibleJourneyRecords(
      Array.isArray(raw)
        ? raw.filter((record) => record?.localOnly === true)
        : undefined,
      now,
      true,
    );
    const savedIds = new Set(saved.map((record) => record.id).filter(Boolean));
    for (const [index, record] of [...saved, ...pending].entries()) {
      if (record.localOnly === true && savedIds.has(record.id)) continue;
      const key = recordDay(record)!;
      let day = days.get(key);
      if (!day) {
        day = emptyDay();
        days.set(key, day);
      }
      day.entries.push({
        key: `${collection}:${record.id || index}`,
        collection,
        record,
      });
      if (record.localOnly === true) continue;
      if (!firstDay || key < firstDay) firstDay = key;
      if (collection === "sessions") {
        if (record.completed === true) {
          day.moments += 1;
          day.seconds += activeSeconds(record);
        }
      } else {
        day[collection] += 1;
      }
    }
  }
  for (const day of days.values()) {
    day.entries.sort((a, b) =>
      String(b.record.createdAt || "").localeCompare(
        String(a.record.createdAt || ""),
      ),
    );
  }
  const affirmations = visibleJourneyRecords(data.plans, now).filter(
    (item) =>
      item.type === "affirmation" &&
      typeof item.text === "string" &&
      !!item.text.trim(),
  );
  return {
    today: localDay(now),
    days,
    firstDay,
    milestones: deriveMilestones(days),
    savedStory: {
      reflections: records.reflections.length,
      affirmations: affirmations.length,
      assessments: records.assessments.length,
      checkins: records.checkins.length,
    },
  };
}

type JourneyAnalytics = ReturnType<typeof journeyAnalytics>;

export function journeyReport(
  analytics: JourneyAnalytics,
  period: JourneyPeriod,
  selectedDay: string,
) {
  const { startDay, endDay } = journeyRange(
    period,
    selectedDay,
    analytics.today,
  );
  let previousRange: CalendarRange | null = null;
  if (period !== "all" && startDay) {
    previousRange = periodBounds(period, shiftedDay(startDay, -1));
    const currentBounds = periodBounds(period, startDay);
    if (endDay < currentBounds.endDay) {
      const calendarDays = (day: string) =>
        Date.parse(`${day}T00:00:00Z`) / 86_400_000;
      const elapsed = calendarDays(endDay) - calendarDays(startDay);
      const equivalentEnd = shiftedDay(previousRange.startDay, elapsed);
      if (equivalentEnd < previousRange.endDay)
        previousRange.endDay = equivalentEnd;
    }
  }
  const stats: JourneyStats = { checkinDays: 0, moments: 0, seconds: 0 };
  const previous: JourneyStats = { checkinDays: 0, moments: 0, seconds: 0 };
  for (const [key, day] of analytics.days) {
    const target =
      (!startDay || key >= startDay) && key <= endDay
        ? stats
        : previousRange &&
            key >= previousRange.startDay &&
            key <= previousRange.endDay
          ? previous
          : null;
    if (!target) continue;
    if (day.checkins > 0) target.checkinDays += 1;
    target.moments += day.moments;
    target.seconds += day.seconds;
  }
  const hasPrevious = previous.checkinDays > 0 || previous.moments > 0;
  return {
    startDay,
    endDay,
    stats,
    previous: hasPrevious ? previous : null,
    previousRange: hasPrevious ? previousRange : null,
    comparison: hasPrevious
      ? {
          checkinDays: stats.checkinDays - previous.checkinDays,
          moments: stats.moments - previous.moments,
          seconds: stats.seconds - previous.seconds,
        }
      : null,
  };
}

export function journeyCalendar(
  analytics: JourneyAnalytics,
  period: JourneyPeriod,
  selectedDay: string,
) {
  const date = dateForDay(selectedDay);
  const startDay = period === "week" ? journeyWeek(selectedDay).startDay : null;
  const days = startDay
    ? Array.from({ length: 7 }, (_, offset) => shiftedDay(startDay, offset))
    : calendarMonthDays(date.getFullYear(), date.getMonth());
  return days.map((key) => {
    if (!key) return null;
    const counts = analytics.days.get(key);
    return {
      key,
      day: Number(key.slice(-2)),
      future: key > analytics.today,
      checkins: counts?.checkins ?? 0,
      moments: counts?.moments ?? 0,
      reflections: counts?.reflections ?? 0,
      assessments: counts?.assessments ?? 0,
    };
  });
}

export function adjacentJourneyDay(
  period: JourneyPeriod,
  day: string,
  direction: -1 | 1,
  today: string,
) {
  dateForDay(day);
  const currentDate = dateForDay(today);
  if (period !== "week")
    return adjacentCalendarDay(day, direction, currentDate);
  const target = shiftedDay(journeyWeek(day).startDay, direction * 7);
  if (target < minCalendarDay || target > today) return null;
  return target === journeyWeek(today).startDay ? today : target;
}
