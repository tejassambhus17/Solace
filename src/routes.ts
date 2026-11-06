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
  techniques: "techniques",
  technique: "technique-detail",
  momentPlayer: "moment-player",
  breathing: "breathing",
  journey: "journey",
  reflectionDetail: "reflection-detail",
  profile: "profile",
  memory: "memory",
  support: "support",
} as const;

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
