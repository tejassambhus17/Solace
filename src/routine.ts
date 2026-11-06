import { localDay, recordDay } from "./content";
import { createExplorePractice } from "./explore-practices";
import { isCompletedMoment, journeyRecords } from "./progress";
import {
  ritualActivities,
  ritualDurations,
  type DailyRitualSettings,
  type RitualActivity,
  type RitualDuration,
} from "../server/src/ritual-contract";
type RecordItem = Record<string, any>;
type RoutineSource =
  | "curated"
  | "time-of-day"
  | "today-checkin"
  | "preference"
  | "feedback"
  | "goal"
  | "user-choice";
export type RoutineSuggestion = {
  activity: RitualActivity;
  title: string;
  duration: string;
  reason: string;
  route: string;
  params: Record<string, any>;
};
const reflectiveMoment = createExplorePractice("reflect", 3);
const restfulMoment = createExplorePractice("rest", 3);
const suggestions: Record<RitualActivity, Omit<RoutineSuggestion, "reason">> = {
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
const practiceFocus = {
  breathing: "breathe",
  grounding: "ground",
  reflection: "reflect",
  rest: "rest",
} as const;

function customizeActivity(
  activity: RitualActivity,
  minutes: RitualDuration | undefined,
) {
  if (!minutes) return suggestions[activity];
  const moment = createExplorePractice(practiceFocus[activity], minutes);
  return {
    activity,
    title: moment.title,
    duration: `${minutes} min`,
    route: "moment-player",
    params: { activity: moment, provider: "offline", source: "today" },
  };
}

function preferenceActivity(text: string): RitualActivity | null {
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
    preferences?: RecordItem[];
    goals?: RecordItem[];
  },
  user: RecordItem | null,
  now = new Date(),
) {
  const day = localDay(now);
  const stored = data.preferences?.find((item) => item.id === "wellness")
    ?.dailyRitual as DailyRitualSettings | undefined;
  const settings: DailyRitualSettings = {
    enabled: stored?.enabled !== false,
    day,
    skipPractice: stored?.day === day && stored.skipPractice === true,
    ...(stored?.day === day && {
      activity:
        stored.activity && ritualActivities.includes(stored.activity)
          ? stored.activity
          : undefined,
      durationMinutes:
        stored.durationMinutes &&
        ritualDurations.includes(stored.durationMinutes)
          ? stored.durationMinutes
          : undefined,
    }),
  };
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
  let activity: RitualActivity = "breathing";
  let reason = "A short, curated pause. Choose what feels right for you.";
  let source: RoutineSource = "curated";
  if (now.getHours() >= 18) {
    activity = "rest";
    reason =
      "A quiet option for this evening. You can choose another practice.";
    source = "time-of-day";
  }
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
      } else if (source !== "today-checkin") {
        const goal = newest(data.goals || []).find(
          (record) =>
            record.active !== false &&
            eligible(record) &&
            ["reflections", "moments", "mindful-minutes"].includes(
              record.metric,
            ),
        );
        if (goal) {
          activity = goal.metric === "reflections" ? "reflection" : "breathing";
          reason =
            goal.metric === "reflections"
              ? "This guided reflection fits your active reflection goal."
              : "This short Moment fits an active goal you chose in Journey.";
          source = "goal";
        }
      }
    }
  }
  if (settings.activity) {
    activity = settings.activity;
    reason = "You chose this practice for today’s pause.";
    source = "user-choice";
  }
  const suggestion: RoutineSuggestion = {
    ...customizeActivity(activity, settings.durationMinutes),
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
  const practiceSkipped = settings.skipPractice && !practiceComplete;
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
    settings,
    practiceSkipped,
    todayCheckin,
    suggestion,
    source,
    steps,
    nextStep: settings.enabled
      ? steps.find(
          (step) =>
            !step.complete && !(step.id === "practice" && practiceSkipped),
        ) || null
      : null,
    completedCount: steps.filter((step) => step.complete).length,
    curated: true as const,
  };
}
