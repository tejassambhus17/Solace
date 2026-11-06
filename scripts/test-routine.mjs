import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function sourceModule(file, dependencies = {}) {
  const compiled = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (name in dependencies) return dependencies[name];
      throw Error(`Unexpected dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const content = sourceModule("../src/content.ts");
const explore = sourceModule("../src/explore-practices.ts");
const { pickDailyRoutine } = sourceModule("../src/routine.ts", {
  "./content": content,
  "./explore-practices": explore,
  "./progress": sourceModule("../src/progress.ts", { "./content": content }),
  "../server/src/ritual-contract": sourceModule(
    "../server/src/ritual-contract.ts",
  ),
});
const now = () => new Date(2026, 10, 5, 12);
const today = { createdAt: "2026-11-05T06:00:00.000Z", day: "2026-11-05" };

test("an empty account gets one curated practice and no fabricated completion", () => {
  const routine = pickDailyRoutine({}, null, now());
  assert.equal(routine.suggestion.activity, "breathing");
  assert.equal(routine.suggestion.params.durationSec, 180);
  assert.equal(routine.curated, true);
  assert.equal(routine.source, "curated");
  assert.equal(routine.nextStep.id, "checkin");
  assert.equal(routine.completedCount, 0);
});

test("disabled personalization ignores historical preferences, feedback and older moods", () => {
  const routine = pickDailyRoutine(
    {
      memories: [{ ...today, text: "I prefer journaling", approved: true }],
      sessions: [
        { ...today, type: "grounding", feedback: "Helped", completed: true },
      ],
      checkins: [{ day: "2026-11-04", mood: "Low" }],
    },
    { personalization: false },
    now(),
  );
  assert.equal(routine.suggestion.activity, "breathing");
  assert.equal(routine.source, "curated");
  assert.doesNotMatch(routine.suggestion.reason, /approved|before|marked/);
});

test("today's directly supplied mood can offer a local curated option without history consent", () => {
  const routine = pickDailyRoutine(
    { checkins: [{ ...today, mood: "Stressed", localOnly: true }] },
    { personalization: false },
    now(),
  );
  assert.equal(routine.suggestion.activity, "grounding");
  assert.equal(routine.source, "today-checkin");
  assert.match(routine.suggestion.reason, /checked in with today/);
  assert.equal(routine.nextStep.id, "checkin");
  assert.equal(routine.todayCheckin.localOnly, true);
});

test("consented approved activity preferences explain their source; unapproved and future memories are ignored", () => {
  const routine = pickDailyRoutine(
    {
      memories: [
        { ...today, text: "I prefer grounding", approved: false },
        { day: "2026-11-06", text: "I prefer breathing", approved: true },
        { day: "2026-11-04", text: "I prefer sleep routines", approved: true },
      ],
    },
    { personalization: true },
    now(),
  );
  assert.equal(routine.suggestion.activity, "rest");
  assert.equal(routine.suggestion.route, "moment-player");
  assert.equal(routine.suggestion.params.activity.durationSec, 180);
  assert.equal(routine.source, "preference");
  assert.match(routine.suggestion.reason, /preference you approved/);
});

test("a disliked activity is not selected as a saved preference", () => {
  const routine = pickDailyRoutine(
    {
      memories: [
        { ...today, approved: true, text: "I do not like breathing exercises" },
      ],
    },
    { personalization: true },
    now(),
  );
  assert.equal(routine.source, "curated");
});

test("consented prior helpful feedback must be completed and dated, with no diagnostic inference", () => {
  const routine = pickDailyRoutine(
    {
      sessions: [
        {
          day: "2026-11-06",
          type: "breathing",
          completed: true,
          feedback: "Helped",
        },
        { ...today, type: "reflection", completed: false, feedback: "Helped" },
        {
          day: "2026-11-04",
          type: "grounding",
          completed: true,
          feedback: "Helped",
        },
      ],
    },
    { personalization: true },
    now(),
  );
  assert.equal(routine.suggestion.activity, "grounding");
  assert.equal(routine.source, "feedback");
  assert.match(routine.suggestion.reason, /marked.*helpful before/);
});

test("local-calendar completion requires actual saved records, not future records or incomplete practice", () => {
  const routine = pickDailyRoutine(
    {
      checkins: [{ day: "2026-11-06", mood: "Great" }],
      sessions: [{ ...today, completed: false }],
      reflections: [{ ...today, text: "   " }],
    },
    null,
    now(),
  );
  assert.equal(routine.completedCount, 0);
  const completed = pickDailyRoutine(
    {
      checkins: [{ ...today, mood: "Okay" }],
      sessions: [{ ...today, completed: true }],
      reflections: [{ ...today, text: "A saved thought" }],
    },
    null,
    now(),
  );
  assert.equal(completed.completedCount, 3);
  assert.equal(completed.nextStep, null);
});

test("a journal entry completes Reflect only and a guided writing Moment completes the practice", () => {
  const user = { personalization: true };
  const data = {
    memories: [{ ...today, text: "I prefer journaling", approved: true }],
    checkins: [{ ...today, mood: "Okay" }],
    reflections: [{ ...today, text: "I made room for myself." }],
    sessions: [],
  };
  const routine = pickDailyRoutine(data, user, now());
  assert.equal(routine.suggestion.activity, "reflection");
  assert.equal(routine.nextStep.id, "practice");
  assert.equal(routine.nextStep.route, "moment-player");
  assert.deepEqual(routine.nextStep.params, {
    activity: explore.createExplorePractice("reflect", 3),
    source: "today",
    provider: "offline",
  });
  assert.equal(routine.completedCount, 2);
  data.sessions.push({ ...today, type: "reflection", completed: true });
  const completed = pickDailyRoutine(data, user, now());
  assert.equal(completed.completedCount, 3);
  assert.equal(completed.nextStep, null);
});

test("a resource checklist does not complete a Moment, even after all steps are checked", () => {
  const data = {
    checkins: [{ ...today, mood: "Okay" }],
    memories: [{ ...today, approved: true, text: "I prefer sleep routines" }],
    sessions: [
      {
        ...today,
        type: "resource",
        resourceId: "sleep",
        steps: [0],
        completed: false,
      },
    ],
  };
  assert.equal(
    pickDailyRoutine(data, { personalization: true }, now()).nextStep.id,
    "practice",
  );
  data.sessions[0].completed = true;
  assert.equal(
    pickDailyRoutine(data, { personalization: true }, now()).nextStep.id,
    "practice",
  );
});

test("a pending entry is available for the mood tray but does not replace recorded progress", () => {
  const data = {
    checkins: [
      { ...today, mood: "Calm" },
      {
        ...today,
        createdAt: "2026-11-05T06:30:00.000Z",
        mood: "Low",
        localOnly: true,
      },
    ],
    sessions: [{ ...today, type: "breathing", completed: true }],
    reflections: [{ ...today, text: "Waiting to sync", localOnly: true }],
  };
  const routine = pickDailyRoutine(data, null, now());
  assert.equal(routine.todayCheckin.mood, "Low");
  assert.equal(routine.completedCount, 2);
  assert.equal(routine.nextStep.id, "reflection");
});

test("selection is deterministic and does not mutate account records", () => {
  const data = {
    checkins: [{ ...today, mood: "Low" }],
    memories: [{ ...today, approved: true, text: "I prefer grounding" }],
  };
  const before = JSON.stringify(data);
  assert.deepEqual(
    pickDailyRoutine(data, { personalization: true }, now()),
    pickDailyRoutine(data, { personalization: true }, now()),
  );
  assert.equal(JSON.stringify(data), before);
});

test("replacement and duration affect only the chosen day and launch an existing timed activity", () => {
  const data = {
    checkins: [{ ...today, mood: "Stressed" }],
    preferences: [
      {
        id: "wellness",
        dailyRitual: {
          enabled: true,
          day: today.day,
          skipPractice: false,
          activity: "reflection",
          durationMinutes: 5,
        },
      },
    ],
  };
  const current = pickDailyRoutine(data, null, now());
  assert.equal(current.source, "user-choice");
  assert.equal(current.suggestion.duration, "5 min");
  assert.equal(current.nextStep.route, "moment-player");
  assert.deepEqual(
    current.nextStep.params.activity,
    explore.createExplorePractice("reflect", 5),
  );

  const nextDay = pickDailyRoutine(data, null, new Date(2026, 10, 6, 19));
  assert.equal(nextDay.suggestion.activity, "rest");
  assert.equal(nextDay.source, "time-of-day");
  assert.equal(nextDay.settings.durationMinutes, undefined);
  assert.equal(nextDay.completedCount, 0);
});

test("skipping advances to reflection without incrementing or blocking actual Moment progress", () => {
  const data = {
    checkins: [{ ...today, mood: "Okay" }],
    preferences: [
      {
        id: "wellness",
        dailyRitual: {
          enabled: true,
          day: today.day,
          skipPractice: true,
        },
      },
    ],
  };
  const skipped = pickDailyRoutine(data, null, now());
  assert.equal(skipped.practiceSkipped, true);
  assert.equal(skipped.nextStep.id, "reflection");
  assert.equal(skipped.completedCount, 1);
  const completed = pickDailyRoutine(
    {
      ...data,
      sessions: [{ ...today, type: "breathing", completed: true }],
    },
    null,
    now(),
  );
  assert.equal(completed.practiceSkipped, false);
  assert.equal(completed.completedCount, 2);
});

test("turning off persists past midnight while an opted-in goal can inform an enabled ritual", () => {
  const data = {
    goals: [{ ...today, metric: "reflections", active: true }],
    preferences: [
      {
        id: "wellness",
        dailyRitual: {
          enabled: false,
          day: today.day,
          skipPractice: true,
        },
      },
    ],
  };
  const tomorrow = new Date(2026, 10, 6, 12);
  const disabled = pickDailyRoutine(data, { personalization: true }, tomorrow);
  assert.equal(disabled.settings.enabled, false);
  assert.equal(disabled.settings.skipPractice, false);
  assert.equal(disabled.nextStep, null);
  assert.equal(disabled.source, "goal");
  assert.equal(disabled.suggestion.activity, "reflection");
  const revoked = pickDailyRoutine(data, { personalization: false }, tomorrow);
  assert.equal(revoked.source, "curated");
});
