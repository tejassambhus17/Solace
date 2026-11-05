import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentSummary,
  localDay,
  participationProgress,
  recordDay,
  todayAffirmation,
} from "../src/content.ts";

test("a stored local day never also becomes its earlier UTC date", () => {
  const record = { day: "2026-11-05", createdAt: "2026-11-04T20:15:00.000Z" };
  assert.equal(recordDay(record), "2026-11-05");
  const result = participationProgress(
    { checkins: [record] },
    new Date(2026, 10, 5, 12),
  );
  assert.equal(result.checkedDays, 1);
  assert.equal(result.streak, 1);
  assert.equal(result.xp, 10);
});

test("repeat check-ins count as entries without inflating day XP or streak", () => {
  const records = [5, 5, 4, 3].map((day) => ({
    day: `2026-11-0${day}`,
    createdAt: `2026-11-0${day}T10:00:00Z`,
  }));
  const result = participationProgress(
    { checkins: records },
    new Date(2026, 10, 5, 12),
  );
  assert.equal(result.checkinsThisWeek, 4);
  assert.equal(result.checkedDays, 3);
  assert.equal(result.streak, 3);
  assert.equal(result.xp, 30);
});

test("streak may end yesterday, breaks on a missing day, and ignores future records", () => {
  const records = [6, 4, 3, 1].map((day) => ({
    day: `2026-11-0${day}`,
    createdAt: `2026-11-0${day}T10:00:00Z`,
  }));
  const result = participationProgress(
    { checkins: records },
    new Date(2026, 10, 5, 12),
  );
  assert.equal(result.streak, 2);
  assert.equal(result.checkedDays, 3);
});

test("partial or unconfirmed sessions cannot earn completion counts or XP", () => {
  const at = "2026-11-05T08:00:00Z";
  const result = participationProgress(
    {
      sessions: [
        { completed: false, duration: 59, createdAt: at },
        { duration: 60, createdAt: at },
        { completed: true, duration: 60, createdAt: at },
      ],
      reflections: [{ createdAt: at }],
      assessments: [{ createdAt: at }],
    },
    new Date(2026, 10, 5, 12),
  );
  assert.equal(result.completedMoments, 1);
  assert.equal(result.xp, 40);
  assert.equal(result.level, 1);
  assert.equal(result.xpToNextLevel, 60);
});

test("month boundaries preserve calendar-day streaks", () => {
  const result = participationProgress(
    {
      checkins: [
        { day: "2026-11-01" },
        { day: "2026-10-31" },
        { day: "2026-10-30" },
      ],
    },
    new Date(2026, 10, 1, 12),
  );
  assert.equal(result.streak, 3);
});

test("reflection types preserve totals and provide non-diagnostic next steps", () => {
  for (const id of ["mood", "anxiety", "self-love"]) {
    assert.equal(assessmentSummary(id, [0, 0, 0, 0]).score, 0);
    const result = assessmentSummary(id, [3, 3, 3, 3]);
    assert.equal(result.score, 12);
    assert.ok(result.title.length > 0 && result.text.length > 0);
    assert.doesNotMatch(
      result.text,
      /you have (depression|an anxiety disorder)|diagnosed/i,
    );
  }
});

test("a daily affirmation remains stable within a device calendar day", () => {
  const early = new Date(2026, 10, 5, 0, 1);
  const late = new Date(2026, 10, 5, 23, 59);
  assert.equal(localDay(early), "2026-11-05");
  assert.equal(todayAffirmation(early), todayAffirmation(late));
});
