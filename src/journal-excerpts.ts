import { MAX_JOURNAL_EXCERPT } from "../server/src/journal-contract";

export function journalExcerpts(text: string) {
  const sections: { start: number; end: number }[] = [];
  const boundaries = [...text.matchAll(/\r?\n[ \t]*\r?\n/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  boundaries.push({ start: text.length, end: text.length });
  let start = 0;
  for (const boundary of boundaries) {
    while (start < boundary.start) {
      let end = Math.min(start + MAX_JOURNAL_EXCERPT, boundary.start);
      if (end < boundary.start) {
        const space = text.lastIndexOf(" ", end - 1);
        if (space > start + MAX_JOURNAL_EXCERPT / 2) end = space + 1;
        else if (/[\uDC00-\uDFFF]/u.test(text[end])) end -= 1;
      }
      if (text.slice(start, end).trim()) sections.push({ start, end });
      start = end;
    }
    start = boundary.end;
  }
  return sections;
}
