import {
  emotionalRecheckResponses,
  type EmotionalRecheckResponse,
} from "../server/src/practice-recheck";
import {
  activeSeconds,
  isCompletedMoment,
  journeyRecords,
  type JourneyData,
} from "./progress";
import { isRecordId } from "./routes";

const practiceNames: Record<string, string> = {
  breathing: "Breathing",
  grounding: "Grounding",
  reflection: "Reflection",
  rest: "Rest",
  focus: "Focus",
};

export function practiceInsights(data: JourneyData, now = new Date()) {
  const { sessions, checkins } = journeyRecords(
    { sessions: data.sessions, checkins: data.checkins },
    now,
  );
  const origins = new Map(checkins.map((record) => [record.id, record]));
  const records = sessions
    .filter(
      (record) =>
        isRecordId(record.id) &&
        isCompletedMoment(record) &&
        activeSeconds(record) > 0,
    )
    .slice(0, 30)
    .map((record) => {
      const response = emotionalRecheckResponses.find(
        (value) => value === record.emotionalRecheck?.response,
      );
      const category =
        typeof record.type === "string" &&
        Object.hasOwn(practiceNames, record.type)
          ? record.type
          : undefined;
      return {
        record,
        response,
        category,
        title:
          (typeof record.title === "string" && record.title.trim()) ||
          (category ? practiceNames[category] : "Wellness practice"),
        seconds: activeSeconds(record),
        origin: origins.get(record.originCheckinId),
      };
    });
  const rated = records.filter(({ response }) => response !== undefined);
  const counts: Record<EmotionalRecheckResponse, number> = {
    "more-settled": 0,
    "about-the-same": 0,
    "less-settled": 0,
  };
  for (const { response } of rated) if (response) counts[response]++;
  const categories = Object.keys(practiceNames)
    .map((key) => ({
      key,
      records: rated.filter(({ category }) => category === key),
    }))
    .sort((a, b) => b.records.length - a.records.length);
  const group = categories[0];
  const enough = rated.length >= 3;
  const observation = !enough
    ? "Complete a few practices and share how you feel afterward to start noticing your own patterns."
    : group.records.length >= 3
      ? `${practiceNames[group.key]} practices were followed by a more-settled response in ${group.records.filter(({ response }) => response === "more-settled").length} of ${group.records.length} recent rechecks.`
      : `You reported feeling more settled after ${counts["more-settled"]} of ${rated.length} recent practices with a recheck.`;
  return { records, counts, ratedCount: rated.length, enough, observation };
}
