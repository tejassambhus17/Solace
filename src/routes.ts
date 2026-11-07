export const routes = {
  today: "today",
  solace: "solace",
  companion: "chat",
  history: "history",
  voice: "voice-talk",
  journal: "journal",
  journalEditor: "journal-editor",
  journalEntry: "journal-entry",
  journalReflect: "journal-reflect",
  explore: "explore",
  exploreCatalog: "explore-catalog",
  wellnessTools: "wellness-tools",
  timedPractice: "timed-practice",
  techniques: "techniques",
  technique: "technique-detail",
  habits: "habits",
  habitCreate: "habit-create",
  habitLibrary: "habit-library",
  habitDetails: "habit-details",
  habitEdit: "habit-edit",
  habitInsights: "habit-insights",
  habitGarden: "habit-garden",
  habitReminders: "habit-reminders",
  momentPlayer: "moment-player",
  breathing: "breathing",
  journey: "journey",
  journeyCheckin: "journey-checkin",
  sessionDetail: "session-detail",
  reflectionDetail: "reflection-detail",
  profile: "profile",
  onboarding: "onboarding-replay",
  memory: "memory",
  support: "support",
} as const;

export const habitRoutes = new Set<string>([
  routes.habits,
  routes.habitCreate,
  routes.habitLibrary,
  routes.habitDetails,
  routes.habitEdit,
  routes.habitInsights,
  routes.habitGarden,
  routes.habitReminders,
]);

export type SolaceMode = "companion" | "journal";

export const solaceRoots = {
  companion: routes.companion,
  journal: routes.journal,
} as const;

export const journalRoutes = new Set<string>([
  routes.journal,
  routes.journalEditor,
  routes.journalEntry,
  routes.journalReflect,
]);

export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

export const savedReflectionRoute = (record: { kind?: unknown }) =>
  record.kind === "journal" ? routes.journalEntry : routes.reflectionDetail;
