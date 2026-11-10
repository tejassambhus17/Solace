export const MAX_JOURNAL_EXCERPT = 1200;
export const MAX_JOURNAL_TAGS = 30;
export const MAX_JOURNAL_TAG_LENGTH = 80;

export function journalTagsFromText(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function journalTagLimitMessage(tags: readonly string[]) {
  if (tags.length > MAX_JOURNAL_TAGS)
    return `Use up to ${MAX_JOURNAL_TAGS} tags. Remove ${tags.length - MAX_JOURNAL_TAGS} to save this entry.`;
  if (tags.some((tag) => tag.length > MAX_JOURNAL_TAG_LENGTH))
    return `Shorten any highlighted tag to ${MAX_JOURNAL_TAG_LENGTH} characters or fewer.`;
  return "";
}

export const journalActions = [
  "reflect",
  "understand",
  "question",
  "grounding",
] as const;

export type JournalAction = (typeof journalActions)[number];
export type JournalSelection = { start: number; end: number; revision: string };
export type JournalSource = JournalSelection & { id: string };
export type JournalReflectionResult =
  | { provider: "live"; reflection: string; practice?: "grounding" }
  | { provider: "offline"; support: true; reflection: string };

export function journalShareableText(record: Record<string, unknown>) {
  if (record.weeklyPeriod || (record.kind && record.kind !== "journal"))
    return "";
  const body = record.text ?? record.content ?? record.note;
  return typeof body === "string" ? body : "";
}

export function journalRevision(record: Record<string, unknown>) {
  return typeof record.updatedAt === "string"
    ? record.updatedAt
    : typeof record.createdAt === "string"
      ? record.createdAt
      : "";
}
