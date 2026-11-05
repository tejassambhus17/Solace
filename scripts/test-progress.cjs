const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("require", "module", "exports", source)(
    (name) => {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const content = load("src/content.ts");
const {
  adjacentCalendarDay,
  journeySummary,
  calendarMonth,
  entriesOnDay,
  goalProgress,
} = load("src/progress.ts", { "./content": content });
const now = () => new Date(2026, 10, 5, 12);
const item = (id, day, extra = {}) => ({ id, day, ...extra });

test("a new journey has no earned milestone, mood, duration or streak", () => {
  const summary = journeySummary({}, now());
  assert.equal(summary.completedCount, 0);
  assert.equal(summary.minutes, 0);
  assert.equal(summary.streak, 0);
  assert.equal(
    summary.milestones.some((m) => m.earned),
    false,
  );
  assert.equal(
    calendarMonth(2026, 10, {}, now()).filter((day) => day?.mood).length,
    0,
  );
});

test("changing months keeps selection in the visible month and never moves into the future", () => {
  assert.equal(adjacentCalendarDay("2026-11-05", -1, now()), "2026-10-01");
  assert.equal(adjacentCalendarDay("2026-10-31", 1, now()), "2026-11-05");
  assert.equal(adjacentCalendarDay("2026-11-01", 1, now()), null);
  assert.equal(adjacentCalendarDay("1900-02-01", -1, now()), "1900-01-01");
  assert.equal(adjacentCalendarDay("1900-01-01", -1, now()), null);
  assert.equal(adjacentCalendarDay("2026-01-31", -1, now()), "2025-12-01");
});

test("actual completed duration and self-reported feedback exclude partial/future/duplicate records", () => {
  const data = {
    sessions: [
      item("a", "2026-11-05", {
        completed: true,
        durationSec: 45,
        feedback: "Helped",
      }),
      item("a", "2026-11-05", {
        completed: true,
        durationSec: 45,
        feedback: "Helped",
      }),
      item("b", "2026-11-04", {
        completed: true,
        durationSeconds: 45,
        feedback: "Not for me",
      }),
      item("c", "2026-11-04", {
        completed: false,
        durationSec: 120,
        feedback: "A little",
      }),
      item("future", "2026-11-06", { completed: true, durationSec: 300 }),
      item("future-time", "2026-11-05", {
        createdAt: "2026-11-05T23:59:59Z",
        completed: true,
        durationSec: 300,
      }),
    ],
  };
  const summary = journeySummary(data, now());
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.minutes, 1);
  assert.equal(summary.helpfulCount, 1);
  assert.equal(summary.ratedCount, 2);
  assert.equal(summary.weeklySeconds, 90);
});

test("weekly time uses seven local calendar days and never counts unsupported duration fields", () => {
  const summary = journeySummary(
    {
      sessions: [
        item("old", "2026-10-29", { completed: true, durationSec: 60 }),
        item("boundary", "2026-10-30", { completed: true, durationSec: 60 }),
        item("invalid", "2026-11-05", {
          completed: true,
          durationSec: Infinity,
        }),
        item("negative", "2026-11-05", { completed: true, durationSec: -300 }),
        item("excessive", "2026-11-05", {
          completed: true,
          durationSec: 100000,
        }),
      ],
    },
    now(),
  );
  assert.equal(summary.minutes, 2);
  assert.equal(summary.weeklyMinutes, 1);
  assert.equal(summary.startDay, "2026-10-30");
});

test("check-in achievements count distinct saved days and streaks tolerate an unfinished today", () => {
  const checkins = Array.from({ length: 7 }, (_, index) =>
    item(`c${index}`, `2026-10-${String(29 + index).padStart(2, "0")}`),
  );
  // Use real dates across the month boundary.
  checkins.splice(
    3,
    4,
    ...["01", "02", "03", "04"].map((day) => item(`n${day}`, `2026-11-${day}`)),
  );
  checkins.push(item("same-day", "2026-11-04"));
  const summary = journeySummary({ checkins }, now());
  assert.equal(summary.checkinDays, 7);
  assert.equal(summary.streak, 7);
  assert.equal(
    summary.milestones.find((m) => m.id === "seven-checkins").earned,
    true,
  );
});

test("calendar is Monday-first, includes leap day and exposes latest actual mood without future data", () => {
  const futureNow = new Date(2028, 1, 29, 12);
  const days = calendarMonth(
    2028,
    1,
    {
      checkins: [
        item("early", "2028-02-29", {
          mood: "Low",
          createdAt: new Date(2028, 1, 29, 8).toISOString(),
        }),
        item("late", "2028-02-29", {
          mood: "Calm",
          createdAt: new Date(2028, 1, 29, 9).toISOString(),
        }),
      ],
    },
    futureNow,
  );
  assert.equal(days[0], null);
  assert.equal(days[1].day, 1);
  assert.equal(days.filter(Boolean).length, 29);
  assert.equal(days.find((day) => day?.day === 29).mood, "Calm");
  assert.equal(days.find((day) => day?.day === 29).count, 2);
});

test("selected-day history includes actual incomplete practice, reflection and assessment entries", () => {
  const entries = entriesOnDay(
    {
      checkins: [item("c", "2026-11-04", { mood: "Okay" })],
      sessions: [item("s", "2026-11-05", { completed: false })],
      reflections: [item("r", "2026-11-05", { text: "A real saved thought" })],
      assessments: [item("a", "2026-11-05", { assessmentType: "mood" })],
    },
    "2026-11-05",
    now(),
  );
  assert.deepEqual(
    new Set(entries.map((entry) => entry.collection)),
    new Set(["sessions", "reflections", "assessments"]),
  );
  assert.equal(
    entries.find((entry) => entry.collection === "sessions").record.completed,
    false,
  );
  assert.equal(
    journeySummary(
      {
        sessions: entries
          .filter((entry) => entry.collection === "sessions")
          .map((entry) => entry.record),
      },
      now(),
    ).completedCount,
    0,
  );
});

test("goal progress uses active seconds without rounding an unfinished goal into completion", () => {
  assert.deepEqual(goalProgress(5, 299), {
    target: 5,
    fraction: 299 / 300,
    reached: false,
  });
  assert.deepEqual(goalProgress(5, 600), {
    target: 5,
    fraction: 1,
    reached: true,
  });
  assert.deepEqual(goalProgress(0, -10), {
    target: 15,
    fraction: 0,
    reached: false,
  });
});

test("invalid clocks/months fail clearly and progress never mutates account data", () => {
  assert.throws(() => journeySummary({}, new Date("bad")), RangeError);
  assert.throws(() => calendarMonth(2026, 12, {}, now()), RangeError);
  const data = Object.freeze({
    sessions: Object.freeze([
      Object.freeze(
        item("s", "2026-11-05", { completed: true, durationSec: 60 }),
      ),
    ]),
  });
  assert.equal(journeySummary(data, now()).minutes, 1);
  assert.equal(data.sessions.length, 1);
});

test("unsynced device writing stays visible in daily history but cannot earn account milestones", () => {
  const data = {
    checkins: [
      item("pending", "2026-11-05", { localOnly: true, mood: "Calm" }),
    ],
    reflections: [
      item("reflection", "2026-11-05", {
        localOnly: true,
        text: "Still waiting to sync",
      }),
    ],
  };
  assert.equal(journeySummary(data, now()).checkinDays, 0);
  assert.equal(journeySummary(data, now()).reflectionCount, 0);
  assert.equal(
    calendarMonth(2026, 10, data, now()).find((day) => day?.day === 5).count,
    0,
  );
  assert.equal(entriesOnDay(data, "2026-11-05", now()).length, 2);
});
