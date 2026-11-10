import {
  getTimedPractice,
  timedPracticeFocuses,
  type TimedPracticeFocus,
} from "./timed-practice-contract.ts";

export const planFocuses = timedPracticeFocuses;
export const planMinutes = [5, 10, 15] as const;
export type PlanFocus = TimedPracticeFocus;
export type PlanMinutes = (typeof planMinutes)[number];

export type PlanTask = {
  id: string;
  title: string;
  description?: string;
  action?: string;
  completed?: boolean;
  focus?: PlanFocus;
  minutes?: PlanMinutes;
};

export type WellnessPlan = {
  id?: string;
  type: "wellness";
  title: string;
  tasks: PlanTask[];
  programId?: string;
  goal?: PlanFocus;
  preferredFocuses?: PlanFocus[];
  dailyMinutes?: PlanMinutes;
  startedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  completed?: boolean;
};

type GuidedProgram = {
  id: string;
  title: string;
  description: string;
  tasks: PlanTask[];
};

const focusOrder: Record<PlanFocus, readonly PlanFocus[]> = {
  calm: ["calm", "focus", "sleep", "energy"],
  focus: ["focus", "energy", "calm", "sleep"],
  sleep: ["sleep", "calm", "focus", "energy"],
  energy: ["energy", "focus", "calm", "sleep"],
};

function timedTask(
  focus: PlanFocus,
  minutes: PlanMinutes,
  index: number,
): PlanTask {
  const { title, description } = getTimedPractice(focus, minutes);
  return { id: `day-${index + 1}`, title, description, focus, minutes };
}

export function buildWellnessTasks(
  goal: PlanFocus,
  preferredFocuses: readonly PlanFocus[],
  dailyMinutes: PlanMinutes,
): PlanTask[] {
  const ordered = preferredFocuses.length
    ? focusOrder[goal].filter((focus) => preferredFocuses.includes(focus))
    : focusOrder[goal];
  return Array.from({ length: 3 }, (_, index) =>
    timedTask(ordered[index % ordered.length] ?? goal, dailyMinutes, index),
  );
}

function program(
  id: string,
  title: string,
  description: string,
  days: readonly (readonly [PlanFocus, PlanMinutes])[],
): GuidedProgram {
  return {
    id,
    title,
    description,
    tasks: days.map(([focus, minutes], index) =>
      timedTask(focus, minutes, index),
    ),
  };
}

export const guidedPrograms: readonly GuidedProgram[] = [
  program(
    "better-sleep",
    "Better Sleep",
    "Give your evening a softer landing with quiet attention and gentle breathing.",
    [
      ["sleep", 5],
      ["calm", 5],
      ["sleep", 10],
    ],
  ),
  program(
    "stress-relief",
    "Stress Relief",
    "Make space to pause, notice your surroundings, and find an easy breathing rhythm.",
    [
      ["calm", 5],
      ["focus", 5],
      ["calm", 10],
    ],
  ),
  program(
    "mindful-mornings",
    "Mindful Mornings",
    "Begin the day with a few comfortable movements, a quiet breath, and a clear next step.",
    [
      ["energy", 5],
      ["calm", 5],
      ["focus", 5],
      ["energy", 10],
    ],
  ),
  program(
    "building-focus",
    "Building Focus",
    "Return to a steady point of attention and make room for one thing at a time.",
    [
      ["focus", 5],
      ["energy", 5],
      ["focus", 10],
    ],
  ),
];

export function getGuidedProgram(id: unknown) {
  return guidedPrograms.find((entry) => entry.id === id);
}

export function planTaskActivity(task: Pick<PlanTask, "focus" | "minutes">) {
  if (planMinutes.some((minutes) => minutes === task.minutes))
    return getTimedPractice(task.focus, task.minutes);
}

type PlanSession = Record<string, unknown>;

export function isWellnessTaskComplete(
  plan: WellnessPlan,
  task: PlanTask,
  sessions: readonly PlanSession[],
): boolean {
  if (!planTaskActivity(task)) return task.completed === true;
  return (
    !!plan.id &&
    sessions.some(
      (session) =>
        session.completed === true &&
        session.planId === plan.id &&
        session.planTaskId === task.id,
    )
  );
}

export function wellnessPlanProgress(
  plan: WellnessPlan,
  sessions: readonly PlanSession[],
) {
  const total = plan.tasks.length;
  const completed = plan.tasks.filter((task) =>
    isWellnessTaskComplete(plan, task, sessions),
  ).length;
  return { completed, total, done: total > 0 && completed === total };
}
