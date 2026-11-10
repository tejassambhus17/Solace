const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  });
  new Function("module", "exports", "require", outputText)(
    module,
    module.exports,
    (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  );
  return module.exports;
}

const routeModule = load("src/routes.ts");
const contract = load("server/src/companion-app-action.ts");
const date = "2026-11-08";
const now = new Date(`${date}T12:00:00Z`);
const actionId = (n = 0) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const habitContract = load("server/src/habit-contract.ts");
const content = {
  localDay: (value = now) => value.toISOString().slice(0, 10),
  recordDay: (record) => record.day,
};
const actionsModule = load("src/companion-actions.ts", {
  "../server/src/habit-contract": habitContract,
  "../server/src/timed-practice-contract": load(
    "server/src/timed-practice-contract.ts",
  ),
  "./content": content,
  "./explore-practices": load("src/explore-practices.ts", {
    "./routes": routeModule,
  }),
  "./progress": load("src/progress.ts", { "./content": content }),
  "./routes": routeModule,
});
const { routes } = routeModule;
const { habitCompletion, habitCompletionSummary, openCompanionDestination } =
  actionsModule;
const makeHabit = (id, status = "active", schedule = { type: "daily" }) => {
  const goal = { type: "quantity", target: 8, unit: "glasses" };
  return {
    id,
    name: "Drink water",
    timeZone: "UTC",
    status,
    goal,
    schedule,
    revisions: [{ day: "2026-11-01", status, goal, schedule }],
  };
};

test("all advertised destinations resolve to registered routes and proper tab roots", () => {
  const root = fs.readFileSync("App.tsx", "utf8");
  for (const destination of contract.appActionDestinations) {
    const called = [];
    openCompanionDestination(
      {
        navigate: (...args) => called.push(args),
        switchSolaceMode: (...args) => called.push(args),
      },
      {
        kind: "navigate",
        id: actionId(),
        destination,
      },
      "chat-1",
      now,
    );
    assert.ok(called.length, destination);
    for (const [route] of called) {
      assert.ok(
        Object.values(routes).includes(route) || root.includes(`"${route}"`),
        route,
      );
    }
    if (
      [
        "appearance",
        "wellness-goals",
        "reminders",
        "privacy",
        "support",
      ].includes(destination)
    )
      assert.equal(called[0][0], routes.profile);
    if (
      ["ambient-mixer", "habit-insights", "wellness-toolkit"].includes(
        destination,
      )
    )
      assert.equal(called[0][0], routes.explore);
  }
});

test("requested Journal date, Journey range and timed practice use existing navigation", () => {
  const called = [];
  const app = { navigate: (...args) => called.push(args) };
  openCompanionDestination(
    app,
    { kind: "journal-search", when: "yesterday" },
    undefined,
    now,
  );
  openCompanionDestination(
    app,
    { kind: "progress", period: "month" },
    undefined,
    now,
  );
  openCompanionDestination(
    app,
    {
      id: actionId(),
      kind: "practice-start",
      practice: "breathing",
      minutes: 5,
    },
    undefined,
    now,
  );
  assert.deepEqual(called.slice(0, 2), [
    [routes.journal, { entryDay: "2026-11-07", entryTitle: undefined }],
    [routes.journey, { period: "month" }],
  ]);
  const [route, { activity, originActionId }] = called[2];
  assert.equal(route, routes.momentPlayer);
  assert.equal(activity.type, "breathing");
  assert.equal(activity.durationSec, 300);
  assert.equal(originActionId, actionId());
});

test("completion targets the owned scheduled occurrence and uses its revision", () => {
  const partial = {
    habitId: "owned",
    day: date,
    revision: 3,
    amount: 5,
    complete: false,
  };
  const data = {
    habits: [
      makeHabit("owned"),
      makeHabit("paused", "paused"),
      makeHabit("weekdays", "active", {
        type: "weekdays",
        days: [1, 2, 3, 4, 5],
      }),
    ],
    habitProgress: [partial],
  };
  assert.deepEqual(habitCompletion(data, "owned", now).write, {
    day: date,
    expectedRevision: 3,
    amount: 8,
  });
  for (const id of ["foreign", "paused", "weekdays"])
    assert.throws(() => habitCompletion(data, id, now));
  const completed = { ...partial, day: "2026-11-07", complete: true };
  data.habitProgress.push(completed, completed, {
    ...completed,
    habitId: "foreign",
  });
  assert.equal(habitCompletionSummary(data, "week", now), 1);
});

function fixture() {
  let index = 0;
  const states = [];
  const effects = [];
  const calls = [];
  const react = {
    useRef(value) {
      return states[index++] ?? (states[index - 1] = { current: value });
    },
    useState(value) {
      const slot = index++;
      if (!(slot in states)) states[slot] = value;
      return [
        states[slot],
        (next) => {
          states[slot] = next;
        },
      ];
    },
    useEffect(effect, keys) {
      const slot = index++;
      if (keys.some((key, i) => key !== states[slot]?.[i])) {
        effects.push(() => {
          states[slot]?.dispose?.();
          states[slot] = Object.assign([...keys], { dispose: effect() });
        });
      }
    },
  };
  const { useCompanionActions } = load("src/screens/CompanionAppActions.tsx", {
    react,
    "react-native": {
      Keyboard: { dismiss() {} },
      StyleSheet: { create: (styles) => styles },
    },
    "react-native-safe-area-context": {},
    "../../server/src/companion-app-action": contract,
    "../companion-actions": actionsModule,
    "../habits-ui": {
      goalLabel: () => "8 glasses",
      scheduleLabel: () => "Daily",
    },
    "../layout": { spacing: {} },
    "../reminder-time": load("src/reminder-time.ts"),
    "../routes": routeModule,
    "../save-reminder": {
      isMatchingReminder: () => false,
      saveReminder: async ({ id, record, save }) => {
        await save({ id, ...record });
        return {
          message:
            "Preferences saved. Open the mobile app to schedule delivery.",
        };
      },
    },
    "../theme": {
      useTheme: () => ({
        saveMode: async (mode) => calls.push(["theme", mode]),
      }),
    },
    "../technique-artwork": { techniqueArtwork: {} },
    "../ui": {},
    "./SolaceRecommendationCard": {},
  });
  const app = {
    user: { id: "owner" },
    token: "test-token",
    data: { reminders: [], habits: [], habitProgress: [] },
    createHabit: async (draft, id) => {
      calls.push(["create", draft, id]);
      return { habit: { name: draft.name } };
    },
    save: async (...args) => calls.push(args),
    navigate: (...args) => calls.push(args),
  };
  const options = {};
  function render() {
    index = 0;
    const value = useCompanionActions(app, options);
    for (const effect of effects.splice(0)) effect();
    return value;
  }
  return { app, calls, options, render };
}

const flush = () => new Promise(setImmediate);

test("a reviewed one-minute practice closes voice before pushing the player onto the conversation", async () => {
  const { app, calls, options, render } = fixture();
  const conversationId = "current-chat";
  const originCheckinId = "saved-checkin";
  app.params = { originCheckinId };
  options.beforeNavigation = () => calls.push(["close-voice"]);
  options.verifyConfirmation = async (id) => calls.push(["verify", id]);
  const action = {
    id: actionId(90),
    kind: "practice-start",
    practice: "breathing",
    minutes: 1,
  };
  render().receive(action, conversationId);
  assert.equal(render().prompt.practice.durationSec, 60);
  assert.equal(render().prompt.choices[0].label, "Start practice");
  assert.deepEqual(calls, []);
  const confirm = { id: actionId(91), kind: "confirm", targetId: action.id };
  render().receive(confirm, conversationId);
  render().receive(confirm, conversationId);
  await flush();
  assert.deepEqual(calls.slice(0, 2), [["verify", action.id], ["close-voice"]]);
  assert.equal(calls.length, 3);
  const [route, params] = calls[2];
  assert.equal(route, routes.momentPlayer);
  assert.equal(params.conversationId, conversationId);
  assert.equal(params.originCheckinId, originCheckinId);
  assert.equal(params.originActionId, action.id);
  assert.equal(params.startOnArrival, true);
  assert.equal(params.activity.durationSec, 60);
  assert.equal(render().prompt, undefined);
});

test("a cancelled practice offer and an interrupted voice approval cannot open the player", async () => {
  const { calls, options, render } = fixture();
  const action = {
    id: actionId(92),
    kind: "practice-start",
    practice: "grounding",
    minutes: 5,
  };
  render().receive(action, "thread");
  assert.equal(render().prompt.title, "Five Senses");
  render().close();
  render().receive(
    { id: actionId(93), kind: "confirm", targetId: action.id },
    "thread",
  );
  assert.deepEqual(calls, []);
  options.verifyConfirmation = async () => {
    throw new Error("Voice is interrupted");
  };
  render().receive({ ...action, id: actionId(94) }, "thread");
  render().confirm(0);
  await flush();
  assert.deepEqual(calls, []);
  assert.match(render().prompt.description, /interrupted/);
});

test("habit creation requires one explicit confirmation and a repeated ID does not execute twice", async () => {
  const { render, calls } = fixture();
  const request = {
    id: actionId(1),
    kind: "habit-create",
    name: "Read a book",
    schedule: "weekends",
  };
  render().receive(request);
  assert.equal(render().prompt.title, "Create habit?");
  assert.deepEqual(calls, []);
  render().confirm(0);
  render().confirm(0);
  await flush();
  render().receive(request);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "create");
  assert.deepEqual(calls[0][1].schedule.days, [0, 6]);
  assert.equal(calls[0][2], `companion-${request.id}`);
  assert.match(render().prompt.description, /saved to My Habits/);
});

test("cancellation, account switches, invalid routes and cancelled voice checks cannot write", async () => {
  const { app, calls, options, render } = fixture();
  const request = {
    id: actionId(2),
    kind: "reminder-create",
    title: "Meditate",
    repeat: "daily",
    time: "20:30",
  };
  render().receive(request);
  assert.equal(render().cancelPending(), true);
  render().confirm(0);
  render().receive({ ...request, id: actionId(3) });
  app.user = { id: "different" };
  render().confirm(0);
  render().receive({
    id: actionId(4),
    kind: "navigate",
    destination: "https://example.test",
  });
  options.verifyConfirmation = async () => {
    throw new Error("Voice request cancelled");
  };
  render().receive({ ...request, id: actionId(5) });
  render().confirm(0);
  await flush();
  assert.deepEqual(calls, []);
  assert.match(render().prompt.description, /cancelled/);
});

test("an old confirmation control cannot approve a replacement proposal", async () => {
  const { calls, render } = fixture();
  const first = {
    id: actionId(9),
    kind: "habit-create",
    name: "Read",
    schedule: "daily",
  };
  render().receive(first);
  const oldConfirm = render().confirm;
  render().receive({ ...first, id: actionId(10), name: "Walk" });
  oldConfirm(0);
  await flush();
  assert.deepEqual(calls, []);
  assert.match(render().prompt.description, /Walk/);
});

test("spoken or typed approval can only save the matching proposal in its conversation", async () => {
  const { calls, options, render } = fixture();
  const proposal = {
    id: actionId(12),
    kind: "habit-create",
    name: "Walk",
    schedule: "daily",
  };
  const approval = { id: actionId(13), kind: "confirm", targetId: proposal.id };
  const results = [];
  options.onResult = (id, result) => results.push([id, result]);
  render().receive(proposal, "first");
  render().receive(approval, "another");
  await flush();
  assert.deepEqual(calls, []);
  const retryProposal = { ...proposal, id: actionId(14) };
  render().receive(retryProposal, "first");
  const retryApproval = {
    ...approval,
    id: actionId(15),
    targetId: retryProposal.id,
  };
  render().receive(retryApproval, "first");
  render().receive(retryApproval, "first");
  await flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(results, [
    [retryProposal.id, { ok: true, message: "“Walk” was saved to My Habits." }],
  ]);
});

test("reminder and appearance show actual persistence outcomes", async () => {
  const { app, calls, render } = fixture();
  render().receive({
    id: actionId(6),
    kind: "reminder-create",
    title: "Meditate",
    repeat: "weekdays",
    time: "20:30",
  });
  assert.match(render().prompt.description, /08:30 PM.*Weekdays/);
  render().confirm(0);
  await flush();
  assert.deepEqual(calls[0][1].days, [1, 2, 3, 4, 5]);
  assert.equal(calls[0][1].hour, 20);
  assert.match(render().prompt.description, /Open the mobile app/);
  render().receive({ id: actionId(7), kind: "theme", mode: "dark" });
  await flush();
  assert.deepEqual(calls[1], ["theme", "dark"]);
  assert.match(render().prompt.description, /Switched to dark mode/);
  app.createHabit = async () => {
    throw new Error("Network lost");
  };
  render().receive({
    id: actionId(8),
    kind: "habit-create",
    name: "Read",
    schedule: "daily",
  });
  render().confirm(0);
  await flush();
  assert.equal(render().prompt.error, "Network lost");
  app.createHabit = async (draft, id) => {
    calls.push(["create", draft, id]);
    return { habit: { name: draft.name } };
  };
  render().confirm(0);
  await flush();
  assert.equal(calls.at(-1)[2], `companion-${actionId(8)}`);
});
