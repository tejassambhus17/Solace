import type { Item } from "./store";

export const journalWriting = (record?: Item) =>
  [record?.text, record?.content, record?.note].find(
    (value): value is string => typeof value === "string" && !!value.trim(),
  ) ?? "";

export const isJournalRecord = (record: Item) =>
  !!record.id &&
  !record.weeklyPeriod &&
  (record.kind === "journal" ||
    (record.kind === undefined && !!journalWriting(record)));
