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
      if (/\.(jpg|png)$/.test(name)) return name;
      throw Error(`Unexpected dependency: ${name}`);
    },
    module,
    module.exports,
    Clock,
  );
  return module.exports;
}
const content = sourceModule("../src/content.ts");
const routes = sourceModule("../src/routes.ts");
const explore = sourceModule("../src/explore-practices.ts", {
  "./routes": routes,
});
const ritualContract = sourceModule("../server/src/ritual-contract.ts");
const habitContract = sourceModule("../server/src/habit-contract.ts");
const wellnessRecommendations = sourceModule(
  "../src/wellness-recommendations.ts",
  {
    "../server/src/wellness-goals": sourceModule(
      "../server/src/wellness-goals.ts",
    ),
    "./explore-practices": explore,
    "./routes": routes,
  },
);
const routineModule = sourceModule("../src/routine.ts", {
  "./content": content,
  "./explore-practices": explore,
  "./progress": sourceModule("../src/progress.ts", { "./content": content }),
  "./wellness-recommendations": wellnessRecommendations,
  "../server/src/ritual-contract": ritualContract,
});
const { pickDailyRoutine } = routineModule;
const now = () => new Date(2026, 10, 5, 12);
const today = { createdAt: "2026-11-05T06:00:00.000Z", day: "2026-11-05" };

test("goal priorities ignore the neutral choice and rotate across explicit goals", () => {
  const { wellnessGoalPriority, firstWellnessRecommendation } =
    wellnessRecommendations;
  assert.deepEqual(
    wellnessGoalPriority(["explore", "sleep", "other", "sleep"]),
    ["sleep"],
  );
  assert.notEqual(
    wellnessGoalPriority(["calm", "focus"], now())[0],
    wellnessGoalPriority(["calm", "focus"], new Date(2026, 10, 6, 12))[0],
  );
  assert.equal(
    firstWellnessRecommendation(["explore"]).route,
    routes.routes.explore,
  );
  assert.equal(
    firstWellnessRecommendation(["sleep", "explore"]).params.activity
      .durationSec,
    600,
  );
  assert.deepEqual(firstWellnessRecommendation(["focus"]).params, {
    focus: "focus",
    minutes: 5,
  });
});

test("explicit wellness goals guide a local pause without overriding a current mood", () => {
  const user = { personalization: false, wellnessGoals: ["explore", "sleep"] };
  assert.equal(pickDailyRoutine({}, user, now()).suggestion.activity, "rest");
  assert.equal(pickDailyRoutine({}, user, now()).source, "wellness-goal");
  const checkedIn = pickDailyRoutine(
    { checkins: [{ ...today, mood: "Stressed" }] },
    user,
    now(),
  );
  assert.equal(checkedIn.source, "today-checkin");
  assert.equal(checkedIn.suggestion.activity, "grounding");
});

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

function todayScreen(
  app,
  {
    fontScale = 1.5,
    resolved = "light",
    platform = "android",
    width = 320,
  } = {},
) {
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
    useCallback: (callback) => callback,
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
    Platform: { OS: platform },
    useWindowDimensions: () => ({ width, fontScale }),
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
    "../haptics": { playHaptic: async () => {} },
    "../Companion": { useReducedMotion: () => true },
    "../content": content,
    "../explore-practices": explore,
    "../layout": sourceModule("../src/layout.ts", { "react-native": native }),
    "../routine": routineModule,
    "../routes": routes,
    "../SolaceBrandHeader": sourceModule("../src/SolaceBrandHeader.tsx", {
      react,
      "react-native": native,
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 24, left: 0, right: 0 }),
      },
      "./layout": sourceModule("../src/layout.ts", { "react-native": native }),
      "./ui": { AppText: "AppText", LotusMark: "LotusMark", Row: "Row" },
    }),
    "../store": { useApp: () => app },
    "../theme": {
      artGradient: (backgroundImage) => ({ backgroundImage }),
      useTheme: () => ({ colors: {}, resolved }),
    },
    "../ui": {
      AppText: "AppText",
      Button: "Button",
      Icon: "Icon",
      IconButton: ({ label, onPress }) =>
        react.createElement("Pressable", {
          accessibilityLabel: label,
          onPress,
        }),
      LotusMark: "LotusMark",
      Row: "Row",
      Screen: "Screen",
      moodPetals: [],
    },
    "../../server/src/ritual-contract": ritualContract,
    "./RecommendationExplanation": {
      RecommendationExplanation: "RecommendationExplanation",
    },
    "./TodayProgressCard": { TodayProgressCard: "TodayProgressCard" },
  };
  const { getTodayHabitsPreview } = sourceModule(
    "../src/screens/HabitEntryPoints.tsx",
    {
      ...dependencies,
      "../../server/src/habit-contract": habitContract,
      "../habits-ui": { gardenLabels: {} },
    },
    TestClock,
  );
  dependencies["./HabitEntryPoints"] = {
    TodayHabits: "TodayHabits",
    getTodayHabitsPreview,
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
    const nodes = [];
    function visit(node, inDailyPause = false, parent, grandparent) {
      if (Array.isArray(node))
        node.forEach((child) =>
          visit(child, inDailyPause, parent, grandparent),
        );
      else if (typeof node?.type === "function")
        visit(
          node.type(node.props),
          inDailyPause || node.type === DailyRitualOptions,
          parent,
          grandparent,
        );
      else if (node?.props) {
        nodes.push({ ...node, parent, grandparent, inDailyPause });
        if (node.props.onPress) {
          const label =
            node.props.accessibilityLabel ??
            node.props.title ??
            textContent(node);
          controls.push({
            label,
            props: node.props,
            inDailyPause,
            parent,
            grandparent,
          });
        }
        visit(node.props.children, inDailyPause, node, parent);
      }
    }
    visit(TodayScreen());
    return { controls, nodes };
  };
}

test("Today inserts progress after mood and keeps the four quick-action routes and existing sections", () => {
  const quickActions = [
    ["Breathe", ["breathing", { durationSec: 180 }]],
    ["Reflect", ["reflection", {}]],
    ["Sleep", ["sleep", {}]],
    ["Focus", ["grounding", {}]],
  ];
  const habit = (
    id,
    schedule,
    status = "active",
    goal = { type: "completion" },
  ) => ({
    id,
    schedule,
    status,
    goal,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    revisions: [{ day: "2026-11-01", schedule, status, goal }],
  });
  const habits = [
    habit("complete", { type: "daily" }),
    habit("partial", { type: "daily" }, "active", {
      type: "quantity",
      target: 2,
      unit: "cups",
    }),
    habit("flexible", { type: "weekly", daysPerWeek: 2 }),
    habit("future", { type: "weekdays", days: [(now().getDay() + 1) % 7] }),
    habit("paused", { type: "daily" }, "paused"),
  ];
  for (const [platform, width, fontScale] of [
    ["android", 320, 1],
    ["android", 320, 1.5],
    ["ios", 390, 1],
    ["ios", 390, 1.5],
  ]) {
    for (const resolved of ["light", "dark"]) {
      const destinations = [];
      const app = {
        user: { name: "Sage Test" },
        data: {
          checkins: [{ ...today, mood: "Okay" }],
          sessions: [],
          reflections: [],
          preferences: [],
          reminders: [],
          habits,
          habitProgress: [
            { habitId: "complete", day: today.day, amount: 1, complete: true },
            { habitId: "partial", day: today.day, amount: 1, complete: false },
            {
              habitId: "partial",
              day: "2026-11-04",
              amount: 2,
              complete: true,
            },
            { habitId: "flexible", day: today.day, amount: 1, complete: true },
            { habitId: "paused", day: today.day, amount: 1, complete: true },
          ],
        },
        pendingWrites: [],
        navigate: (...args) => destinations.push(args),
      };
      const render = todayScreen(app, {
        platform,
        width,
        fontScale,
        resolved,
      });
      const { nodes, controls } = render();
      function indexOf(type, text) {
        return nodes.findIndex(
          (node) =>
            node.type === type &&
            (text === undefined || node.props.children.includes(text)),
        );
      }
      const order = [
        indexOf("AppText", "How are you feeling today?"),
        indexOf("TodayProgressCard"),
        indexOf("AppText", "Today’s Moment"),
        ...quickActions.map(([label]) => indexOf("AppText", label)),
        indexOf("AppText", "Your Journey"),
        indexOf("TodayHabits"),
        indexOf("AppText", "Explore More"),
        indexOf("AppText", "Your Daily Pause"),
      ];
      assert.ok(
        order.every((index, i) => index > (order[i - 1] ?? -1)),
        `Unexpected Today section order on ${platform} ${resolved}: ${order}`,
      );
      const progressCards = nodes.filter(
        (node) => node.type === "TodayProgressCard",
      );
      assert.equal(progressCards.length, 1);
      const progress = progressCards[0].props;
      assert.equal(progress.routine.completedCount, 1);
      assert.deepEqual(progress.habits, { completed: 1, scheduled: 2 });
      const habitCard = nodes.find(({ type }) => type === "TodayHabits");
      assert.equal(habitCard.props.daily.done, progress.habits.completed);
      assert.equal(
        habitCard.props.daily.fixed.length,
        progress.habits.scheduled,
      );
      progress.onViewDetails();
      assert.deepEqual(destinations.pop(), ["journey"]);

      const artwork = new Set();
      const rows = new Set();
      for (const [label, destination] of quickActions) {
        const buttons = controls.filter(
          (item) => !item.inDailyPause && item.label === label,
        );
        assert.equal(buttons.length, 1, label);
        const [{ props, parent }] = buttons;
        rows.add(parent);
        assert.equal(props.accessibilityRole, "button", label);
        assert.ok(!props.disabled, label);
        const image = nodes.find(
          (node) =>
            node.type === "Image" &&
            (node.parent?.props === props || node.grandparent?.props === props),
        );
        assert.equal(image?.props.resizeMode, "cover", label);
        assert.equal(image.props.accessible, false, label);
        artwork.add(image.props.source);
        const style = (pressed) =>
          Object.assign({}, ...[props.style({ pressed })].flat());
        assert.equal(style(false).flex, 1, label);
        assert.ok(style(false).minHeight >= 44, label);
        assert.ok(style(true).opacity < style(false).opacity, label);
        props.onPress();
        assert.deepEqual(destinations.splice(0), [destination], label);
      }
      assert.equal(rows.size, 1, "the four actions share one row");
      const [row] = rows;
      const rowStyle = Object.assign({}, ...[row.props.style].flat());
      assert.equal(
        rowStyle.flexWrap ?? "nowrap",
        resolved === "light" && (fontScale > 1.3 || width < 310)
          ? "wrap"
          : "nowrap",
        "the actions stay in one row at standard sizes and reflow for large light-mode text",
      );
      assert.equal(artwork.size, 4, "each action uses its own artwork");

      app.data.habitProgress = app.data.habitProgress.filter(
        ({ habitId }) => habitId !== "complete",
      );
      const afterUndo = render().nodes.find(
        (node) => node.type === "TodayProgressCard",
      );
      assert.deepEqual(afterUndo.props.habits, { completed: 0, scheduled: 2 });
    }
  }
});

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
      habits: [],
      habitProgress: [],
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
  const render = todayScreen(app);
  function control(label, dailyPause = false) {
    const matches = render().controls.filter(
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

  press("See all practices");
  assert.deepEqual(destinations.pop(), ["explore", { resetExplore: true }]);

  const shortcuts = [
    ["Guided Programs", "guided-programs"],
    ["Wellness Toolkit", "toolkit"],
    ["Check-Ins", "checkin"],
  ];
  const cardStyle = ({ props }) =>
    Object.assign({}, ...props.style({ pressed: false }));
  for (const [fontScale, theme] of [
    [1, "light"],
    [1, "dark"],
    [1.5, "light"],
    [1.5, "dark"],
  ]) {
    const { controls: rendered } = todayScreen(app, {
      fontScale,
      resolved: theme,
    })();
    const [guided, toolkit, checkIns] = shortcuts.map(([label]) => {
      const cards = rendered.filter((item) => item.label === label);
      assert.equal(cards.length, 1);
      assert.equal(cards[0].props.accessibilityRole, "button");
      return cards[0];
    });
    assert.equal(guided.parent, toolkit.parent, "upper cards share one row");
    assert.equal(
      guided.grandparent,
      checkIns.parent,
      "Check-Ins is outside the upper row",
    );
    const row = guided.parent.props.style;
    const group = checkIns.parent.props.style;
    assert.equal(row.flexDirection, "row");
    assert.equal(row.alignItems, "stretch");
    assert.ok(row.gap >= 12 && row.gap <= 14);
    assert.equal(group.gap, row.gap);
    const styles = [guided, toolkit, checkIns].map(cardStyle);
    assert.equal(styles[0].flex, 1);
    assert.equal(styles[1].flex, 1);
    assert.equal(styles[0].minHeight, styles[1].minHeight);
    assert.ok(styles[0].minHeight >= 140 && styles[0].minHeight <= 150);
    assert.ok(styles[2].minHeight >= 110 && styles[2].minHeight <= 120);
    assert.ok(
      styles.every(
        (style) =>
          style.height === undefined &&
          style.borderRadius === styles[0].borderRadius,
      ),
    );
  }

  for (const [label, route] of shortcuts) {
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
