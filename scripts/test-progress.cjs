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
const progress = load("src/progress.ts", { "./content": content });
const {
  adjacentCalendarDay,
  journeySummary,
  calendarMonth,
  entriesOnDay,
  goalProgress,
} = progress;
const {
  adjacentJourneyDay,
  journeyAnalytics,
  journeyCalendar,
  journeyRange,
  journeyReport,
  journeyWeek,
  latestJourneyActivity,
  nextMilestoneCelebration,
} = load("src/journey-analytics.ts", {
  "./content": content,
  "./progress": progress,
  "./routes": load("src/routes.ts"),
});
const { journeyGoalProgress } = load("src/journey-goals.ts", {
  "../server/src/goal-contract": load("server/src/goal-contract.ts"),
  "./content": content,
  "./journey-analytics": { journeyRange },
  "./progress": progress,
});
const now = () => new Date(2026, 10, 5, 12);
const item = (id, day, extra = {}) => ({ id, day, ...extra });

test("latest Journey activity opens an eligible exact record across collections", () => {
  const day = "2026-11-05";
  const time = (hour) => new Date(2026, 10, 5, hour).toISOString();
  const checkin = item("calm", day, { createdAt: time(6) });
  const journal = item("entry", day, {
    kind: "journal",
    createdAt: time(7),
    localOnly: true,
  });
  const practice = item("moment", day, { completed: true, createdAt: time(8) });
  const noise = {
    checkins: [
      item("future", "2026-11-06"),
      item("bad/id", day, { createdAt: time(9) }),
    ],
    sessions: [
      item("abandoned", day, { completed: false, createdAt: time(9) }),
      item("guide", day, {
        type: "resource",
        completed: true,
        createdAt: time(10),
      }),
    ],
    reflections: [item("weekly", day, { createdAt: time(9) })],
    assessments: [item("assessment", day, { createdAt: time(10) })],
  };
  assert.equal(
    latestJourneyActivity(journeyAnalytics(noise, now())),
    undefined,
  );
  noise.checkins.push(checkin);
  assert.equal(
    latestJourneyActivity(journeyAnalytics(noise, now())).record.id,
    "calm",
  );
  noise.reflections.push(journal);
  assert.equal(
    latestJourneyActivity(journeyAnalytics(noise, now())).record.id,
    "entry",
  );
  noise.sessions.push(practice);
  assert.equal(
    latestJourneyActivity(journeyAnalytics(noise, now())).record.id,
    "moment",
  );
});

test("milestone celebrations use saved records and survive re-reading the account marker", () => {
  const checkins = [
    item("one", "2026-11-01"),
    item("two", "2026-11-02"),
    item("three", "2026-11-03"),
  ];
  const sessions = [
    item("device-only", "2026-11-04", { completed: true, localOnly: true }),
  ];
  const data = { checkins, sessions };
  const first = nextMilestoneCelebration(
    journeyAnalytics(data, now()).milestones,
    [],
    false,
  );
  assert.equal(first.id, "first-checkin");
  assert.equal(first.earnedDay, "2026-11-01");
  const restored = JSON.parse(JSON.stringify([first.id]));
  assert.equal(
    nextMilestoneCelebration(
      journeyAnalytics(data, now()).milestones,
      restored,
      false,
    ),
    undefined,
  );
  assert.equal(
    nextMilestoneCelebration(
      journeyAnalytics(data, now()).milestones,
      restored,
      true,
    ).id,
    "three-day-streak",
  );
});

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

test("new Journey reporting has no counts, achievements or fabricated comparisons", () => {
  const analytics = journeyAnalytics({}, now());
  for (const period of ["week", "month", "all"]) {
    const report = journeyReport(analytics, period, "2026-11-05");
    assert.deepEqual(report.stats, { checkinDays: 0, moments: 0, seconds: 0 });
    assert.equal(report.comparison, null);
  }
  assert.equal(analytics.firstDay, null);
  assert.ok(
    analytics.milestones.every(
      (milestone) => !milestone.earned && !milestone.earnedDay,
    ),
  );
  assert.deepEqual(analytics.savedStory, {
    checkins: 0,
    reflections: 0,
    affirmations: 0,
    assessments: 0,
  });
});

test("calendar weeks count distinct check-in days, completed sessions and actual active time", () => {
  const analytics = journeyAnalytics(
    {
      checkins: [
        item("prior", "2026-10-26"),
        item("outside-prior-elapsed-days", "2026-10-30"),
        item("current1", "2026-11-02"),
        item("current2", "2026-11-02"),
        item("current2", "2026-11-02"),
        item("current3", "2026-11-04"),
        item("pending", "2026-11-03", { localOnly: true }),
        item("future", "2026-11-05"),
      ],
      sessions: [
        item("prior-session", "2026-10-28", {
          completed: true,
          durationSec: 40,
        }),
        item("finished", "2026-11-03", {
          completed: true,
          durationSec: 85,
          plannedDurationSec: 300,
        }),
        item("finished", "2026-11-03", { completed: true, durationSec: 85 }),
        item("abandoned", "2026-11-04", { completed: false, durationSec: 180 }),
      ],
    },
    new Date(2026, 10, 4, 12),
  );
  const week = journeyReport(analytics, "week", "2026-11-03");
  assert.equal(week.startDay, "2026-11-02");
  assert.equal(week.endDay, "2026-11-04");
  assert.deepEqual(week.stats, { checkinDays: 2, moments: 1, seconds: 85 });
  assert.deepEqual(week.previousRange, {
    startDay: "2026-10-26",
    endDay: "2026-10-28",
  });
  assert.deepEqual(week.comparison, {
    checkinDays: 1,
    moments: 0,
    seconds: 45,
  });
  const lifetime = journeyReport(analytics, "all", "2026-11-01");
  assert.deepEqual(lifetime.stats, {
    checkinDays: 4,
    moments: 2,
    seconds: 125,
  });
  assert.equal(lifetime.comparison, null);
  assert.equal(
    analytics.days
      .get("2026-11-04")
      .entries.find((entry) => entry.collection === "sessions").record
      .completed,
    false,
  );
});

test("month comparisons cover leap days and completed past months use the full prior month", () => {
  const analytics = journeyAnalytics(
    {
      checkins: [
        item("jan-last", "2028-01-31"),
        item("leap-day", "2028-02-29"),
        item("march", "2028-03-29"),
        item("future", "2028-03-31"),
      ],
    },
    new Date(2028, 2, 30, 12),
  );
  const march = journeyReport(analytics, "month", "2028-03-01");
  assert.deepEqual(march.previousRange, {
    startDay: "2028-02-01",
    endDay: "2028-02-29",
  });
  assert.equal(march.stats.checkinDays, 1);
  const february = journeyReport(analytics, "month", "2028-02-29");
  assert.deepEqual(february.previousRange, {
    startDay: "2028-01-01",
    endDay: "2028-01-31",
  });
  assert.equal(february.comparison.checkinDays, 0);
  const calendar = journeyCalendar(analytics, "month", "2028-02-01");
  assert.equal(calendar[0], null);
  assert.equal(calendar.filter(Boolean).length, 29);
  assert.equal(calendar.find((day) => day?.key === "2028-02-29").checkins, 1);
});

test("Monday-first week navigation handles year boundaries and prevents advancing past the present", () => {
  assert.deepEqual(journeyWeek("2026-01-01"), {
    startDay: "2025-12-29",
    endDay: "2026-01-04",
  });
  assert.deepEqual(journeyRange("week", "2026-01-03", "2026-01-01"), {
    startDay: "2025-12-29",
    endDay: "2026-01-01",
  });
  assert.equal(
    adjacentJourneyDay("week", "2026-01-01", -1, "2026-01-01"),
    "2025-12-22",
  );
  assert.equal(
    adjacentJourneyDay("week", "2025-12-26", 1, "2026-01-01"),
    "2026-01-01",
  );
  assert.equal(adjacentJourneyDay("week", "2026-01-01", 1, "2026-01-01"), null);
  assert.equal(
    adjacentJourneyDay("month", "2026-01-01", -1, "2026-01-01"),
    "2025-12-01",
  );
  assert.equal(
    adjacentJourneyDay("all", "2025-12-01", 1, "2026-01-01"),
    "2026-01-01",
  );
  assert.throws(() => journeyWeek("2026-02-29"), RangeError);
});

test("calendar marks saved activity types and retains pending writing only in day details", () => {
  const analytics = journeyAnalytics(
    {
      checkins: [
        item("mood", "2026-11-05"),
        item("mood", "2026-11-05", { localOnly: true }),
        item("pending", "2026-11-04", { localOnly: true }),
      ],
      sessions: [
        item("partial", "2026-11-05", { completed: false }),
        item("done", "2026-11-05", { completed: true, durationSec: 60 }),
      ],
      reflections: [item("reflection", "2026-11-05", { text: "Written" })],
      assessments: [item("assessment", "2026-11-05")],
    },
    now(),
  );
  const week = journeyCalendar(analytics, "week", "2026-11-05");
  assert.equal(week.length, 7);
  assert.equal(week[0].key, "2026-11-02");
  assert.deepEqual(week[3], {
    key: "2026-11-05",
    day: 5,
    future: false,
    checkins: 1,
    moments: 1,
    reflections: 1,
    assessments: 1,
  });
  assert.ok(week[4].future && week[4].checkins === 0);
  assert.equal(week[2].checkins, 0);
  assert.equal(
    analytics.days.get("2026-11-04").entries[0].record.localOnly,
    true,
  );
  assert.equal(analytics.days.get("2026-11-05").entries.length, 5);
});

test("milestones retain the first qualifying local day after a streak ends and require a saved weekly marker", () => {
  const checkins = [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
    "2026-11-04",
  ].map((day) => item(day, day));
  const analytics = journeyAnalytics(
    {
      checkins: [...checkins, item("duplicate-day", "2026-10-26")],
      reflections: [
        item("future-period", "2026-10-25", {
          weeklyPeriod: { start: "2026-10-26", end: "2026-11-01" },
        }),
        item("invalid-period", "2026-10-28", {
          weeklyPeriod: { start: "2026-10-26", end: "2026-10-31" },
        }),
        item("weekly-pending", "2026-10-30", {
          localOnly: true,
          weeklyPeriod: { start: "2026-10-26", end: "2026-11-01" },
        }),
        item("weekly-saved", "2026-11-04", {
          weeklyPeriod: { start: "2026-11-02", end: "2026-11-08" },
        }),
      ],
    },
    now(),
  );
  assert.deepEqual(
    analytics.milestones
      .slice(0, 4)
      .map(({ id, earnedDay }) => [id, earnedDay]),
    [
      ["first-checkin", "2026-10-26"],
      ["three-day-streak", "2026-10-28"],
      ["weekly-reflection", "2026-11-04"],
      ["seven-day-streak", "2026-11-01"],
    ],
  );
  assert.equal(
    analytics.milestones.find((entry) => entry.id === "seven-day-streak").value,
    7,
  );
});

test("saved story separates reflective assessments, daily check-ins and saved affirmations", () => {
  const analytics = journeyAnalytics(
    {
      checkins: [item("c1", "2026-11-05"), item("c2", "2026-11-05")],
      assessments: [item("a", "2026-11-05")],
      reflections: [item("r", "2026-11-04", { text: "A saved entry" })],
      plans: [
        item("affirmation", "2026-11-04", {
          type: "affirmation",
          text: "A gentle reminder",
        }),
        item("affirmation", "2026-11-04", {
          type: "affirmation",
          text: "A gentle reminder",
        }),
        item("plan", "2026-11-05", { type: "wellness", title: "A plan" }),
        item("blank", "2026-11-05", { type: "affirmation", text: " " }),
      ],
    },
    now(),
  );
  assert.deepEqual(analytics.savedStory, {
    checkins: 2,
    assessments: 1,
    reflections: 1,
    affirmations: 1,
  });
  assert.equal(
    journeyReport(analytics, "all", "2026-11-05").stats.checkinDays,
    1,
  );
});

test("completing a resource checklist is visible in history without earning a Moment", () => {
  const day = "2026-11-05";
  const guide = item("resource", day, { type: "resource", completed: true });
  const moment = item("breathing", day, {
    type: "breathing",
    completed: true,
    durationSec: 60,
  });
  const goal = { metric: "moments", period: "week", target: 1 };
  const guideOnly = { sessions: [guide] };
  const analytics = journeyAnalytics(guideOnly, now());
  assert.equal(analytics.days.get(day).entries[0].record, guide);
  assert.equal(journeyReport(analytics, "week", day).stats.moments, 0);
  assert.equal(
    analytics.milestones.find(({ id }) => id === "first-moment").earned,
    false,
  );
  assert.equal(journeyGoalProgress(goal, guideOnly, now()).current, 0);

  const mixed = { sessions: [guide, moment] };
  const report = journeyReport(journeyAnalytics(mixed, now()), "week", day);
  assert.deepEqual(report.stats, { checkinDays: 0, moments: 1, seconds: 60 });
  assert.deepEqual(
    journeyGoalProgress(goal, mixed, now()).activities.map(
      ({ record }) => record.id,
    ),
    [moment.id],
  );
});
