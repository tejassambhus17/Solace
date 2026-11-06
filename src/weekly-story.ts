import { summarizeWeek } from "../server/src/weekly-facts";
import { recordDay } from "./content";
import { journeyRecords, type JourneyData } from "./progress";

export type StoryPeriod = { start: string; end: string };

export function weeklyStoryFacts(
  data: JourneyData,
  period: StoryPeriod,
  now = new Date(),
) {
  const records = journeyRecords(data, now);
  const within = (items: typeof records.checkins) =>
    items.flatMap((record) => {
      const day = recordDay(record);
      return day && day >= period.start && day <= period.end
        ? [{ record, day }]
        : [];
    });
  return summarizeWeek({
    checkins: within(records.checkins),
    sessions: within(records.sessions),
    reflections: within(records.reflections),
  });
}

export function reflectionPeriodLabel({ start, end }: StoryPeriod) {
  const format = (day: string, year: boolean) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(year ? { year: "numeric" } : {}),
    });
  return `${format(start, start.slice(0, 4) !== end.slice(0, 4))} to ${format(end, true)}`;
}
