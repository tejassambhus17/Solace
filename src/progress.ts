import { localDay, recordDay } from "./content";

type RecordItem = Record<string, any>;
export type JourneyData = {
  checkins?: readonly RecordItem[];
  sessions?: readonly RecordItem[];
  reflections?: readonly RecordItem[];
  assessments?: readonly RecordItem[];
};
export type DayEntry = {
  key: string;
  collection: "checkins" | "sessions" | "reflections" | "assessments";
  record: RecordItem;
};
const categories = [
  "checkins",
  "sessions",
  "reflections",
  "assessments",
] as const;

/** Records, not inferred emotional outcomes, are the source of every progress fact. */
export function journeyRecords(
  data: JourneyData,
  now = new Date(),
  includePending = false,
) {
  if (Number.isNaN(now.valueOf()))
    throw new RangeError("A valid date is required.");
  const today = localDay(now);
  const result = {} as Record<(typeof categories)[number], RecordItem[]>;
  for (const collection of categories) {
    const seen = new Set<string>();
    result[collection] = (
      Array.isArray(data[collection]) ? [...data[collection]!] : []
    )
      .filter((item) => {
        if (
          !item ||
          typeof item !== "object" ||
          (!includePending && item.localOnly === true)
        )
          return false;
        const day = recordDay(item);
        const timestamp = Date.parse(item.createdAt);
        if (
          !day ||
          day > today ||
          (!Number.isNaN(timestamp) && timestamp > now.valueOf())
        )
          return false;
        if (typeof item.id === "string" && item.id) {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
        }
        return true;
      })
      .sort((a, b) =>
        String(b.createdAt || recordDay(b)).localeCompare(
          String(a.createdAt || recordDay(a)),
        ),
      );
  }
  return result;
}

export function activeSeconds(session: RecordItem) {
  const value =
    session.durationSec ?? session.durationSeconds ?? session.duration;
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 7200
    ? value
    : 0;
}

export function journeySummary(data: JourneyData, now = new Date()) {
  const records = journeyRecords(data, now);
  const completed = records.sessions.filter((item) => item.completed === true);
  const checkinDays = new Set(records.checkins.map(recordDay));
  const activityDays = new Set(
    categories.flatMap((collection) => records[collection].map(recordDay)),
  );
  const today = localDay(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const startDay = localDay(start);
  const weeklyCompleted = completed.filter(
    (item) => recordDay(item)! >= startDay,
  );
  const seconds = completed.reduce((sum, item) => sum + activeSeconds(item), 0);
  const weeklySeconds = weeklyCompleted.reduce(
    (sum, item) => sum + activeSeconds(item),
    0,
  );
  const cursor = new Date(now);
  if (!checkinDays.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (checkinDays.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    records,
    completedCount: completed.length,
    checkinDays: checkinDays.size,
    reflectionCount: records.reflections.length,
    activityDays: activityDays.size,
    helpfulCount: completed.filter(
      (item) => item.feedback === "Helped" || item.feedback === "A little",
    ).length,
    ratedCount: completed.filter((item) =>
      ["Helped", "A little", "Not for me"].includes(item.feedback),
    ).length,
    minutes: Math.floor(seconds / 60),
    weeklyMinutes: Math.floor(weeklySeconds / 60),
    weeklySeconds,
    streak,
    startDay,
    endDay: today,
    milestones: [
      {
        id: "first-moment",
        title: "A little beginning",
        description: "Complete your first Moment",
        value: completed.length,
        target: 1,
        icon: "leaf-outline",
      },
      {
        id: "three-reflections",
        title: "Room for your thoughts",
        description: "Save three reflections",
        value: records.reflections.length,
        target: 3,
        icon: "create-outline",
      },
      {
        id: "five-pauses",
        title: "Making space",
        description: "Complete five mindful pauses",
        value: completed.length,
        target: 5,
        icon: "flower-outline",
      },
      {
        id: "seven-checkins",
        title: "Getting to know you",
        description: "Check in on seven different days",
        value: checkinDays.size,
        target: 7,
        icon: "sunny-outline",
      },
    ].map((item) => ({ ...item, earned: item.value >= item.target })),
  };
}

export function calendarMonth(
  year: number,
  month: number,
  data: JourneyData,
  now = new Date(),
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1900 ||
    year > 2200 ||
    month < 0 ||
    month > 11
  )
    throw new RangeError("Choose a valid calendar month.");
  const records = journeyRecords(data, now);
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0, 12).getDate();
  const cells = Math.ceil((offset + length) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > length) return null;
    const date = new Date(year, month, day, 12);
    const key = localDay(date);
    const checkins = records.checkins.filter((item) => recordDay(item) === key);
    const count = categories.reduce(
      (sum, collection) =>
        sum +
        records[collection].filter((item) => recordDay(item) === key).length,
      0,
    );
    return {
      key,
      day,
      mood: checkins[0]?.mood || null,
      count,
      future: key > localDay(now),
    };
  });
}

export function entriesOnDay(
  data: JourneyData,
  day: string,
  now = new Date(),
): DayEntry[] {
  const records = journeyRecords(data, now, true);
  return categories
    .flatMap((collection) =>
      records[collection]
        .filter((record) => recordDay(record) === day)
        .map((record, index) => ({
          key: `${collection}:${record.id || index}`,
          collection,
          record,
        })),
    )
    .sort((a, b) =>
      String(b.record.createdAt || "").localeCompare(
        String(a.record.createdAt || ""),
      ),
    );
}

export function goalProgress(minutesTarget: unknown, seconds: number) {
  const target =
    typeof minutesTarget === "number" &&
    Number.isInteger(minutesTarget) &&
    minutesTarget >= 5 &&
    minutesTarget <= 210
      ? minutesTarget
      : 15;
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return {
    target,
    fraction: Math.min(1, safeSeconds / (target * 60)),
    reached: safeSeconds >= target * 60,
  };
}
