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
  wellnessPlan: "plan",
  guidedPrograms: "guided-programs",
  guidedProgram: "guided-program",
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
  practiceInsights: "practice-insights",
  journeyCheckin: "journey-checkin",
  sessionDetail: "session-detail",
  reflectionDetail: "reflection-detail",
  profile: "profile",
  ambientSoundPreferences: "ambient-sound-preferences",
  onboarding: "onboarding-replay",
  wellnessGoals: "wellness-goals",
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

export const habitSections = [
  "today",
  "my-habits",
  "insights",
  "garden",
] as const;
export type HabitSection = (typeof habitSections)[number];

export function habitSection(value: unknown): HabitSection {
  return habitSections.find((section) => section === value) ?? "today";
}

export function habitHubParams(name: string, params: Record<string, unknown>) {
  if (name === routes.habitLibrary) return { ...params, section: "my-habits" };
  if (name === routes.habitGarden) return { ...params, section: "garden" };
  if (name === routes.habitInsights) {
    const { id, ...range } = params;
    return {
      ...range,
      section: "insights",
      insightsHabitId: isRecordId(id) ? id : undefined,
    };
  }
  if (name === routes.habits)
    return { ...params, section: habitSection(params.section) };
}

export function isHabitDrillDown(name: string) {
  return (
    name === routes.habitCreate ||
    name === routes.habitEdit ||
    name === routes.habitDetails ||
    name === routes.habitReminders
  );
}

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
