import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
// Execute the actual TypeScript helper and its actual calendar implementation.
// Metro uses extensionless imports; this loader keeps the test runner independent
// of Metro without changing the application module-resolution configuration.
function sourceModule(relative, dependencies = {}) {
  const file = fileURLToPath(new URL(relative, import.meta.url));
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const content = sourceModule("../src/content.ts");
const { weeklyReview } = sourceModule("../src/insights.ts", {
  "./content": content,
});
const now = () => new Date(2026, 10, 5, 12);
const dayRecord = (day, extra = {}) => ({ day, ...extra });

test("an empty week has no inferred mood, support claim or fabricated participation", () => {
  const review = weeklyReview({}, now());
  assert.equal(review.startDay, "2026-10-30");
  assert.equal(review.endDay, "2026-11-05");
  assert.equal(review.daysCheckedIn, 0);
  assert.equal(review.checkinCount, 0);
  assert.equal(review.leadingMood, null);
  assert.equal(review.completedMoments, 0);
  assert.equal(review.supportiveMoments, 0);
  assert.equal(review.reflectionCount, 0);
  assert.deepEqual(
    review.moods.map((item) => item.count),
    [0, 0, 0, 0, 0],
  );
  assert.equal(
    review.suggestedPrompt,
    "What would you like to make a little room for this week?",
  );
});

test("the seven local-calendar days include the boundary and exclude older or future activity", () => {
  const review = weeklyReview(
    {
      checkins: [
        dayRecord("2026-10-29", { mood: "Low" }),
        dayRecord("2026-10-30", { mood: "Okay" }),
        dayRecord("2026-11-05", { mood: "Calm" }),
        dayRecord("2026-11-06", { mood: "Great" }),
        { createdAt: "not-a-date", mood: "Great" },
        dayRecord("2026-02-30", { mood: "Great" }),
        dayRecord("2026-11-05", {
          createdAt: new Date(2026, 10, 5, 13).toISOString(),
          mood: "Low",
        }),
      ],
    },
    now(),
  );
  assert.equal(review.checkinCount, 2);
  assert.equal(review.daysCheckedIn, 2);
  assert.equal(review.leadingMood, null);
});

test("repeat check-ins count as entries while repeated record IDs and days do not inflate totals", () => {
  const review = weeklyReview(
    {
      checkins: [
        dayRecord("2026-11-05", { id: "one", mood: "Calm" }),
        dayRecord("2026-11-05", { id: "one", mood: "Calm" }),
        dayRecord("2026-11-05", { id: "two", mood: "Okay" }),
        dayRecord("2026-11-04", { id: "three", mood: "Calm" }),
      ],
    },
    now(),
  );
  assert.equal(review.checkinCount, 3);
  assert.equal(review.daysCheckedIn, 2);
  assert.equal(review.leadingMood, "Calm");
  assert.equal(review.moods.find((item) => item.mood === "Calm").count, 2);
});

test("a tie never presents one mood as predominant and unknown values are not relabeled", () => {
  const review = weeklyReview(
    {
      checkins: [
        dayRecord("2026-11-05", { mood: "Calm" }),
        dayRecord("2026-11-05", { mood: "Okay" }),
        dayRecord("2026-11-04", { mood: "unrecognized" }),
      ],
    },
    now(),
  );
  assert.equal(review.leadingMood, null);
  assert.equal(review.checkinCount, 3);
  assert.equal(
    review.moods.reduce((sum, item) => sum + item.count, 0),
    2,
  );
  assert.deepEqual(
    review.moods.map((item) => item.mood),
    ["Okay", "Calm", "Low", "Stressed", "Great"],
  );
});

test("only explicitly completed recent moments with positive self-reported feedback count as supportive", () => {
  const review = weeklyReview(
    {
      sessions: [
        dayRecord("2026-11-05", {
          id: "a",
          completed: true,
          feedback: "Helped",
        }),
        dayRecord("2026-11-05", {
          id: "a",
          completed: true,
          feedback: "Helped",
        }),
        dayRecord("2026-11-04", { completed: true, feedback: "A little" }),
        dayRecord("2026-11-03", { completed: true, feedback: "Not for me" }),
        dayRecord("2026-11-02", { completed: true, feedback: "skipped" }),
        dayRecord("2026-11-01", { completed: false, feedback: "Helped" }),
        dayRecord("2026-11-01", { feedback: "Helped" }),
        dayRecord("2026-10-29", { completed: true, feedback: "Helped" }),
      ],
    },
    now(),
  );
  assert.equal(review.completedMoments, 4);
  assert.equal(review.supportiveMoments, 2);
  assert.match(review.suggestedPrompt, /felt useful, even a little/);
});

test("saved reflections are bounded to the week and do not imply improved wellbeing", () => {
  const review = weeklyReview(
    {
      reflections: [
        dayRecord("2026-11-05", { id: "one" }),
        dayRecord("2026-11-05", { id: "one" }),
        dayRecord("2026-10-30", { id: "two" }),
        dayRecord("2026-10-29"),
        { createdAt: "invalid" },
      ],
    },
    now(),
  );
  assert.equal(review.reflectionCount, 2);
  assert.match(review.suggestedPrompt, /what you wrote this week/);
  assert.doesNotMatch(
    review.suggestedPrompt,
    /improv|recover|diagnos|treat|healthier|better mood/i,
  );
});

test("device local day wins over its preceding UTC date across timezone and midnight boundaries", () => {
  const previousTZ = process.env.TZ;
  try {
    process.env.TZ = "Asia/Kolkata";
    const review = weeklyReview(
      {
        checkins: [
          {
            day: "2026-11-05",
            createdAt: "2026-11-04T20:15:00.000Z",
            mood: "Calm",
          },
          {
            day: "2026-10-30",
            createdAt: "2026-10-29T20:15:00.000Z",
            mood: "Okay",
          },
          { createdAt: "2026-11-04T20:00:00.000Z", mood: "Great" },
        ],
      },
      new Date("2026-11-05T06:30:00.000Z"),
    );
    assert.equal(review.checkinCount, 3);
    assert.equal(review.daysCheckedIn, 2);
    assert.equal(review.startDay, "2026-10-30");
    assert.equal(review.endDay, "2026-11-05");
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});

test("calendar subtraction stays seven days over a daylight-saving transition", () => {
  const previousTZ = process.env.TZ;
  try {
    process.env.TZ = "America/New_York";
    const review = weeklyReview(
      {
        checkins: [
          dayRecord("2026-10-27", { mood: "Calm" }),
          dayRecord("2026-11-02", { mood: "Okay" }),
        ],
      },
      new Date(2026, 10, 2, 12),
    );
    assert.equal(review.startDay, "2026-10-27");
    assert.equal(review.endDay, "2026-11-02");
    assert.equal(review.daysCheckedIn, 2);
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});

test("invalid clock input fails clearly rather than assigning records to a fabricated week", () => {
  assert.throws(() => weeklyReview({}, new Date("invalid")), RangeError);
});
