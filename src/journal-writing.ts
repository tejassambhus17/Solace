const wordSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : undefined;

export function countJournalWords(text: string) {
  if (!wordSegmenter)
    return (
      text.match(
        /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu,
      )?.length ?? 0
    );
  let count = 0;
  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike) count++;
  }
  return count;
}

export function toggleJournalBullet(
  text: string,
  selection: { start: number; end: number },
) {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const lineStart = start ? text.lastIndexOf("\n", start - 1) + 1 : 0;
  const hasBullet = text.startsWith("• ", lineStart);
  const shift = hasBullet ? -2 : 2;
  return {
    text:
      text.slice(0, lineStart) +
      (hasBullet ? "" : "• ") +
      text.slice(lineStart + (hasBullet ? 2 : 0)),
    selection: {
      start: Math.max(lineStart, start + shift),
      end: Math.max(lineStart, end + shift),
    },
  };
}
