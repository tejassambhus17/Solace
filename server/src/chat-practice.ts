export const chatPracticeIds = [
  "breathing",
  "grounding",
  "reflection",
  "wind-down",
  "focus",
  "gratitude",
] as const;

export type ChatPracticeId = (typeof chatPracticeIds)[number];
export type ChatAction = { type: ChatPracticeId; label: string };

export const chatPractices = {
  breathing: { title: "A little breathing room", icon: "leaf-outline" },
  grounding: { title: "Come back to the room", icon: "hand-left-outline" },
  reflection: { title: "Room for one thought", icon: "pencil-outline" },
  "wind-down": { title: "A quieter pace", icon: "moon-outline" },
  focus: { title: "One thing at a time", icon: "locate-outline" },
  gratitude: { title: "Notice something good", icon: "heart-outline" },
} satisfies Record<ChatPracticeId, { title: string; icon: string }>;

export function isChatPracticeId(value: unknown): value is ChatPracticeId {
  return typeof value === "string" && Object.hasOwn(chatPractices, value);
}
