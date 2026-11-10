import { localDay, recordDay } from "./content";
import { isJournalRecord } from "./journal-record";
import type { Item } from "./store";

export function journalCalendarDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(0);
  result.setHours(12, 0, 0, 0);
  result.setFullYear(year, month - 1, date);
  return result;
}

export function journalCalendarMonth(date: Date, offset = 0) {
  const first = new Date(date);
  first.setDate(1);
  first.setMonth(first.getMonth() + offset);
  return first;
}

export function journalCalendarDays(month: Date) {
  const first = journalCalendarMonth(month);
  const length = new Date(journalCalendarMonth(first, 1).setDate(0)).getDate();
  const start = first.getDay();
  const cells = Math.ceil((start + length) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const date = index - start + 1;
    if (date < 1 || date > length) return null;
    const day = new Date(first);
    day.setDate(date);
    return localDay(day);
  });
}

export function savedJournalByDay(records: readonly Item[]) {
  const entries = new Map<string, Item[]>();
  for (const record of records) {
    if (record.localOnly || !isJournalRecord(record)) continue;
    const day = recordDay(record);
    if (!day) continue;
    const list = entries.get(day);
    if (list) list.push(record);
    else entries.set(day, [record]);
  }
  return entries;
}
