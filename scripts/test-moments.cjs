const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function loadHelper(file) {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const moduleValue = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    () => {
      throw new Error(
        "Pure Moment helpers must not load native or server runtime modules.",
      );
    },
    moduleValue,
    moduleValue.exports,
  );
  return moduleValue.exports;
}
const {
  emptyClock,
  resumeMoment,
  pauseMoment,
  elapsedMomentMs,
  momentPosition,
  breathingPosition,
  isPlayableMoment,
  momentClockText,
} = loadHelper("moments.ts");
const { createExplorePractice, practiceDurations, practiceFocuses } =
  loadHelper("explore-practices.ts");
const activity = () => ({
  version: 1,
  id: "qa-moment",
  type: "breathing",
  title: "A little room",
  description: "An optional comfortable pause.",
  durationSec: 60,
  steps: [
    {
      title: "Arrive",
      instruction: "Sit comfortably, or choose a position that works for you.",
      durationSec: 10,
    },
    {
      title: "A slower rhythm",
      instruction: "Follow a comfortable rhythm, or breathe naturally.",
      durationSec: 50,
    },
  ],
  breathing: { inhale: 4, hold: 0, exhale: 6 },
  reflectionPrompts: [],
  environment: "forest",
});

test("a paused Moment accrues no time, including long background gaps", () => {
  let clock = resumeMoment(emptyClock(), 1000);
  clock = pauseMoment(clock, 11000, 60);
  assert.equal(elapsedMomentMs(clock, 999999, 60), 10000);
  clock = resumeMoment(clock, 1000000);
  assert.equal(elapsedMomentMs(clock, 1010000, 60), 20000);
});

test("completion requires the full active duration and delayed ticks never overcount", () => {
  const clock = resumeMoment(emptyClock(), 100);
  assert.equal(
    momentPosition(activity(), elapsedMomentMs(clock, 60099, 60)).complete,
    false,
  );
  assert.equal(
    momentPosition(activity(), elapsedMomentMs(clock, 60100, 60)).complete,
    true,
  );
  assert.equal(elapsedMomentMs(clock, 99999999, 60), 60000);
  assert.equal(momentPosition(activity(), 99999999).stepRemaining, 0);
});

test("repeated resume and pause events cannot reset or multiply recorded time", () => {
  const running = resumeMoment(emptyClock(), 1000);
  const duplicate = resumeMoment(running, 10000);
  assert.equal(duplicate, running);
  const paused = pauseMoment(duplicate, 12000, 60);
  assert.equal(paused.elapsedMs, 11000);
  assert.deepEqual(pauseMoment(paused, 90000, 60), paused);
  assert.equal(elapsedMomentMs(running, 0, 60), 0);
});

test("step boundaries follow recorded active time, including after resume", () => {
  assert.equal(momentPosition(activity(), 9999).index, 0);
  const atBoundary = momentPosition(activity(), 10000);
  assert.equal(atBoundary.index, 1);
  assert.equal(atBoundary.stepRemaining, 50);
  assert.equal(momentPosition(activity(), -5000).stepElapsed, 0);
});

test("breathing visual phase and remaining seconds use the same actual clock", () => {
  const pattern = { inhale: 4, hold: 2, exhale: 6 };
  assert.deepEqual(breathingPosition(0, pattern), {
    phase: "Breathe in",
    remaining: 4,
    progress: 0,
  });
  assert.deepEqual(breathingPosition(4, pattern), {
    phase: "Rest gently",
    remaining: 2,
    progress: 1,
  });
  assert.deepEqual(breathingPosition(6, pattern), {
    phase: "Breathe out",
    remaining: 6,
    progress: 1,
  });
  assert.equal(breathingPosition(9, pattern).progress, 0.5);
  assert.equal(breathingPosition(12, pattern).phase, "Breathe in");
  assert.equal(
    breathingPosition(4, { inhale: 4, hold: 0, exhale: 6 }).phase,
    "Breathe out",
  );
});

test("navigation data must be bounded, internally consistent guidance before playback", () => {
  assert.equal(isPlayableMoment(activity()), true);
  for (const mutation of [
    { durationSec: 0 },
    { durationSec: 601 },
    { durationSec: 59 },
    { steps: [] },
    { steps: [{ title: "", instruction: "Missing title", durationSec: 60 }] },
    {
      steps: [
        { title: "Large step", instruction: "x".repeat(501), durationSec: 60 },
      ],
    },
    { breathing: { inhale: 7, hold: 0, exhale: 6 } },
    { breathing: null },
    { type: "rest" },
    { environment: "unknown" },
    { reflectionPrompts: ["x".repeat(241)] },
  ])
    assert.equal(isPlayableMoment({ ...activity(), ...mutation }), false);
  assert.equal(isPlayableMoment(null), false);
  assert.equal(isPlayableMoment("instructions"), false);
  assert.equal(
    isPlayableMoment({ ...activity(), type: "rest", breathing: null }),
    true,
  );
});

test("reading timer and phase positions never mutates a generated activity or clock", () => {
  const value = activity();
  const original = JSON.stringify(value);
  const clock = Object.freeze({ elapsedMs: 5000, runningSince: 1000 });
  elapsedMomentMs(clock, 3000, 60);
  pauseMoment(clock, 3000, 60);
  momentPosition(value, 20000);
  assert.equal(JSON.stringify(value), original);
  assert.deepEqual(clock, { elapsedMs: 5000, runningSince: 1000 });
  assert.equal(momentClockText(61.9), "1:01");
  assert.equal(momentClockText(-1), "0:00");
});

test("every Explore focus and duration opens a valid timed practice", () => {
  for (const focus of Object.keys(practiceFocuses)) {
    for (const minutes of practiceDurations) {
      const practice = createExplorePractice(focus, minutes);
      assert.equal(
        isPlayableMoment(practice),
        true,
        `${focus}, ${minutes} min`,
      );
      assert.equal(practice.durationSec, minutes * 60);
      const end = minutes * 60 * 1000;
      assert.equal(momentPosition(practice, end - 1).complete, false);
      assert.equal(momentPosition(practice, end).complete, true);
    }
  }
  assert.equal(createExplorePractice("breathe", 5).title, "Calm Your Mind");
});
