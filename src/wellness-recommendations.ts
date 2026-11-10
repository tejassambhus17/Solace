import {
  readWellnessGoals,
  type WellnessGoal,
} from "../server/src/wellness-goals";
import { createExplorePractice } from "./explore-practices";
import { routes } from "./routes";

type WellnessRecommendation = {
  goal: WellnessGoal;
  title: string;
  description: string;
  actionLabel: string;
  route: string;
  params?: Record<string, unknown>;
  via?: string;
};

const sleepWindDown = {
  ...createExplorePractice("rest", 10),
  title: "Sleep Wind Down",
};

export const wellnessRecommendations: Record<
  WellnessGoal,
  WellnessRecommendation
> = {
  calm: {
    goal: "calm",
    title: "Breath Reset",
    description:
      "Take three minutes to settle into a comfortable breathing rhythm.",
    actionLabel: "Try Breath Reset",
    route: routes.breathing,
    params: { durationSec: 180 },
  },
  sleep: {
    goal: "sleep",
    title: "Sleep Wind Down",
    description:
      "Make space for a quieter evening with a ten-minute guided practice.",
    actionLabel: "Open Sleep Wind Down",
    route: routes.momentPlayer,
    params: { activity: sleepWindDown, provider: "offline", source: "explore" },
  },
  feelings: {
    goal: "feelings",
    title: "Mood check-in",
    description: "Take a moment to notice how you feel today.",
    actionLabel: "Check in",
    route: "checkin",
  },
  habits: {
    goal: "habits",
    title: "Create your first habit",
    description: "Choose one small habit you’d like to make time for.",
    actionLabel: "Create a habit",
    route: routes.habitCreate,
    via: routes.habits,
  },
  focus: {
    goal: "focus",
    title: "Five minutes of focus",
    description:
      "Set up a short timed practice to come back to what matters right now.",
    actionLabel: "Open focus practice",
    route: routes.timedPractice,
    params: { focus: "focus", minutes: 5 },
  },
  explore: {
    goal: "explore",
    title: "Explore Solace",
    description:
      "Browse guided practices, wellness tools, and ideas for your own daily pause.",
    actionLabel: "Open Explore",
    route: routes.explore,
  },
};

export function wellnessGoalPriority(value: unknown, date?: Date) {
  const specific = readWellnessGoals(value).filter(
    (goal) => goal !== "explore",
  );
  if (specific.length < 2 || !date) return specific;
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  const offset = ((day % specific.length) + specific.length) % specific.length;
  return [...specific.slice(offset), ...specific.slice(0, offset)];
}

export function firstWellnessRecommendation(goals: unknown) {
  return wellnessRecommendations[wellnessGoalPriority(goals)[0] ?? "explore"];
}
