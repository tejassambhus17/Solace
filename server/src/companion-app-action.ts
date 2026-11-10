export const appActionCapabilityHeader = "X-Solace-App-Actions";
export const appActionCapabilityVersion = "2";
export const practiceHandoffHeader = "X-Solace-Practice-Handoff";

export const appActionDestinations = [
  "today",
  "solace",
  "companion",
  "conversation-history",
  "journal",
  "journal-editor",
  "explore",
  "wellness-tools",
  "ambient-mixer",
  "wellness-toolkit",
  "guided-techniques",
  "guided-programs",
  "wellness-plan",
  "timed-practice",
  "habits",
  "habit-insights",
  "habit-garden",
  "habit-reminders",
  "journey",
  "profile",
  "appearance",
  "wellness-goals",
  "reminders",
  "memory",
  "support",
  "checkin",
  "moments",
  "daily-pause",
  "habit-library",
  "resources",
  "sleep-guide",
  "grounding",
  "affirmations",
  "saved-affirmations",
  "daily-challenge",
  "reflective-checkins",
  "journey-activity",
  "milestones",
  "personal-goal",
  "account",
  "privacy",
  "about",
] as const;

const themes = ["light", "dark", "system"] as const;
const schedules = ["daily", "weekdays", "weekends", "custom"] as const;
const practices = ["breathing", "grounding", "wind-down", "focus"] as const;
const practiceMinutes = [1, 3, 5, 10, 15, 20] as const;
const habitPeriods = ["week", "month"] as const;
const progressPeriods = [...habitPeriods, "all"] as const;
const journalDays = ["today", "yesterday"] as const;

const choice = <const T extends readonly (string | number)[]>(choices: T) => ({
  type: typeof choices[0] === "number" ? "integer" : "string",
  enum: choices,
});
const boundedText = { type: "string" } as const;
const targetNumber = { type: "integer" } as const;
const appActionFields = {
  navigate: { destination: choice(appActionDestinations) },
  theme: { mode: choice(themes) },
  "habit-create": { name: boundedText, schedule: choice(schedules) },
  "habit-complete": { name: boundedText },
  "habit-undo": { name: boundedText },
  "habit-open": { name: boundedText },
  "habit-list": {},
  "habit-update": { name: boundedText },
  "habit-archive": { name: boundedText },
  "reminder-create": {
    title: boundedText,
    time: boundedText,
    repeat: choice(schedules),
  },
  "reminder-disable": { title: boundedText },
  "practice-start": {
    practice: choice(practices),
    minutes: choice(practiceMinutes),
  },
  progress: { period: choice(progressPeriods) },
  "habit-progress": { period: choice(habitPeriods) },
  "journey-summary": {
    metric: choice(["mindful-time", "activities", "mood", "garden"]),
    period: choice([...progressPeriods, "yesterday"]),
  },
  "journal-search": {},
  cancel: {},
  confirm: { targetId: boundedText },
} as const;

const optionalFields = {
  "habit-create": {
    days: boundedText,
    goalType: choice(["duration", "quantity"]),
    target: targetNumber,
    unit: boundedText,
    reminderTime: boundedText,
  },
  "habit-update": {
    newName: boundedText,
    schedule: choice(schedules),
    days: boundedText,
  },
  "reminder-create": {
    days: boundedText,
    type: choice(["custom", "checkin", "affirmation", "breathing", "selfcare"]),
  },
  "journal-search": { when: choice(journalDays), title: boundedText },
} as const;

type AppActionKind = keyof typeof appActionFields;
type ActionFields<K extends AppActionKind> = (typeof appActionFields)[K];
type OptionalFields<K> = K extends keyof typeof optionalFields
  ? (typeof optionalFields)[K]
  : Record<never, never>;
type FieldValue<F> = F extends { enum: readonly (infer V)[] }
  ? V
  : F extends { type: "integer" }
    ? number
    : string;
export type AppAction = {
  [K in AppActionKind]: { id: string; kind: K } & {
    [P in keyof ActionFields<K>]: FieldValue<ActionFields<K>[P]>;
  } & {
    [P in keyof OptionalFields<K>]?: FieldValue<OptionalFields<K>[P]>;
  };
}[AppActionKind];

export const appActionSchema = {
  anyOf: Object.entries(appActionFields)
    .filter(([kind]) => kind !== "confirm")
    .map(([kind, fields]) => ({
      type: "object",
      properties: { kind: choice([kind]), ...fields, ...optionsFor(kind) },
      required: ["kind", ...Object.keys(fields)],
      additionalProperties: false,
    })),
};

function optionsFor(kind: string) {
  return Object.hasOwn(optionalFields, kind)
    ? optionalFields[kind as keyof typeof optionalFields]
    : {};
}

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function legacyAppAction(action: AppAction) {
  switch (action.kind) {
    case "navigate":
      return (
        action.destination !== "habit-reminders" &&
        action.destination !== "wellness-goals"
      );
    case "theme":
    case "habit-complete":
    case "habit-progress":
    case "progress":
    case "cancel":
      return true;
    case "habit-create":
      return action.schedule !== "custom" && Object.keys(action).length === 4;
    case "reminder-create":
      return action.repeat !== "custom" && Object.keys(action).length === 5;
    case "practice-start":
      return (
        action.practice !== "focus" &&
        action.minutes !== 1 &&
        action.minutes !== 3
      );
    case "journal-search":
      return !!action.when && !action.title;
    default:
      return false;
  }
}

export function readAppAction(value: unknown): AppAction | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return;
  const input = value as Record<string, unknown>;
  const { kind, id } = input;
  if (typeof id !== "string" || !idPattern.test(id)) return;
  if (typeof kind !== "string" || !Object.hasOwn(appActionFields, kind)) return;
  const required = appActionFields[kind as AppActionKind];
  const fields: Record<
    string,
    typeof boundedText | typeof targetNumber | ReturnType<typeof choice>
  > = { ...required, ...optionsFor(kind) };
  if (
    Object.keys(input).some(
      (key) => key !== "kind" && key !== "id" && !Object.hasOwn(fields, key),
    )
  )
    return;
  const parsed: Record<string, unknown> = { kind, id };
  for (const [key, field] of Object.entries(fields)) {
    const entry = input[key];
    if (entry === undefined && !Object.hasOwn(required, key)) continue;
    if ("enum" in field) {
      if (!(field.enum as readonly unknown[]).includes(entry)) return;
      parsed[key] = entry;
    } else if (field.type === "integer") {
      if (
        typeof entry !== "number" ||
        !Number.isInteger(entry) ||
        entry < 1 ||
        entry > 1000
      )
        return;
      parsed[key] = entry;
    } else {
      if (typeof entry !== "string" || /[\u0000-\u001f\u007f]/.test(entry))
        return;
      const clean = entry.trim();
      if (
        key === "time" || key === "reminderTime"
          ? !timePattern.test(clean)
          : !clean || clean.length > (key === "unit" ? 28 : 80)
      )
        return;
      parsed[key] = clean;
    }
  }
  const action = parsed as AppAction;
  if (action.kind === "confirm" && !idPattern.test(action.targetId)) return;
  if (
    action.kind === "practice-start" &&
    (action.minutes === 1 || action.minutes === 3) &&
    action.practice !== "breathing"
  )
    return;
  if (action.kind === "journal-search" && !action.when && !action.title) return;
  if (action.kind === "habit-update" && !action.newName && !action.schedule)
    return;
  if (
    action.kind === "habit-create" ||
    action.kind === "habit-update" ||
    action.kind === "reminder-create"
  ) {
    const schedule =
      action.kind === "reminder-create" ? action.repeat : action.schedule;
    if (schedule === "custom") {
      if (!action.days || !/^[0-6](?:,[0-6]){0,6}$/.test(action.days)) return;
      const days = action.days.split(",");
      if (days.length !== new Set(days).size) return;
    } else if (action.days) return;
  }
  if (action.kind === "habit-create") {
    if (
      action.goalType === "duration" &&
      (!action.target || action.target > 720 || action.unit)
    )
      return;
    if (action.goalType === "quantity" && (!action.target || !action.unit))
      return;
    if (!action.goalType && (action.target || action.unit)) return;
  }
  return action;
}
