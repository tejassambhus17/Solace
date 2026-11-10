// Exercise the actual coordinator with deterministic native mocks.
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
function harness() {
  let release;
  let lastResponse = null;
  let responseListener;
  let clearedResponses = 0;
  let listenerRemoved = false;
  let granted = true;
  let channelImportance = 3;
  let permissionRequests = 0;
  const scheduled = [];
  const channels = [];
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const active = new Set(),
    cancelled = [],
    storage = new Map();
  let calls = 0;
  const notifications = {
    AndroidImportance: { DEFAULT: 3, NONE: 0 },
    AndroidNotificationVisibility: { PRIVATE: 0 },
    SchedulableTriggerInputTypes: {
      DAILY: "daily",
      WEEKLY: "weekly",
      TIME_INTERVAL: "interval",
    },
    setNotificationChannelAsync: async (id, options) => {
      channels.push({ id, options });
    },
    getPermissionsAsync: async () => ({ granted }),
    getNotificationChannelAsync: async () => ({
      importance: channelImportance,
    }),
    getAllScheduledNotificationsAsync: async () =>
      [...active].map((identifier) => ({ identifier })),
    requestPermissionsAsync: async () => {
      permissionRequests++;
      return { granted };
    },
    scheduleNotificationAsync: async (options) => {
      scheduled.push(options);
      const n = ++calls;
      const id = n === 1 ? await held : `new-${n}`;
      active.add(id);
      return id;
    },
    cancelAllScheduledNotificationsAsync: async () => {
      active.clear();
    },
    cancelScheduledNotificationAsync: async (id) => {
      cancelled.push(id);
      active.delete(id);
    },
    setNotificationHandler: () => {},
    addNotificationResponseReceivedListener: (listener) => {
      responseListener = listener;
      return {
        remove: () => {
          listenerRemoved = true;
        },
      };
    },
    getLastNotificationResponse: () => lastResponse,
    clearLastNotificationResponse: () => {
      lastResponse = null;
      clearedResponses++;
    },
  };
  const storageMock = {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => {
      storage.set(key, value);
    },
    removeItem: async (key) => {
      storage.delete(key);
    },
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../src/notifications.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const routesModule = { exports: {} };
  new Function(
    "exports",
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/routes.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
  )(routesModule.exports);
  const module = { exports: {} };
  const requireMock = (name) => {
    if (name === "react-native") return { Platform: { OS: "android" } };
    if (name === "expo-notifications") return notifications;
    if (name === "@react-native-async-storage/async-storage")
      return storageMock;
    if (name === "./routes") return routesModule.exports;
    throw Error(`Unexpected dependency: ${name}`);
  };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: requireMock,
    Promise,
    Error,
    JSON,
    Object,
    Set,
    Array,
  });
  return {
    api: module.exports,
    release,
    active,
    cancelled,
    storage,
    calls: () => calls,
    scheduled,
    channels,
    setPermission: (allowed) => {
      granted = allowed;
    },
    setChannelBlocked: (blocked) => {
      channelImportance = blocked ? 0 : 3;
    },
    permissionRequests: () => permissionRequests,
    setLastResponse: (response) => {
      lastResponse = response;
    },
    emitResponse: (response) => responseListener(response),
    clearedResponses: () => clearedResponses,
    listenerRemoved: () => listenerRemoved,
  };
}
const reminder = {
  id: "daily",
  type: "checkin",
  title: "Check in",
  hour: 20,
  minute: 0,
  days: [1],
  enabled: true,
};

test("saved reminder preferences only count as scheduled when device permission and IDs are current", async () => {
  const h = harness();
  h.release("active");
  await h.api.restoreDeviceReminders("owner", [reminder]);
  let delivery = await h.api.readReminderDelivery("owner");
  assert.equal(delivery.permission, "allowed");
  assert.deepEqual([...delivery.scheduled], [reminder.id]);

  h.setPermission(false);
  delivery = await h.api.readReminderDelivery("owner");
  assert.equal(delivery.permission, "blocked");
  assert.equal(delivery.scheduled.size, 0);

  h.setPermission(true);
  h.setChannelBlocked(true);
  assert.equal(await h.api.readReminderPermission(), "blocked");
  await assert.rejects(
    h.api.scheduleReminder(reminder),
    /Notifications are not allowed/,
  );

  h.setChannelBlocked(false);
  h.active.clear();
  delivery = await h.api.readReminderDelivery("owner");
  assert.equal(delivery.permission, "allowed");
  assert.equal(delivery.scheduled.size, 0);
});

function loadHelper(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (name in dependencies) return dependencies[name];
        throw Error(`Unexpected dependency: ${name}`);
      },
    },
  );
  return exports;
}

test("the shared reminder field accepts typed or pasted HH:MM and rejects invalid times", () => {
  const exports = loadHelper("../src/reminder-time.ts");
  assert.equal(exports.formatReminderTime("0830"), "08:30");
  assert.equal(exports.formatReminderTime("19:15"), "19:15");
  assert.equal(exports.formatReminderTime("08:"), "08");
  assert.equal(exports.formatReminderTime("083"), "08:3");
  assert.equal(exports.validReminderTime("00:00"), true);
  assert.equal(exports.validReminderTime("23:59"), true);
  assert.equal(exports.validReminderTime("24:00"), false);
  assert.equal(exports.validReminderTime("13:60"), false);
});

test("the reminder picker round-trips every clock minute and formats midnight and noon", () => {
  const clock = loadHelper("../src/reminder-time.ts");
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      const time = { hour, minute };
      const selected = clock.toReminderClock12(time);
      assert.ok(selected.hour >= 1 && selected.hour <= 12);
      assert.equal(selected.period, hour < 12 ? 0 : 1);
      const restored = clock.fromReminderClock12(selected);
      assert.equal(restored.hour, hour);
      assert.equal(restored.minute, minute);
    }
  }
  assert.equal(clock.reminderClockLabel({ hour: 0, minute: 0 }), "12:00 AM");
  assert.equal(clock.reminderClockLabel({ hour: 12, minute: 0 }), "12:00 PM");
  assert.equal(clock.reminderClockLabel({ hour: 20, minute: 30 }), "08:30 PM");
});

test("Gentle Reminders commits picker values and repeat days with the actual native scheduling helper", async () => {
  const clock = loadHelper("../src/reminder-time.ts");
  const h = harness();
  h.release("first-alert");
  const { isMatchingReminder, saveReminder } = loadHelper(
    "../src/save-reminder.ts",
    {
      "react-native": { Platform: { OS: "android" } },
      "./notifications": h.api,
    },
  );
  const saved = [];
  const { id, ...record } = {
    ...reminder,
    ...clock.fromReminderClock12({ hour: 12, minute: 0, period: 0 }),
    days: [1, 3],
  };
  const input = {
    owner: "test-owner",
    id,
    record,
    save: async (value) => {
      saved.push(value);
      return { id };
    },
  };
  const result = await saveReminder(input);
  assert.equal(result.deviceScheduled, true);
  assert.equal(saved[0].hour, 0);
  assert.equal(saved[0].minute, 0);
  assert.equal(saved[0].permission, "granted");
  assert.deepEqual(saved[0].days, [1, 3]);
  assert.equal(isMatchingReminder({ ...record, days: [3, 1] }, record), true);
  assert.deepEqual(
    h.scheduled.map(({ trigger }) => trigger.weekday),
    [2, 4],
  );
  assert.ok(
    h.scheduled.every(
      ({ content, trigger }) =>
        content.data.screen === "checkin" &&
        trigger.hour === 0 &&
        trigger.minute === 0,
    ),
  );

  const noon = {
    ...record,
    ...clock.fromReminderClock12({ hour: 12, minute: 0, period: 1 }),
  };
  await assert.rejects(
    saveReminder({
      ...input,
      editing: true,
      record: noon,
      save: async () => {
        throw new Error("Synthetic save failure");
      },
    }),
    /Synthetic save failure/,
  );
  assert.deepEqual([...h.active], ["first-alert", "new-2"]);
  assert.deepEqual(h.cancelled, ["new-3", "new-4"]);
  assert.deepEqual(
    h.scheduled.slice(2).map(({ trigger }) => trigger.hour),
    [12, 12],
  );

  const updated = await saveReminder({ ...input, record: noon, editing: true });
  assert.equal(updated.deviceScheduled, true);
  assert.equal(saved[1].id, id);
  assert.equal(saved[1].hour, 12);
  assert.deepEqual([...h.active], ["new-5", "new-6"]);
});

test("Gentle Reminders web preferences do not claim delivery", async () => {
  const { saveReminder } = loadHelper("../src/save-reminder.ts", {
    "react-native": { Platform: { OS: "web" } },
    "./notifications": {
      scheduleReminder: async () => ({ ids: [], permission: "web-preview" }),
    },
  });
  const result = await saveReminder({
    owner: "test-owner",
    id: "web",
    record: reminder,
    save: async () => ({ id: "web" }),
  });
  assert.equal(result.deviceScheduled, false);
  assert.match(result.message, /Open the mobile app/);
});
async function waitUntil(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw Error("Timed out waiting for mocked scheduling");
}
test("logout cancels an ID that finishes scheduling after cancellation", async () => {
  const h = harness();
  const restoring = h.api.restoreDeviceReminders("old-account", [reminder]);
  await waitUntil(() => h.calls() === 1);
  await h.api.cancelAllReminders();
  h.release("old-pending");
  await restoring;
  assert.deepEqual([...h.active], []);
  assert.deepEqual(h.cancelled, ["old-pending"]);
  assert.equal(h.storage.has("solace.device-reminders.old-account"), false);
});
test("old restore cleanup preserves a newer account schedule", async () => {
  const h = harness();
  const oldRestore = h.api.restoreDeviceReminders("old-account", [reminder]);
  await waitUntil(() => h.calls() === 1);
  await h.api.restoreDeviceReminders("new-account", [reminder]);
  assert.equal(h.active.has("new-2"), true);
  h.release("old-pending");
  await oldRestore;
  assert.deepEqual([...h.active], ["new-2"]);
  assert.deepEqual(h.cancelled, ["old-pending"]);
  assert.deepEqual(
    JSON.parse(h.storage.get("solace.device-reminders.new-account")),
    { daily: ["new-2"] },
  );
});

test("a manual reminder that completes after logout is cancelled and rejects success", async () => {
  const h = harness();
  const pending = h.api.scheduleReminder(reminder);
  await waitUntil(() => h.calls() === 1);
  await h.api.cancelAllReminders();
  h.release("manual-pending");
  await assert.rejects(pending, /session changed/);
  assert.deepEqual([...h.active], []);
  assert.deepEqual(h.cancelled, ["manual-pending"]);
});

test("stale manual scheduling only cancels its own ID after another account restores", async () => {
  const h = harness();
  const pending = h.api.scheduleReminder(reminder);
  await waitUntil(() => h.calls() === 1);
  await h.api.restoreDeviceReminders("new-account", [reminder]);
  h.release("manual-pending");
  await assert.rejects(pending, /session changed/);
  assert.deepEqual([...h.active], ["new-2"]);
  assert.deepEqual(h.cancelled, ["manual-pending"]);
});

test("a pending test notification cannot survive logout", async () => {
  const h = harness();
  const pending = h.api.testNotification();
  await waitUntil(() => h.calls() === 1);
  await h.api.cancelAllReminders();
  h.release("test-pending");
  await assert.rejects(pending, /session changed/);
  assert.deepEqual([...h.active], []);
  assert.deepEqual(h.cancelled, ["test-pending"]);
});

const checkinResponse = (date) => ({
  actionIdentifier: "default",
  notification: {
    date,
    request: {
      identifier: "weekly-checkin",
      content: { data: { screen: "checkin" } },
    },
  },
});

test("a queued response callback cannot navigate after subscription cleanup", () => {
  const h = harness();
  const routes = [];
  const unsubscribe = h.api.subscribeNotificationNavigation((route) =>
    routes.push(route),
  );
  unsubscribe();
  h.emitResponse(checkinResponse(1));
  assert.equal(h.listenerRemoved(), true);
  assert.deepEqual(routes, []);
});

test("the launch cache and tap listener route a delivery once, and later weekly deliveries still route", () => {
  const h = harness();
  const routes = [];
  const response = checkinResponse(1);
  h.setLastResponse(response);
  const unsubscribe = h.api.subscribeNotificationNavigation((route) =>
    routes.push(route),
  );
  h.emitResponse(response);
  unsubscribe();
  h.api.subscribeNotificationNavigation((route) => routes.push(route));
  assert.deepEqual(routes, ["checkin"]);
  assert.equal(h.clearedResponses(), 1);
  h.setLastResponse(checkinResponse(2));
  h.emitResponse(checkinResponse(2));
  assert.deepEqual(routes, ["checkin", "checkin"]);
  assert.equal(h.clearedResponses(), 2);
});

test("an editor waits for restoration and parallel map changes preserve each reminder", async () => {
  const h = harness();
  const restoring = h.api.restoreDeviceReminders("account", [reminder]);
  await waitUntil(() => h.calls() === 1);
  const manual = h.api.scheduleReminder(reminder);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.calls(), 1);
  h.release("restored");
  await restoring;
  const scheduled = await manual;
  await Promise.all([
    h.api.rememberDeviceSchedule("account", "second", scheduled.ids),
    h.api.rememberDeviceSchedule("account", "third", ["third-id"]),
  ]);
  const saved = h.storage.get("solace.device-reminders.account");
  assert.deepEqual(JSON.parse(saved), {
    daily: ["restored"],
    second: ["new-2"],
    third: ["third-id"],
  });
  await h.api.rememberDeviceSchedule("account", "second", []);
  assert.equal(
    Object.hasOwn(
      JSON.parse(h.storage.get("solace.device-reminders.account")),
      "second",
    ),
    false,
  );
});

test("habit reminders replace old IDs, target the habit, and cancel when paused", async () => {
  const h = harness();
  const input = {
    ...reminder,
    type: "habit",
    habitId: "morning-walk",
    days: [0],
  };
  const first = h.api.syncHabitDeviceReminder(
    "account",
    "habit:morning-walk",
    input,
    true,
  );
  await waitUntil(() => h.calls() === 1);
  h.release("habit-first");
  assert.equal(await first, "granted");
  assert.equal(h.scheduled[0].content.data.screen, "habit-details");
  assert.equal(h.scheduled[0].content.data.id, "morning-walk");
  assert.equal(h.scheduled[0].trigger.weekday, 1);
  assert.equal(h.channels[0].id, "wellness");
  assert.equal(Object.hasOwn(h.channels[0].options, "sound"), false);
  await h.api.syncHabitDeviceReminder(
    "account",
    "habit:morning-walk",
    { ...input, hour: 7 },
    false,
  );
  assert.deepEqual([...h.active], ["new-2"]);
  assert.equal(h.scheduled[1].trigger.hour, 7);
  assert.deepEqual(h.cancelled, ["habit-first"]);
  await h.api.syncHabitDeviceReminder(
    "account",
    "habit:morning-walk",
    null,
    false,
  );
  assert.deepEqual([...h.active], []);
  assert.equal(h.storage.has("solace.device-reminders.account"), false);
});

test("restore and resume respect denied permission until the user requests it", async () => {
  const h = harness();
  h.setPermission(false);
  await h.api.restoreDeviceReminders("account", [reminder]);
  const input = { ...reminder, type: "habit", habitId: "walk" };
  await assert.rejects(
    h.api.syncHabitDeviceReminder("account", "habit:walk", input, false),
    /not allowed/,
  );
  assert.equal(h.permissionRequests(), 0);
  await assert.rejects(
    h.api.syncHabitDeviceReminder("account", "habit:walk", input, true),
    /not allowed/,
  );
  assert.equal(h.permissionRequests(), 1);
  assert.equal(h.calls(), 0);
});

test("a notification opens a validated habit destination once", () => {
  const h = harness();
  const hits = [];
  h.api.subscribeNotificationNavigation((route, params) =>
    hits.push([route, params?.id]),
  );
  const response = checkinResponse(1);
  response.notification.request.content.data = {
    screen: "habit-details",
    id: "bad/path",
  };
  h.emitResponse(response);
  response.notification.request.content.data.id = "safe-habit";
  h.emitResponse(response);
  h.emitResponse(response);
  assert.deepEqual(hits, [["habit-details", "safe-habit"]]);
});
