import { createExplorePractice } from "./explore-practices";
import { isCompletedMoment, visibleJourneyRecords } from "./progress";
import { routes } from "./routes";
import { pickDailyRoutine } from "./routine";
import { getTechnique, type TechniqueId } from "./techniques";
import { wellnessGoalPriority } from "./wellness-recommendations";

type Choice = TechniqueId | "minute-reset";
type PracticeData = Parameters<typeof pickDailyRoutine>[0];
type Preferences = Parameters<typeof pickDailyRoutine>[1];

const choicesByMood: Record<string, readonly Choice[]> = {
  Stressed: ["minute-reset", "grounding", "reflection"],
  Low: ["grounding", "reflection", "minute-reset"],
  Okay: ["minute-reset", "focus", "reflection", "wind-down"],
  Calm: ["gratitude", "focus", "wind-down", "minute-reset"],
  Great: ["gratitude", "focus", "minute-reset"],
};
const goalChoices: Partial<Record<string, readonly Choice[]>> = {
  calm: ["minute-reset", "grounding"],
  sleep: ["wind-down"],
  feelings: ["reflection", "gratitude"],
  habits: ["focus"],
  focus: ["focus"],
};
const practiceReasons: Partial<Record<Choice, string>> = {
  "minute-reset": "A short pause gives you one easy rhythm to follow.",
  grounding: "You can take it slowly and notice one detail at a time.",
  reflection:
    "A quiet prompt gives you a little space for what’s on your mind.",
  gratitude: "There’s room to notice one small thing you appreciated.",
  focus: "Choose one simple point to return to when your attention wanders.",
  "wind-down": "A gentle wind-down makes room for rest whenever you’re ready.",
};
const minuteReset = createExplorePractice("breathe", 1);

function resolveChoice(id: Choice) {
  if (id === "minute-reset") {
    return {
      id,
      practiceId: minuteReset.id,
      type: minuteReset.type,
      title: "A little space to breathe",
      description: minuteReset.description,
      artwork: "breathe" as const,
      durationSec: minuteReset.durationSec,
      selfPaced: false,
      startLabel: "Start 1-minute reset",
      route: routes.momentPlayer,
      params: { activity: minuteReset, provider: "offline" },
    };
  }
  const technique = getTechnique(id);
  if (!technique) return undefined;
  return {
    id,
    practiceId: technique.activity.id,
    type: technique.activity.type,
    title: technique.title,
    description: technique.description,
    artwork: technique.artwork,
    durationSec: technique.activity.durationSec,
    selfPaced: technique.selfPaced,
    startLabel: "Start practice",
    route: routes.momentPlayer,
    params: { techniqueId: technique.id },
  };
}

export function checkinRecommendation(
  mood: unknown,
  data: PracticeData,
  user: Preferences,
  now = new Date(),
) {
  const knownMood =
    typeof mood === "string" && Object.hasOwn(choicesByMood, mood);
  const choices = knownMood ? choicesByMood[mood] : choicesByMood.Okay;
  const goals = wellnessGoalPriority(user?.wellnessGoals, now);
  const routine = pickDailyRoutine(data, user, now);
  const chosenPractice = ["preference", "feedback", "user-choice"].includes(
    routine.source,
  )
    ? routine.suggestion.activity
    : undefined;
  const completed = visibleJourneyRecords(data.sessions, now)
    .filter(isCompletedMoment)
    .slice(0, 6);
  const latest = completed[0];
  const recent =
    latest && now.valueOf() - Date.parse(latest.createdAt) < 172_800_000
      ? latest
      : undefined;
  const ranked = choices.flatMap((id, index) => {
    const practice = resolveChoice(id);
    if (!practice) return [];
    const matchesGoal = goals.some((goal) => goalChoices[goal]?.includes(id));
    const matchesPreference = practice.type === chosenPractice;
    const samePractice = (record: (typeof completed)[number]) =>
      (record.practiceId ?? record.activity?.id) === practice.practiceId ||
      record.practiceId === id ||
      (!record.activity?.id &&
        !record.practiceId &&
        record.type === practice.type);
    const repeated = recent && samePractice(recent);
    const reportedSupport =
      user?.personalization === true &&
      completed.filter(
        (record) =>
          samePractice(record) &&
          record.emotionalRecheck?.response === "more-settled",
      ).length >= 2;
    const score =
      (choices.length - index) * 2 +
      (matchesGoal ? 3 : 0) +
      (matchesPreference ? 3 : 0) -
      (repeated ? 3 : 0) +
      (reportedSupport ? 3 : 0);
    return [{ ...practice, score, reportedSupport }];
  });
  const next = ranked.sort((a, b) => b.score - a.score)[0];
  if (!next) return undefined;
  const moodReason = knownMood
    ? `You checked in as ${mood.toLowerCase()}. `
    : "";
  return {
    ...next,
    reason:
      moodReason +
      (next.reportedSupport
        ? "You’ve reported feeling more settled after this kind of practice before."
        : (practiceReasons[next.id] ??
          "Take it at a pace that feels comfortable.")),
  };
}
