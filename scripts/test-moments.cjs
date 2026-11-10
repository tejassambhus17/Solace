const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function loadHelper(file, dependencies = {}) {
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
    (name) => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(
        "Pure Moment helpers must not load native or server runtime modules.",
      );
    },
    moduleValue,
    moduleValue.exports,
  );
  return moduleValue.exports;
}
const timedPractices = loadHelper("../server/src/timed-practice-contract.ts");
const explorePractices = loadHelper("explore-practices.ts", {
  "./routes": loadHelper("routes.ts"),
});
const { getTimedPractice, timedPracticeDurations, timedPracticeFocuses } =
  timedPractices;
const {
  emptyClock,
  resumeMoment,
  pauseMoment,
  elapsedMomentMs,
  nextMomentTickDelay,
  momentPosition,
  breathingPosition,
  momentBreathingPosition,
  isPlayableMoment,
  momentClockText,
} = loadHelper("moments.ts", {
  "../server/src/timed-practice-contract": timedPractices,
});
const { createExplorePractice, practiceDurations, practiceFocuses } =
  explorePractices;
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

test("all timed-practice selections open validated activities and finish at the exact active duration", () => {
  const ids = new Set();
  for (const focus of timedPracticeFocuses) {
    for (const minutes of timedPracticeDurations) {
      const practice = getTimedPractice(focus, minutes);
      assert.equal(getTimedPractice(focus, minutes), practice);
      assert.equal(isPlayableMoment(practice), true);
      assert.equal(practice.durationSec, minutes * 60);
      assert.ok(
        practice.steps.every(
          (step) => Number.isInteger(step.durationSec) && step.durationSec > 0,
        ),
      );
      assert.equal(
        practice.steps.reduce((total, step) => total + step.durationSec, 0),
        practice.durationSec,
      );
      assert.ok(!ids.has(practice.id));
      ids.add(practice.id);
      const started = resumeMoment(emptyClock(), 500);
      const paused = pauseMoment(started, 10_500, practice.durationSec);
      assert.equal(
        elapsedMomentMs(paused, 6_000_000, practice.durationSec),
        10_000,
      );
      const resumed = resumeMoment(paused, 6_000_000);
      const end = 6_000_000 + practice.durationSec * 1000 - 10_000;
      assert.equal(
        momentPosition(
          practice,
          elapsedMomentMs(resumed, end - 1, practice.durationSec),
        ).complete,
        false,
      );
      assert.equal(
        momentPosition(
          practice,
          elapsedMomentMs(resumed, end, practice.durationSec),
        ).complete,
        true,
      );
    }
  }
  assert.equal(ids.size, 16);
  assert.equal(getTimedPractice("reflect", 5), undefined);
  assert.equal(getTimedPractice("calm", 3), undefined);
});

test("the Calm reference matches the preview and long breathing practices keep natural breaks", () => {
  const reference = getTimedPractice("calm", 5);
  assert.deepEqual(
    reference.steps.map(({ title, durationSec }) => [title, durationSec]),
    [
      ["Arrive & settle", 60],
      ["Follow the guidance", 150],
      ["Return slowly", 90],
    ],
  );
  const long = getTimedPractice("calm", 20);
  let elapsed = 0;
  for (const [index, step] of long.steps.entries()) {
    const position = momentPosition(long, elapsed);
    assert.equal(position.index, index);
    const breathing = momentBreathingPosition(long, position, elapsed, true);
    assert.equal(!!breathing, [1, 3, 5].includes(index));
    elapsed += step.durationSec * 1000;
  }
  assert.equal(
    isPlayableMoment({ ...long, title: "Unregistered variation" }),
    false,
  );
  assert.equal(
    isPlayableMoment({ ...long, id: "qa-unregistered", environment: "ocean" }),
    false,
  );
  assert.equal(isPlayableMoment({ ...long, environment: "ocean" }), true);
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

test("Moment wakeups align with active seconds and catch up after late callbacks", () => {
  assert.equal(nextMomentTickDelay(0, 60), 1000);
  assert.equal(nextMomentTickDelay(1750, 60), 250);
  assert.equal(nextMomentTickDelay(2427.5, 60), 573);
  assert.equal(nextMomentTickDelay(59_999.9, 60), 1);
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
    remainingMs: 4000,
    progress: 0,
    targetProgress: 1,
  });
  assert.deepEqual(breathingPosition(4, pattern), {
    phase: "Rest gently",
    remaining: 2,
    remainingMs: 2000,
    progress: 1,
    targetProgress: 1,
  });
  assert.deepEqual(breathingPosition(6, pattern), {
    phase: "Breathe out",
    remaining: 6,
    remainingMs: 6000,
    progress: 1,
    targetProgress: 0,
  });
  assert.equal(breathingPosition(9, pattern).progress, 0.5);
  assert.equal(breathingPosition(12, pattern).phase, "Breathe in");
  assert.equal(
    breathingPosition(4, { inhale: 4, hold: 0, exhale: 6 }).phase,
    "Breathe out",
  );
});

test("box breathing has four separate active phases and resumes at the same phase", () => {
  const pattern = { inhale: 4, hold: 4, exhale: 4, rest: 4 };
  assert.deepEqual(
    [0, 4, 8, 12, 16].map(
      (seconds) => breathingPosition(seconds, pattern).phase,
    ),
    ["Breathe in", "Hold gently", "Breathe out", "Rest gently", "Breathe in"],
  );
  assert.deepEqual(breathingPosition(12, pattern), {
    phase: "Rest gently",
    remaining: 4,
    remainingMs: 4000,
    progress: 0,
    targetProgress: 0,
  });
  const clock = pauseMoment(resumeMoment(emptyClock(), 100), 13100, 60);
  assert.equal(
    breathingPosition(elapsedMomentMs(clock, 100000, 60) / 1000, pattern)
      .remaining,
    3,
  );
  assert.equal(
    breathingPosition(
      elapsedMomentMs(resumeMoment(clock, 100000), 103000, 60) / 1000,
      pattern,
    ).phase,
    "Breathe in",
  );
  assert.equal(isPlayableMoment({ ...activity(), breathing: pattern }), true);
  assert.equal(
    isPlayableMoment({ ...activity(), breathing: { ...pattern, rest: 5 } }),
    false,
  );
});

test("breathing motion shares a fixed phase end with the clock and resumes fractional progress", () => {
  const value = activity();
  const sample = (elapsedMs) =>
    momentBreathingPosition(
      value,
      momentPosition(value, elapsedMs),
      elapsedMs,
      false,
    );
  assert.equal(sample(0).phaseEndsAtMs, 4000);
  assert.equal(sample(1321.4).phaseEndsAtMs, 4000);
  const paused = pauseMoment(resumeMoment(emptyClock(), 0), 5500, 60);
  const cue = sample(elapsedMomentMs(paused, 9000, 60));
  assert.equal(cue.phase, "Breathe out");
  assert.equal(cue.progress, 0.75);
  assert.equal(cue.remainingMs, 4500);
  assert.equal(cue.targetProgress, 0);
  assert.equal(cue.phaseEndsAtMs, 10000);
  const resumed = resumeMoment(paused, 12000);
  assert.equal(sample(elapsedMomentMs(resumed, 16500, 60)).phase, "Breathe in");
});

test("built-in breathing cues start at the guided step and stop during the return", () => {
  const practice = createExplorePractice("breathe", 3);
  const cueAt = (milliseconds, builtIn = true) =>
    momentBreathingPosition(
      practice,
      momentPosition(practice, milliseconds),
      milliseconds,
      builtIn,
    );
  assert.equal(cueAt(0), null);
  assert.equal(cueAt(35_999), null);
  assert.equal(cueAt(36_000).phase, "Breathe in");
  assert.equal(cueAt(40_000).phase, "Breathe out");
  assert.equal(cueAt(126_000), null);
  assert.equal(cueAt(180_000), null);
  assert.equal(cueAt(0, false).phase, "Breathe in");
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

test("experience links accept known techniques and private roots, and reject arbitrary destinations", () => {
  const techniques = loadHelper("techniques.ts", {
    "../server/src/chat-practice": loadHelper("../server/src/chat-practice.ts"),
    "./explore-practices": explorePractices,
  });
  const { experienceDestination } = loadHelper("experience-links.ts", {
    "./routes": loadHelper("routes.ts"),
    "./techniques": techniques,
  });
  assert.deepEqual(experienceDestination("solace://companion"), {
    mode: "companion",
  });
  assert.deepEqual(experienceDestination("solace://journal/"), {
    mode: "journal",
  });
  assert.deepEqual(experienceDestination("solace://techniques"), {
    route: "techniques",
    techniqueId: undefined,
  });
  for (const { id } of techniques.listTechniques("All")) {
    assert.deepEqual(experienceDestination(`solace://techniques/${id}`), {
      route: "techniques",
      techniqueId: id,
    });
  }
  for (const url of [
    null,
    "solace://techniques/unknown",
    "solace://techniques/__proto__",
    "solace://techniques/grounding/profile",
    "solace://journal/private-id",
    "https://solace.ai/techniques/grounding",
  ]) {
    assert.equal(experienceDestination(url), null);
  }
});
