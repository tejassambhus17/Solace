import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function sourceModule(file, dependencies = {}, Clock = Date) {
  const compiled = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "Date", compiled)(
    (name) => {
      if (name in dependencies) return dependencies[name];
      if (name.endsWith(".jpg")) return name;
      throw Error(`Unexpected dependency: ${name}`);
    },
    module,
    module.exports,
    Clock,
  );
  return module.exports;
}
const content = sourceModule("../src/content.ts");
const explore = sourceModule("../src/explore-practices.ts");
const ritualContract = sourceModule("../server/src/ritual-contract.ts");
const routineModule = sourceModule("../src/routine.ts", {
  "./content": content,
  "./explore-practices": explore,
  "./progress": sourceModule("../src/progress.ts", { "./content": content }),
  "../server/src/ritual-contract": ritualContract,
});
const { pickDailyRoutine } = routineModule;
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

test("approved helpful feedback must be linked to a completed, dated session", () => {
  const routine = pickDailyRoutine(
    {
      sessions: [
        {
          id: "future-session",
          day: "2026-11-06",
          type: "breathing",
          completed: true,
          feedback: "Helped",
        },
        {
          ...today,
          id: "incomplete-session",
          type: "reflection",
          completed: false,
          feedback: "Helped",
        },
        {
          id: "past-session",
          day: "2026-11-04",
          type: "grounding",
          completed: true,
          feedback: "Helped",
        },
      ],
      memories: ["future-session", "incomplete-session", "past-session"].map(
        (sourceId) => ({
          ...today,
          text: "It was helpful.",
          sourceType: "session",
          sourceId,
          approved: true,
        }),
      ),
    },
    { personalization: true },
    now(),
  );
  assert.equal(routine.suggestion.activity, "grounding");
  assert.equal(routine.source, "feedback");
  assert.match(routine.suggestion.reason, /helpful and chose to remember/);
});

test("raw feedback is ignored when its linked memory is missing, unapproved, corrected, or disabled", () => {
  const session = {
    ...today,
    id: "session-one",
    type: "grounding",
    completed: true,
    feedback: "Helped",
  };
  const memory = {
    ...today,
    sourceType: "session",
    sourceId: session.id,
    text: "It was helpful.",
    approved: true,
  };
  const user = { personalization: true };
  for (const memories of [
    [],
    [{ ...memory, approved: false }],
    [{ ...memory, sourceId: "another-session" }],
    [{ ...memory, sourceType: "conversation" }],
    [{ ...memory, day: "2026-11-06" }],
    [{ ...memory, text: "I no longer find this helpful." }],
  ])
    assert.equal(
      pickDailyRoutine({ sessions: [session], memories }, user, now()).source,
      "curated",
    );
  assert.equal(
    pickDailyRoutine({ sessions: [session], memories: [memory] }, user, now())
      .source,
    "feedback",
  );
  assert.equal(
    pickDailyRoutine(
      { sessions: [session], memories: [memory] },
      { personalization: false },
      now(),
    ).source,
    "curated",
  );
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

function todayControls(app) {
  class TestClock extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now().getTime()]));
    }
  }
  const hooks = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...props, children },
    }),
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) {
        hooks[index] = typeof initial === "function" ? initial() : initial;
      }
      return [hooks[index], (value) => (hooks[index] = value)];
    },
    useRef(current) {
      const index = cursor++;
      return (hooks[index] ??= { current });
    },
  };
  const native = {
    Platform: { OS: "android" },
    useWindowDimensions: () => ({ width: 320, fontScale: 1.5 }),
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    Image: "Image",
    Pressable: "Pressable",
    View: "View",
  };
  const dependencies = {
    react,
    "react-native": native,
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 24 }),
    },
    "expo-haptics": {},
    "../Companion": { useReducedMotion: () => true },
    "../content": content,
    "../explore-practices": explore,
    "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "../routine": routineModule,
    "../routes": sourceModule("../src/routes.ts"),
    "../store": { useApp: () => app },
    "../theme": { useTheme: () => ({ colors: {}, resolved: "light" }) },
    "../ui": {
      AppText: "AppText",
      Button: "Button",
      Icon: "Icon",
      LotusMark: "LotusMark",
      Row: "Row",
      Screen: "Screen",
      moodPetals: [],
    },
    "../../server/src/ritual-contract": ritualContract,
    "./HabitEntryPoints": { TodayHabits: "TodayHabits" },
    "./RecommendationExplanation": {
      RecommendationExplanation: "RecommendationExplanation",
    },
  };
  dependencies["./DailyRitualOptions"] = sourceModule(
    "../src/screens/DailyRitualOptions.tsx",
    dependencies,
  );
  const { DailyRitualOptions } = dependencies["./DailyRitualOptions"];
  const { TodayScreen } = sourceModule(
    "../src/screens/Discover.tsx",
    dependencies,
    TestClock,
  );
  function textContent(node) {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(textContent).join("");
    return node?.props ? textContent(node.props.children) : "";
  }
  return () => {
    cursor = 0;
    const controls = [];
    function visit(node, inDailyPause = false) {
      if (Array.isArray(node))
        node.forEach((child) => visit(child, inDailyPause));
      else if (typeof node?.type === "function")
        visit(
          node.type(node.props),
          inDailyPause || node.type === DailyRitualOptions,
        );
      else if (node?.props) {
        if (node.props.onPress) {
          const label =
            node.props.accessibilityLabel ??
            node.props.title ??
            textContent(node);
          controls.push({ label, props: node.props, inDailyPause });
        }
        visit(node.props.children, inDailyPause);
      }
    }
    visit(TodayScreen());
    return controls;
  };
}

test("Today shortcuts and Daily Pause controls keep their real destinations and settings", async () => {
  const destinations = [];
  const saves = [];
  let finishSaving;
  const app = {
    data: {
      checkins: [],
      sessions: [],
      reflections: [],
      preferences: [],
      reminders: [],
    },
    pendingWrites: [],
    navigate: (...args) => destinations.push(args),
    save(collection, record) {
      saves.push([collection, record]);
      return new Promise((resolve) => {
        finishSaving = () => {
          app.data.preferences = [record];
          resolve();
        };
      });
    },
  };
  const controls = todayControls(app);
  function control(label, dailyPause = false) {
    const matches = controls().filter(
      (item) => item.label === label && (!dailyPause || item.inDailyPause),
    );
    assert.equal(
      matches.length,
      1,
      `Expected one Today action called ${label}`,
    );
    assert.ok(!matches[0].props.disabled, `${label} is disabled`);
    return matches[0].props;
  }
  const press = (label, dailyPause) => control(label, dailyPause).onPress();

  for (const [label, route] of [
    ["Guided Programs", "plan"],
    ["Wellness Toolkit", "toolkit"],
    ["Check-Ins", "checkin"],
  ]) {
    press(label);
    assert.deepEqual(destinations.pop(), [route]);
  }
  press("Start check-in");
  assert.deepEqual(destinations.pop(), ["checkin", {}]);
  app.data.checkins.push({ ...today, mood: "Okay" });
  press("Take a Moment");
  assert.deepEqual(destinations.pop(), ["breathing", { durationSec: 180 }]);

  press("Customize daily pause");
  press("Grounding");
  press("5 min");
  const save = control("Save today’s choices");
  save.onPress();
  save.onPress();
  assert.deepEqual(saves, [
    [
      "preferences",
      {
        id: "wellness",
        dailyRitual: {
          enabled: true,
          day: today.day,
          skipPractice: false,
          activity: "grounding",
          durationMinutes: 5,
        },
      },
    ],
  ]);
  finishSaving();
  await Promise.resolve();
  press("Take a Moment");
  assert.deepEqual(destinations.pop(), [
    "moment-player",
    {
      activity: explore.createExplorePractice("ground", 5),
      provider: "offline",
      source: "today",
    },
  ]);

  app.data.sessions.push({ ...today, type: "breathing", completed: true });
  press("Reflect", true);
  assert.deepEqual(destinations.pop(), [
    "reflection",
    {
      prompt:
        "What would you like to carry from this moment into the rest of your day?",
    },
  ]);
  app.data.reflections.push({ ...today, text: "A saved reflection" });
  press("View today’s pause");
  assert.deepEqual(destinations.pop(), [
    "journey-activity",
    { day: today.day },
  ]);
});
