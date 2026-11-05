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
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const active = new Set(),
    cancelled = [],
    storage = new Map();
  let calls = 0;
  const notifications = {
    AndroidImportance: { DEFAULT: 3 },
    AndroidNotificationVisibility: { PRIVATE: 0 },
    SchedulableTriggerInputTypes: {
      WEEKLY: "weekly",
      TIME_INTERVAL: "interval",
    },
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    scheduleNotificationAsync: async () => {
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
  const module = { exports: {} };
  const requireMock = (name) => {
    if (name === "react-native") return { Platform: { OS: "android" } };
    if (name === "expo-notifications") return notifications;
    if (name === "@react-native-async-storage/async-storage")
      return storageMock;
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
