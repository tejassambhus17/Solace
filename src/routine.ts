import { localDay, recordDay } from "./content";
import { createExplorePractice } from "./explore-practices";
import { isCompletedMoment, journeyRecords } from "./progress";
type RecordItem = Record<string, any>;
export type RoutineActivity = "breathing" | "grounding" | "reflection" | "rest";
export type RoutineSuggestion = {
  activity: RoutineActivity;
  title: string;
  duration: string;
  reason: string;
  route: string;
  params: Record<string, any>;
};
const reflectiveMoment = createExplorePractice("reflect", 3);
const restfulMoment = createExplorePractice("rest", 3);
const suggestions: Record<
  RoutineActivity,
  Omit<RoutineSuggestion, "reason">
> = {
  breathing: {
    activity: "breathing",
    title: "A little breathing room",
    duration: "3 min",
    route: "breathing",
    params: { durationSec: 180 },
  },
  grounding: {
    activity: "grounding",
    title: "Come back to this moment",
    duration: "2 min",
    route: "grounding",
    params: {},
  },
  reflection: {
    activity: "reflection",
    title: reflectiveMoment.title,
    duration: "3 min",
    route: "moment-player",
    params: {
      activity: reflectiveMoment,
      provider: "offline",
      source: "today",
    },
  },
  rest: {
    activity: "rest",
    title: restfulMoment.title,
    duration: "3 min",
    route: "moment-player",
    params: { activity: restfulMoment, provider: "offline", source: "today" },
  },
};
function preferenceActivity(text: string): RoutineActivity | null {
  // Explicit activity words only; free writing is not used to infer a diagnosis.
  if (/\b(not|never|avoid|dislike|don't|do not)\b/i.test(text)) return null;
  if (/\b(grounding|grounded|five.senses)\b/i.test(text)) return "grounding";
  if (/\b(breathing|breathwork|breathe)\b/i.test(text)) return "breathing";
  if (/\b(journaling|journal|reflection|writing)\b/i.test(text))
    return "reflection";
  if (/\b(sleep|bedtime)\b/i.test(text)) return "rest";
  return null;
}
const newest = (records: RecordItem[]) =>
  [...records].sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  );
/** Curated on this device. This helper does not call AI or inspect conversations.
 * Saved preferences and past feedback are consulted only with global consent. */
export function pickDailyRoutine(
  data: {
    checkins?: RecordItem[];
    sessions?: RecordItem[];
    reflections?: RecordItem[];
    memories?: RecordItem[];
  },
  user: RecordItem | null,
  now = new Date(),
) {
  const day = localDay(now);
  const eligible = (record: RecordItem) => {
    const recordedDay = recordDay(record);
    return !!recordedDay && recordedDay <= day;
  };
  const { checkins, reflections, sessions } = data;
  const records = journeyRecords(
    { checkins, reflections, sessions },
    now,
    true,
  );
  const todayCheckins = records.checkins.filter(
    (record) => recordDay(record) === day,
  );
  const todayCheckin = todayCheckins[0];
  let activity: RoutineActivity = "breathing";
  let reason = "A short, curated pause. Choose what feels right for you.";
  let source: "curated" | "today-checkin" | "preference" | "feedback" =
    "curated";
  if (todayCheckin?.mood === "Stressed" || todayCheckin?.mood === "Low") {
    activity = "grounding";
    reason = `A gentle option for the ${String(todayCheckin.mood).toLowerCase()} feeling you checked in with today.`;
    source = "today-checkin";
  } else if (todayCheckin?.mood === "Calm" || todayCheckin?.mood === "Great") {
    activity = "reflection";
    reason = "A little space to notice what is supporting you today.";
    source = "today-checkin";
  }
  if (user?.personalization === true) {
    const preference = newest(
      (data.memories || []).filter(
        (record) => record.approved === true && eligible(record),
      ),
    )
      .map((record) =>
        preferenceActivity(String(record.text || record.content || "")),
      )
      .find(Boolean);
    if (preference) {
      activity = preference;
      reason =
        "Chosen from an activity preference you approved. You can change preferences in Profile.";
      source = "preference";
    } else {
      const helpful = records.sessions.find(
        (record) =>
          record.localOnly !== true &&
          record.completed === true &&
          record.feedback === "Helped" &&
          (["breathing", "grounding", "reflection", "rest"].includes(
            record.type,
          ) ||
            (record.type === "resource" && record.resourceId === "sleep")),
      );
      if (helpful) {
        activity = helpful.type === "resource" ? "rest" : helpful.type;
        reason =
          helpful.type === "resource"
            ? "You found a sleep guide helpful before. This is a short guided rest."
            : "You marked this kind of activity helpful before. Try it again, or choose something else.";
        source = "feedback";
      }
    }
  }
  const suggestion: RoutineSuggestion = {
    ...suggestions[activity],
    params: { ...suggestions[activity].params },
    reason,
  };
  const savedToday = (record: RecordItem) =>
    record.localOnly !== true && recordDay(record) === day;
  const checkinComplete = todayCheckins.some(savedToday);
  const reflectionComplete = records.reflections.some(
    (record) =>
      savedToday(record) &&
      !!String(record.text || record.content || record.note || "").trim(),
  );
  const practiceComplete = records.sessions.some(
    (record) => savedToday(record) && isCompletedMoment(record),
  );
  const steps = [
    {
      id: "checkin",
      title: "Check in",
      complete: checkinComplete,
      route: "checkin",
      params: {},
    },
    {
      id: "practice",
      title: "Take a Moment",
      complete: practiceComplete,
      route: suggestion.route,
      params: suggestion.params,
    },
    {
      id: "reflection",
      title: "Reflect",
      complete: reflectionComplete,
      route: "reflection",
      params: {
        prompt:
          "What would you like to carry from this moment into the rest of your day?",
      },
    },
  ] as const;
  return {
    day,
    todayCheckin,
    suggestion,
    source,
    steps,
    nextStep: steps.find((step) => !step.complete) || null,
    completedCount: steps.filter((step) => step.complete).length,
    curated: true as const,
  };
}
