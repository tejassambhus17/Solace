import type { AppAction } from "../server/src/companion-app-action";
import {
  addHabitDays,
  habitDay,
  habitInsights,
  habitRevisionOn,
  habitTarget,
  habitWeekStart,
  isHabitScheduled,
} from "../server/src/habit-contract";
import { getTimedPractice } from "../server/src/timed-practice-contract";
import { localDay, recordDay } from "./content";
import { createExplorePractice } from "./explore-practices";
import type { ReminderInput } from "./notifications";
import { activeSeconds, journeyRecords } from "./progress";
import { isRecordId, routes } from "./routes";
import type { AppState } from "./store";

type Destination = Extract<AppAction, { kind: "navigate" }>["destination"];
type Shortcut = readonly [
  name: string,
  root?: string,
  params?: Record<string, unknown>,
];

const shortcuts: Record<Destination, Shortcut> = {
  today: [routes.today],
  "daily-pause": [routes.today, undefined, { section: "daily-pause" }],
  solace: [routes.solace],
  companion: [routes.companion],
  "conversation-history": [routes.history],
  journal: [routes.journal],
  "journal-editor": [routes.journalEditor],
  explore: [routes.explore],
  "wellness-tools": [routes.wellnessTools, routes.explore],
  "ambient-mixer": ["ambient-mixer", routes.explore],
  "wellness-toolkit": ["toolkit", routes.explore],
  "guided-techniques": [routes.techniques, routes.explore],
  "guided-programs": [routes.guidedPrograms, routes.explore],
  "wellness-plan": [routes.wellnessPlan, routes.explore],
  "timed-practice": [routes.timedPractice, routes.explore],
  habits: [routes.habits, routes.explore],
  "habit-library": [routes.habitLibrary, routes.explore],
  "habit-insights": [routes.habitInsights, routes.explore],
  "habit-garden": [routes.habitGarden, routes.explore],
  "habit-reminders": [routes.habitReminders, routes.explore],
  journey: [routes.journey],
  "journey-activity": ["journey-activity", routes.journey],
  milestones: ["journey-milestones", routes.journey],
  "personal-goal": ["journey-goal", routes.journey],
  profile: [routes.profile],
  appearance: ["settings", routes.profile],
  "wellness-goals": [routes.wellnessGoals, routes.profile],
  reminders: ["reminders", routes.profile],
  memory: [routes.memory, routes.profile],
  support: [routes.support, routes.profile],
  account: ["account", routes.profile],
  privacy: ["account", routes.profile, { section: "privacy" }],
  about: ["about", routes.profile],
  checkin: ["checkin", routes.today],
  moments: ["moments", routes.explore],
  resources: ["resources", routes.explore],
  "sleep-guide": ["sleep", routes.explore],
  grounding: ["grounding", routes.explore],
  affirmations: ["affirmation", routes.explore],
  "saved-affirmations": ["saved-affirmations", routes.journey],
  "daily-challenge": ["challenge", routes.explore],
  "reflective-checkins": ["assessments", routes.explore],
};

const practiceFocus = {
  breathing: "calm",
  grounding: "focus",
  "wind-down": "sleep",
  focus: "focus",
} as const;

export type NavigationAction = Extract<
  AppAction,
  { kind: "navigate" | "practice-start" | "progress" | "journal-search" }
>;

export type PracticeAction = Extract<
  NavigationAction,
  { kind: "practice-start" }
>;

export function companionPractice(action: PracticeAction) {
  if (
    action.practice === "breathing" &&
    (action.minutes === 1 || action.minutes === 3)
  )
    return createExplorePractice("breathe", action.minutes);
  if (action.practice === "grounding" && action.minutes === 5)
    return { ...createExplorePractice("ground", 5), title: "Five Senses" };
  return getTimedPractice(practiceFocus[action.practice], action.minutes);
}

export function openCompanionDestination(
  app: Pick<AppState, "navigate" | "switchSolaceMode"> &
    Partial<Pick<AppState, "params">>,
  action: NavigationAction,
  conversationId?: string,
  now = new Date(),
) {
  if (action.kind === "navigate") {
    const [name, root, params] = shortcuts[action.destination];
    if (name === routes.companion || name === routes.history) {
      if (conversationId)
        app.navigate(routes.companion, { id: conversationId });
      else app.switchSolaceMode("companion");
      if (name === routes.history) app.navigate(routes.history);
      return;
    }
    if (root) app.navigate(root);
    app.navigate(name, params);
    return;
  }
  if (action.kind === "progress") {
    app.navigate(routes.journey, { period: action.period });
    return;
  }
  if (action.kind === "journal-search") {
    const today = localDay(now);
    app.navigate(routes.journal, {
      entryDay:
        action.when === "today"
          ? today
          : action.when === "yesterday"
            ? addHabitDays(today, -1)
            : undefined,
      entryTitle: action.title,
    });
    return;
  }
  const activity = companionPractice(action);
  if (!activity) throw new Error("This practice could not be opened.");
  const originCheckinId = app.params?.originCheckinId;
  app.navigate(routes.momentPlayer, {
    activity,
    source: "chat",
    provider: "offline",
    ...(isRecordId(conversationId) ? { conversationId } : {}),
    ...(isRecordId(originCheckinId) ? { originCheckinId } : {}),
    originActionId: action.id,
    startOnArrival: true,
  });
}

type Recurrence = Extract<AppAction, { kind: "reminder-create" }>["repeat"];
export const repeatLabel: Record<Recurrence, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekends: "Weekends",
  custom: "Selected days",
};
const repeatDays: Record<Exclude<Recurrence, "custom">, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
};

export function daysForAction(recurrence: Recurrence, days?: string) {
  return recurrence === "custom"
    ? days!.split(",").map(Number)
    : repeatDays[recurrence];
}

export function actionScheduleLabel(recurrence: Recurrence, days?: string) {
  return recurrence === "custom"
    ? daysForAction(recurrence, days)
        .map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day])
        .join(", ")
    : repeatLabel[recurrence];
}

export function habitScheduleFromAction(
  recurrence: Recurrence,
  days?: string,
): ReturnType<typeof habitFromAction>["schedule"] {
  return recurrence === "daily"
    ? { type: "daily" }
    : { type: "weekdays", days: daysForAction(recurrence, days) };
}

export function reminderFromAction(
  action: Extract<AppAction, { kind: "reminder-create" }>,
): ReminderInput {
  const [hour, minute] = action.time.split(":").map(Number);
  return {
    type: action.type ?? "custom",
    title: action.title,
    hour,
    minute,
    days: daysForAction(action.repeat, action.days),
    enabled: true,
  };
}

export function habitFromAction(
  action: Extract<AppAction, { kind: "habit-create" }>,
): Parameters<AppState["createHabit"]>[0] {
  return {
    name: action.name,
    category: "self-care",
    color: "lavender",
    icon: "leaf",
    goal:
      action.goalType === "quantity"
        ? { type: "quantity", target: action.target!, unit: action.unit! }
        : action.goalType === "duration"
          ? { type: "duration", target: action.target! }
          : { type: "completion" },
    schedule: habitScheduleFromAction(action.schedule, action.days),
    reminderTime: action.reminderTime ?? null,
  };
}

type HabitData = Pick<AppState["data"], "habits" | "habitProgress">;

export function normalizeActionName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

export function matchingCompanionHabits(
  data: HabitData,
  name: string,
  includeInactive = false,
) {
  const needle = normalizeActionName(name);
  return data.habits.filter(
    (habit) =>
      (includeInactive || habit.status === "active") &&
      normalizeActionName(habit.name) === needle,
  );
}

export function habitCompletion(data: HabitData, id: string, now = new Date()) {
  const habit = data.habits.find(
    (item) => item.id === id && item.status === "active",
  );
  if (!habit)
    throw new Error(
      "This habit is no longer available. Your progress is unchanged.",
    );
  const day = habitDay(habit.timeZone, now);
  const revision = habitRevisionOn(habit, day);
  if (!revision || !isHabitScheduled(habit, day))
    throw new Error(
      "This habit can’t be logged today. Your progress is unchanged.",
    );
  const progress = data.habitProgress.find(
    (record) => record.habitId === id && record.day === day,
  );
  return {
    name: habit.name,
    goal: revision.goal,
    complete: progress?.complete === true,
    write: {
      day,
      amount: habitTarget(revision.goal),
      expectedRevision: progress?.revision ?? 0,
    },
  };
}

export function habitCompletionSummary(
  data: HabitData,
  period: "week" | "month",
  now = new Date(),
) {
  const today = localDay(now);
  const start =
    period === "week" ? habitWeekStart(today) : `${today.slice(0, 7)}-01`;
  return habitInsights(
    data.habits,
    data.habitProgress,
    start,
    today,
    today,
    now,
  ).completedActions;
}

export function journeyActionSummary(
  data: AppState["data"],
  action: Extract<AppAction, { kind: "journey-summary" }>,
  now = new Date(),
) {
  if (action.metric === "garden") {
    const garden = data.habitGarden[0];
    return garden
      ? `Your garden is at the ${garden.stage} stage with ${garden.earnedTotal} earned growth ${garden.earnedTotal === 1 ? "credit" : "credits"}.`
      : "There’s no recorded garden growth yet.";
  }
  const today = localDay(now);
  const yesterday = addHabitDays(today, -1);
  const start =
    action.period === "week"
      ? addHabitDays(today, -6)
      : action.period === "month"
        ? `${today.slice(0, 7)}-01`
        : action.period === "yesterday"
          ? yesterday
          : "";
  const end = action.period === "yesterday" ? yesterday : today;
  const period = {
    week: "in the last 7 days",
    month: "this month",
    all: "so far",
    yesterday: "yesterday",
  }[action.period];
  const inside = (record: Record<string, unknown>) => {
    const day = recordDay(record);
    return !!day && day >= start && day <= end;
  };
  const { sessions, checkins, assessments } = journeyRecords(data, now);
  if (action.metric === "mood") {
    const count = checkins.filter(inside).length;
    return `You saved ${count} mood ${count === 1 ? "check-in" : "check-ins"} ${period}.`;
  }
  const completed = sessions.filter(
    (session) => inside(session) && session.completed === true,
  );
  if (action.metric === "mindful-time") {
    const minutes = Math.floor(
      completed.reduce((sum, session) => sum + activeSeconds(session), 0) / 60,
    );
    return `You recorded ${minutes} mindful ${minutes === 1 ? "minute" : "minutes"} ${period}.`;
  }
  const activityCount = completed.length + assessments.filter(inside).length;
  const checkinCount = checkins.filter(inside).length;
  return `You recorded ${activityCount} completed ${activityCount === 1 ? "activity" : "activities"} and ${checkinCount} mood ${checkinCount === 1 ? "check-in" : "check-ins"} ${period}.`;
}
