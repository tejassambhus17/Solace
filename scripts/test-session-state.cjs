// Exercise the real account provider with deterministic hooks, storage and transport.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness(options = {}) {
  const slots = [];
  const effects = [];
  const appStateListeners = new Set();
  const storage = options.storage || new Map();
  const legacyStorage = options.legacyStorage || new Map();
  let cursor = 0;
  let heldWrite = null;
  let current;
  const h = {
    storage,
    appState(state) {
      for (const listener of appStateListeners) listener(state);
    },
    onRequest: async (route) => {
      throw Error(`Unexpected request: ${route}`);
    },
    holdNextCredentialWrite() {
      const wait = deferred();
      heldWrite = wait;
      return wait;
    },
  };
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    createElement: (type, props) => ({ type, props }),
    useContext: () => current,
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useMemo(factory) {
      return factory();
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        effects.push(() => {
          old?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const storageMock = {
    getItem: async (key) => storage.get(key) ?? null,
    async setItem(key, value) {
      if (heldWrite) {
        const wait = heldWrite;
        heldWrite = null;
        wait.started = true;
        await wait.promise;
      }
      storage.set(key, value);
    },
    removeItem: async (key) => {
      storage.delete(key);
    },
  };
  const compile = (file) =>
    ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;
  const compiled = compile("../src/store.tsx");
  const offline = { exports: {} };
  new Function("module", "exports", compile("../src/offline.ts"))(
    offline,
    offline.exports,
  );
  const apiConfig = { exports: {} };
  new Function("module", "exports", compile("../src/api-config.ts"))(
    apiConfig,
    apiConfig.exports,
  );
  const routes = { exports: {} };
  new Function("module", "exports", compile("../src/routes.ts"))(
    routes,
    routes.exports,
  );
  const module = { exports: {} };
  const deviceLock = { exports: {} };
  const journalRecord = { exports: {} };
  const requireMock = (name) => {
    if (name === "react") return react;
    if (name === "react-native")
      return {
        Platform: { OS: options.platform || "web" },
        AppState: {
          addEventListener: (_type, callback) => {
            appStateListeners.add(callback);
            return { remove: () => appStateListeners.delete(callback) };
          },
        },
      };
    if (name === "@react-native-async-storage/async-storage")
      return storageMock;
    if (name === "expo-secure-store")
      return {
        getItemAsync: async (key, settings) => {
          if (h.failSecureGet?.(key))
            throw Error("Protected device storage unavailable");
          if (settings?.requireAuthentication) {
            h.biometricReads = (h.biometricReads || 0) + 1;
            if (h.biometricError) throw Error(h.biometricError);
            if (h.biometricRead) await h.biometricRead;
            if (h.biometricInvalidated) return null;
          }
          return storageMock.getItem(key);
        },
        setItemAsync: async (key, value, settings) => {
          if (settings?.requireAuthentication) {
            h.biometricWrites = (h.biometricWrites || 0) + 1;
            if (h.biometricError) throw Error(h.biometricError);
          }
          if (h.failSecureSet?.(key))
            throw Error("Protected device storage unavailable");
          await storageMock.setItem(key, value);
        },
        deleteItemAsync: async (key) => {
          if (h.failSecureRemove?.(key))
            throw Error("Protected device storage unavailable");
          await storageMock.removeItem(key);
        },
        canUseBiometricAuthentication: () => h.biometricUsable !== false,
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: "unlocked-this-device",
      };
    if (name === "expo-local-authentication")
      return {
        hasHardwareAsync: async () => h.biometricHardware !== false,
        isEnrolledAsync: async () => h.biometricEnrolled !== false,
        getEnrolledLevelAsync: async () => h.biometricLevel ?? 3,
        SecurityLevel: { BIOMETRIC_STRONG: 3 },
      };
    if (name === "./offline") return offline.exports;
    if (name === "./api-config") return apiConfig.exports;
    if (name === "./routes") return routes.exports;
    if (name === "./device-lock") return deviceLock.exports;
    if (name === "./journal-record") return journalRecord.exports;
    throw Error(`Unexpected dependency: ${name}`);
  };
  new Function(
    "module",
    "exports",
    "require",
    compile("../src/device-lock.ts"),
  )(deviceLock, deviceLock.exports, requireMock);
  new Function("module", "exports", compile("../src/journal-record.ts"))(
    journalRecord,
    journalRecord.exports,
  );
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: requireMock,
    process: { env: { EXPO_PUBLIC_API_URL: options.apiUrl } },
    window: {
      sessionStorage: {
        ...storageMock,
        getItem: (key) => storage.get(key) ?? null,
      },
      localStorage: {
        getItem: (key) => legacyStorage.get(key) ?? null,
        removeItem: (key) => legacyStorage.delete(key),
      },
      location: { hostname: "localhost" },
      addEventListener() {},
      removeEventListener() {},
    },
    __DEV__: options.development ?? true,
    AbortController,
    Date: class extends Date {
      static now() {
        return h.now ?? Date.now();
      }
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async (url, options) => {
      h.lastRequestUrl = String(url);
      return h.onRequest(new URL(url).pathname.replace(/^\/api/, ""), options);
    },
  });
  h.render = () => {
    cursor = 0;
    current = module.exports.AppProvider({ children: null }).props.value;
    for (const effect of effects.splice(0)) effect();
    return current;
  };
  h.close = () => {
    for (const slot of slots) slot?.cleanup?.();
  };
  h.render();
  return h;
}
const ok = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
const empty = () => ({
  checkins: [],
  conversations: [],
  sessions: [],
  reflections: [],
  assessments: [],
  memories: [],
  reminders: [],
  plans: [],
  favorites: [],
});
const accountTransport =
  (id, token, data = empty()) =>
  async (route) => {
    if (route === "/auth/login" || route === "/auth/register")
      return ok({ token, user: { id, name: id } });
    if (route === "/state") return ok({ user: { id, name: id }, data });
    if (route === "/auth/logout") return ok({ ok: true });
    throw Error(`Unexpected request: ${route}`);
  };
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}
async function until(predicate) {
  for (let i = 0; i < 30; i++) {
    if (predicate()) return;
    await settle();
  }
  throw Error("Mock did not reach expected state");
}
async function signedIn(id = "account-a") {
  const h = harness();
  await settle();
  h.onRequest = accountTransport(id, `token-${id}`);
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.render();
  return h;
}

function habitViews(readApp) {
  const now = new Date("2026-11-09T12:00:00Z");
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now.getTime()]));
    }
  }
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...props, children },
    }),
    useMemo: (factory) => factory(),
    useState: (initial) => [
      typeof initial === "function" ? initial() : initial,
      () => {},
    ],
    useRef: (current) => ({ current }),
    useEffect: () => {},
  };
  const hosts = (...names) =>
    Object.fromEntries(names.map((name) => [name, name]));
  const dependencies = {
    react,
    "react-native": {
      ...hosts("ActivityIndicator", "Image", "Pressable", "ScrollView", "View"),
      Platform: { OS: "android" },
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      useWindowDimensions: () => ({ width: 360, fontScale: 1 }),
    },
    "expo-haptics": {},
    "../store": { useApp: readApp },
    "./theme": { useTheme: () => ({ colors: {}, resolved: "light" }) },
    "./ui": hosts("AppText", "Icon"),
    "../ui": hosts("AppText", "Button", "Card", "Icon", "Input", "Screen"),
    "../theme": { useTheme: () => ({ colors: {}, resolved: "light" }) },
    "./Companion": { useReducedMotion: () => true },
    "./HabitsEditor": {},
    "./HabitsInsights": {},
  };
  function load(file) {
    const filename = path.join(__dirname, file);
    const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;
    const module = { exports: {} };
    new Function("module", "exports", "require", "Date", result)(
      module,
      module.exports,
      (name) => {
        if (name in dependencies) return dependencies[name];
        if (/\.(jpg|png)$/.test(name)) return name;
        throw Error(`Unexpected Habit component dependency: ${name}`);
      },
      FixedDate,
    );
    return module.exports;
  }
  const contract = load("../server/src/habit-contract.ts");
  dependencies["../server/src/habit-contract"] = contract;
  dependencies["../../server/src/habit-contract"] = contract;
  dependencies["../routes"] = load("../src/routes.ts");
  dependencies["../layout"] = load("../src/layout.ts");
  dependencies["../habits-ui"] = {
    ...load("../src/habits-ui.tsx"),
    GardenScene: "GardenScene",
  };
  const { TodayHabits, HabitJourneyEntry } = load(
    "../src/screens/HabitEntryPoints.tsx",
  );
  const { HabitsScreen } = load("../src/screens/Habits.tsx");

  function render(element) {
    const controls = [];
    const text = [];
    function visit(node) {
      if (Array.isArray(node)) node.forEach(visit);
      else if (typeof node === "string" || typeof node === "number")
        text.push(String(node));
      else if (node && typeof node.type === "function")
        visit(node.type(node.props));
      else if (node?.props) {
        if (node.props.onPress) controls.push(node.props);
        visit(node.props.children);
      }
    }
    visit(element);
    return {
      text: text.join(" "),
      labels: controls.map((control) => control.accessibilityLabel),
      press(label) {
        const control = controls.find(
          (item) => item.accessibilityLabel === label,
        );
        assert.ok(control, `Missing habit action: ${label}`);
        assert.ok(!control.disabled, `Habit action is disabled: ${label}`);
        return control.onPress();
      },
    };
  }
  return {
    today: () => render(TodayHabits({})),
    dashboard: () =>
      render(HabitsScreen({ name: dependencies["../routes"].routes.habits })),
    journey: (props = {}) =>
      render(
        HabitJourneyEntry({
          now,
          period: "week",
          startDay: "2026-11-09",
          endDay: "2026-11-09",
          today: "2026-11-09",
          style: {},
          mutedColor: "#626B5D",
          ...props,
        }),
      ),
  };
}

function dailyHabit(id, name = id, schedule = { type: "daily" }) {
  const goal = { type: "completion" };
  const status = "active";
  return {
    id,
    name,
    timeZone: "UTC",
    category: "movement",
    icon: "walk",
    color: "sage",
    reminderTime: null,
    goal,
    schedule,
    status,
    revisions: [{ day: "2026-11-09", status, goal, schedule }],
  };
}

test("Google completion uses the shared secure session and clears a previous account", async (t) => {
  const h = harness({ platform: "android" });
  t.after(() => h.close());
  await settle();
  h.onRequest = accountTransport("first", "token-first");
  await h.render().signIn("first@example.test", "test-only-password");
  h.render().setChatDraft("new", "First account private draft");
  const transport = async (route, options) => {
    if (route === "/auth/google/complete") {
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(JSON.parse(options.body).id, "synthetic-flow");
      return ok({ token: "token-google", user: { id: "google-owner" } });
    }
    assert.equal(options.headers.Authorization, "Bearer token-google");
    return accountTransport("google-owner", "token-google")(route);
  };
  h.onRequest = transport;
  await h.render().googleLogin({
    id: "synthetic-flow",
    verifier: "test-proof",
    handoff: "test-browser-proof",
  });
  assert.equal(h.render().user.id, "google-owner");
  assert.equal(h.render().chatDrafts.new, undefined);
  assert.equal(h.storage.get("solace.session"), "token-google");
  const restarted = harness({ platform: "android", storage: h.storage });
  t.after(() => restarted.close());
  restarted.onRequest = transport;
  await until(() => restarted.render().user?.id === "google-owner");
  await restarted.render().signOut();
  assert.equal(h.storage.has("solace.session"), false);
});

test("browser preview migrates a legacy session to tab storage and erases it on logout", async (t) => {
  const legacyStorage = new Map([["solace.session", "legacy-token"]]);
  const h = harness({ legacyStorage });
  t.after(() => h.close());
  h.onRequest = accountTransport("browser-owner", "legacy-token");
  await until(() => h.render().user?.id === "browser-owner");
  assert.equal(legacyStorage.has("solace.session"), false);
  assert.equal(h.storage.get("solace.session"), "legacy-token");
  await h.render().signOut();
  assert.equal(h.storage.has("solace.session"), false);
});

test("runtime expiry preserves same-account drafts and route; a different account clears them", async () => {
  const h = await signedIn();
  h.render().navigate("reflection");
  h.render().setEditorDraft("reflection:new", {
    text: "A private draft",
    need: "Rest",
  });
  h.render().setChatDraft("new", "An unsent thought");
  h.onRequest = async () => ok({ error: "Session expired" }, 401);
  await assert.rejects(
    h.render().save("reflections", { text: "A private draft" }),
    /Session expired/,
  );
  let app = h.render();
  assert.equal(app.sessionExpired, true);
  assert.equal(app.token, null);
  assert.equal(app.route, "reflection");
  assert.equal(app.editorDrafts["reflection:new"].text, "A private draft");
  const oldSetter = app.setEditorDraft;
  h.onRequest = accountTransport("account-a", "renewed-token");
  await app.signIn("synthetic@solace.test", "test-only-password");
  app = h.render();
  assert.equal(app.sessionExpired, false);
  assert.equal(app.route, "reflection");
  assert.equal(app.chatDrafts.new, "An unsent thought");
  h.onRequest = accountTransport("account-b", "different-token");
  await app.signIn("different@solace.test", "test-only-password");
  app = h.render();
  oldSetter("reflection:new", { text: "Late private draft" });
  app = h.render();
  assert.equal(app.user.id, "account-b");
  assert.equal(app.route, "today");
  assert.equal(Object.keys(app.editorDrafts).length, 0);
  assert.equal(Object.keys(app.chatDrafts).length, 0);
});

test("an older account request cannot expire or overwrite a newer signed-in account", async () => {
  const h = await signedIn();
  const held = deferred();
  h.onRequest = async (route) =>
    route.startsWith("/records/")
      ? held.promise
      : accountTransport("account-a", "token-a")(route);
  const saving = h.render().save("reflections", { text: "Old account text" });
  const rejected = assert.rejects(saving, /Session expired/);
  h.onRequest = accountTransport("account-b", "token-b");
  await h.render().signIn("different@solace.test", "test-only-password");
  held.resolve(ok({ error: "Session expired" }, 401));
  await rejected;
  const app = h.render();
  assert.equal(app.user.id, "account-b");
  assert.equal(app.sessionExpired, false);
  assert.equal(app.token, "token-b");
});

test("account creation with failed data loading offers retry without resubmitting registration", async () => {
  const h = harness();
  await settle();
  let registrations = 0;
  h.onRequest = async (route) => {
    if (route === "/auth/register") {
      registrations++;
      return ok({ token: "new-token", user: { id: "new-account" } });
    }
    throw Error("Simulated connection failure");
  };
  await h
    .render()
    .signUp("New person", "synthetic@solace.test", "test-only-password");
  let app = h.render();
  assert.equal(app.user, null);
  assert.match(app.sessionError, /Unable to connect/);
  assert.equal(app.token, "new-token");
  h.onRequest = accountTransport("new-account", "new-token");
  await app.retrySession();
  app = h.render();
  assert.equal(registrations, 1);
  assert.equal(app.user.id, "new-account");
  assert.equal(app.sessionError, null);
});

test("a state snapshot started before a completed save cannot erase the newer record", async () => {
  const h = await signedIn();
  const held = deferred();
  h.onRequest = async (route) => {
    if (route === "/state") return held.promise;
    if (route === "/records/reflections")
      return ok({
        record: { id: "new-reflection", text: "Saved after refresh began" },
      });
    throw Error(`Unexpected request: ${route}`);
  };
  const refreshing = h.render().refresh();
  await h.render().save("reflections", { text: "Saved after refresh began" });
  held.resolve(ok({ user: { id: "account-a" }, data: empty() }));
  await refreshing;
  assert.equal(h.render().data.reflections[0].id, "new-reflection");
});

test("logout wins over a delayed device token write and cannot restore a stale session", async () => {
  const h = harness();
  await settle();
  h.onRequest = accountTransport("account-a", "stale-token");
  const held = h.holdNextCredentialWrite();
  const signingIn = h
    .render()
    .signIn("synthetic@solace.test", "test-only-password");
  const rejected = assert.rejects(signingIn, /session changed/);
  await until(() => held.started);
  const signingOut = h.render().signOut();
  held.resolve();
  await Promise.all([rejected, signingOut]);
  const app = h.render();
  assert.equal(app.user, null);
  assert.equal(app.token, null);
  assert.equal(app.busy, false);
  assert.equal(h.storage.has("solace.session"), false);
});

test("late draft completion cannot clear newer edits; logout clears all private drafts", async () => {
  const h = await signedIn();
  const first = { text: "Before save", need: "" };
  h.render().setEditorDraft("reflection:new", first);
  h.render().setEditorDraft("reflection:new", {
    text: "Newer writing",
    need: "Space",
  });
  h.render().setEditorDraft("reflection:new", null, first);
  assert.equal(h.render().editorDrafts["reflection:new"].text, "Newer writing");
  h.render().setChatDraft("new", "Private chat draft");
  await h.render().signOut();
  const app = h.render();
  assert.equal(Object.keys(app.editorDrafts).length, 0);
  assert.equal(Object.keys(app.chatDrafts).length, 0);
});

test("stale account callbacks cannot transmit writes after an account switch", async () => {
  const h = await signedIn();
  const oldApp = h.render();
  h.onRequest = accountTransport("account-b", "token-b");
  await oldApp.signIn("different@solace.test", "test-only-password");
  h.render();
  let requests = 0;
  h.onRequest = async () => {
    requests++;
    return ok({ record: { id: "must-not-exist" } });
  };
  await assert.rejects(
    oldApp.save("reflections", { text: "Old private text" }),
    /session changed/,
  );
  await assert.rejects(oldApp.signOut(), /session changed/);
  oldApp.navigate("chat", { id: "old-private-conversation" });
  oldApp.setParams({ id: "old-private-conversation" });
  oldApp.setTab("journey");
  assert.equal(requests, 0);
  assert.equal(h.render().user.id, "account-b");
  assert.equal(h.render().route, "today");
  assert.equal(Object.keys(h.render().params).length, 0);
});

test("details keep their originating tab and main destinations start a stack with their parameters", async () => {
  const h = await signedIn();
  assert.equal(h.render().activeTab, "today");
  h.render().setTab("journey");
  h.render().navigate("reflections");
  h.render().navigate("reflection");
  let app = h.render();
  assert.equal(app.activeTab, "journey");
  assert.equal(app.route, "reflection");
  assert.equal(app.canGoBack, true);
  app.back();
  app = h.render();
  assert.equal(app.route, "reflections");
  assert.equal(app.activeTab, "journey");
  app.navigate("chat", {
    id: "conversation-a",
    context: "Resume this thought",
  });
  app = h.render();
  assert.equal(app.route, "chat");
  assert.equal(app.activeTab, "chat");
  assert.equal(app.params.id, "conversation-a");
  assert.equal(app.params.context, "Resume this thought");
  assert.equal(app.canGoBack, false);
  app.navigate("breathing", { conversationId: "conversation-a" });
  h.render().navigate("feedback");
  assert.equal(h.render().activeTab, "chat");
  h.render().navigate("journey");
  app = h.render();
  assert.equal(app.activeTab, "journey");
  assert.equal(app.route, "journey");
  assert.equal(app.canGoBack, false);
  app.setTab("profile");
  h.render().navigate("settings");
  assert.equal(h.render().activeTab, "profile");
  h.render().navigate("solace", { id: "legacy-chat" });
  app = h.render();
  assert.equal(app.route, "chat");
  assert.equal(app.activeTab, "chat");
  assert.equal(app.params.id, "legacy-chat");
  app.setTab("today");
  h.render().navigate("explore");
  h.render().navigate("moments");
  h.render().navigate("grounding");
  assert.equal(h.render().activeTab, "explore");
});

test("Explore is a tab with a root and preserves its branch and view across switches", async () => {
  const h = await signedIn();
  h.render().setTab("chat");
  h.render().navigate("history");
  h.render().navigate("explore");
  const explore = h.render();
  assert.equal(explore.route, "explore");
  assert.equal(explore.activeTab, "explore");
  assert.equal(explore.canGoBack, false);
  h.render().navigate("moments");
  explore.setParams({ exploreView: { category: "Sleep", y: 240 } });
  assert.equal(h.render().params.exploreView, undefined);
  h.render().setTab("chat");
  assert.equal(h.render().route, "history");
  assert.equal(h.render().activeTab, "chat");
  h.render().setTab("explore");
  assert.equal(h.render().route, "moments");
  assert.equal(h.render().canGoBack, true);
  h.render().back();
  assert.equal(h.render().route, "explore");
  assert.equal(h.render().canGoBack, false);
  assert.equal(h.render().params.exploreView.y, 240);
  h.render().navigate("moments");
  h.render().navigate("explore");
  assert.equal(h.render().route, "explore");
  assert.equal(h.render().params.exploreView.category, "Sleep");
});

test("rapid wellness tool taps add one Explore detail and preserve its saved view on Back", async () => {
  const h = await signedIn();
  h.render().setTab("explore");
  const view = { category: "all", moreOpen: true, x: 64, y: 240 };

  for (const destination of ["techniques", "habits"]) {
    const explore = h.render();
    explore.navigate(destination);
    explore.navigate(destination);
    explore.setParams({ exploreView: view });

    const detail = h.render();
    assert.equal(detail.route, destination);
    assert.equal(detail.activeTab, "explore");
    assert.equal(detail.canGoBack, true);
    assert.equal(detail.params.exploreView, undefined);

    detail.back();
    const returned = h.render();
    assert.equal(returned.route, "explore");
    assert.equal(returned.canGoBack, false);
    assert.deepEqual(returned.params.exploreView, view);
  }
});

test("Solace modes keep their own route and Journal handoff returns to its origin", async () => {
  const h = await signedIn();
  h.render().setTab("chat");
  assert.equal(h.render().route, "solace");
  h.render().switchSolaceMode("companion");
  const companion = h.render();
  assert.equal(companion.route, "chat");
  companion.switchSolaceMode("journal");
  companion.setParams({ id: "reply-after-mode-switch" });
  h.render().navigate("journal-entry", { id: "bad/id" });
  assert.equal(h.render().route, "journal");
  h.render().navigate("journal-entry", { id: "entry-a" });
  h.render().navigate("journal-reflect", { id: "entry-a" });
  h.render().navigate("chat", { id: "shared-a", fromJournal: "entry-a" });
  assert.equal(h.render().activeTab, "chat");
  assert.equal(h.render().params.fromJournal, "entry-a");
  h.render().navigate("voice-talk", { id: "shared-a" });
  h.render().navigate("chat", { id: "shared-a" });
  assert.equal(h.render().params.fromJournal, "entry-a");
  h.render().back();
  assert.equal(h.render().route, "journal-reflect");
  h.render().switchSolaceMode("companion");
  assert.equal(h.render().params.id, "reply-after-mode-switch");
  h.render().switchSolaceMode("journal");
  assert.equal(h.render().route, "journal-reflect");
  h.close();
});

const biometricPolicyKey = "solace.biometric.policy.v1";
const biometricProofKey = "solace.biometric.proof.v1";

async function biometricAccount(data = empty(), options = {}) {
  const h = harness({ platform: "android", ...options });
  await settle();
  h.onRequest = accountTransport("biometric-owner", "session-token", data);
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.render();
  return h;
}

test("biometric lock checks hardware, enrollment, and strong Android security before persisting", async () => {
  const h = await biometricAccount();
  const settings = { appDelay: 60, journal: false };
  h.biometricHardware = false;
  await assert.rejects(
    h.render().updateDeviceLock(settings),
    /supported biometrics/,
  );
  h.biometricHardware = true;
  h.biometricEnrolled = false;
  await assert.rejects(
    h.render().updateDeviceLock(settings),
    /supported biometrics/,
  );
  h.biometricEnrolled = true;
  h.biometricLevel = 2;
  await assert.rejects(
    h.render().updateDeviceLock(settings),
    /supported biometrics/,
  );
  assert.equal(h.storage.has(biometricPolicyKey), false);
  h.biometricLevel = 3;
  h.biometricError = "User canceled";
  await assert.rejects(
    h.render().updateDeviceLock(settings),
    /setup did not finish/,
  );
  assert.equal(h.render().deviceLock, null);
  h.biometricError = null;
  await h.render().updateDeviceLock(settings);
  assert.equal(h.render().deviceLock.appDelay, 60);
  assert.equal(h.storage.get(biometricProofKey), "biometric-owner");
  await h.render().updateDeviceLock({ appDelay: null, journal: false });
  assert.equal(h.biometricReads, 1);
  assert.equal(h.storage.has(biometricPolicyKey), false);
  assert.equal(h.storage.has(biometricProofKey), false);
  h.close();
});

test("a protected cold session restores only after a successful biometric read", async () => {
  const setup = await biometricAccount();
  await setup.render().updateDeviceLock({ appDelay: 60, journal: false });
  const h = harness({ platform: "android", storage: setup.storage });
  setup.close();
  const requests = [];
  h.onRequest = async (route, options) => {
    requests.push(route);
    assert.equal(options.headers.Authorization, "Bearer session-token");
    return accountTransport("biometric-owner", "session-token")(route);
  };
  await settle();
  assert.equal(h.render().appLocked, true);
  assert.equal(h.render().user, null);
  assert.deepEqual(requests, []);
  h.biometricError = "User canceled";
  await assert.rejects(h.render().unlockDeviceLock("app"), /did not finish/);
  assert.equal(h.render().appLocked, true);
  assert.deepEqual(requests, []);
  h.biometricError = null;
  await h.render().unlockDeviceLock("app");
  assert.equal(h.render().user.id, "biometric-owner");
  assert.equal(h.render().appLocked, false);
  assert.deepEqual(requests, ["/state"]);
  h.close();
});

test("a biometric proof for one account never restores another account's saved credential", async () => {
  const setup = await biometricAccount();
  await setup.render().updateDeviceLock({ appDelay: 0, journal: true });
  setup.storage.set("solace.session", "different-owner-token");
  const h = harness({ platform: "android", storage: setup.storage });
  setup.close();
  h.onRequest = accountTransport("other-owner", "different-owner-token", {
    ...empty(),
    reflections: [
      { id: "other-journal", kind: "journal", text: "Other account" },
    ],
  });
  await settle();
  await h.render().unlockDeviceLock("app");
  assert.equal(h.render().user, null);
  assert.equal(h.render().data.reflections.length, 0);
  assert.equal(h.storage.has("solace.session"), false);
  h.close();
});

test("expired or changed biometric enrollment keeps startup private and permits normal sign-in recovery", async () => {
  const setup = await biometricAccount();
  await setup.render().updateDeviceLock({ appDelay: 0, journal: true });
  const h = harness({ platform: "android", storage: setup.storage });
  setup.close();
  h.onRequest = accountTransport("biometric-owner", "fresh-server-session");
  await settle();
  h.biometricInvalidated = true;
  await assert.rejects(
    h.render().unlockDeviceLock("app"),
    /Biometrics may have changed/,
  );
  assert.equal(h.render().user, null);
  assert.equal(h.render().appLocked, true);
  await h.render().signOut();
  assert.equal(h.render().appLocked, false);
  assert.equal(h.storage.has("solace.session"), false);
  assert.equal(h.storage.has(biometricPolicyKey), false);
  assert.equal(h.storage.has(biometricProofKey), false);
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  assert.equal(h.render().token, "fresh-server-session");
  assert.equal(h.render().deviceLock, null);
  h.close();
});

test("temporary inactive events preserve the session and the configured background threshold locks on resume", async () => {
  const h = await biometricAccount();
  await h.render().updateDeviceLock({ appDelay: 60, journal: false });
  h.render();
  h.now = 1000;
  h.appState("inactive");
  assert.equal(h.render().privacyCovered, true);
  h.appState("active");
  assert.equal(h.render().privacyCovered, false);
  assert.equal(h.render().appLocked, false);
  h.appState("background");
  h.now += 59000;
  h.appState("active");
  assert.equal(h.render().appLocked, false);
  h.appState("background");
  h.now += 61000;
  h.appState("active");
  assert.equal(h.render().appLocked, true);
  assert.equal(h.render().token, "session-token");
  await h.render().unlockDeviceLock("app");
  assert.equal(h.render().appLocked, false);
  assert.equal(h.biometricReads, 1);
  h.close();
});

test("immediate lock aborts sensitive requests and never starts two biometric prompts", async () => {
  const h = await biometricAccount();
  await h.render().updateDeviceLock({ appDelay: 0, journal: false });
  const response = deferred();
  let signal;
  h.onRequest = async (_route, options) => {
    signal = options.signal;
    await response.promise;
    return ok({ user: { id: "biometric-owner" }, data: empty() });
  };
  const result = h
    .render()
    .refresh()
    .catch((error) => error);
  assert.ok(signal);
  h.appState("background");
  assert.equal(h.render().appLocked, true);
  assert.equal(signal.aborted, true);
  response.resolve();
  assert.match((await result).message, /session changed/);
  h.appState("active");
  const held = deferred();
  h.biometricRead = held.promise;
  const unlock = h.render().unlockDeviceLock("app");
  await assert.rejects(h.render().unlockDeviceLock("app"), /already open/);
  held.resolve();
  await unlock;
  assert.equal(h.render().appLocked, false);
  assert.equal(h.biometricReads, 1);
  h.close();
});

test("immediate biometric lock still checkpoints the most recent private draft", async () => {
  const h = await biometricAccount();
  await h.render().updateDeviceLock({ appDelay: 0, journal: true });
  h.render().navigate("journal");
  await h.render().unlockDeviceLock("journal");
  const draft = {
    title: "Synthetic",
    text: "A test-only draft before locking",
  };
  h.render().setEditorDraft("journal:new", draft);
  h.appState("background");
  await until(
    () => h.render().editorDraftPersistence["journal:new"] === "committed",
  );
  const restored = harness({ platform: "android", storage: h.storage });
  h.close();
  restored.onRequest = accountTransport("biometric-owner", "session-token");
  await settle();
  assert.equal(restored.render().appLocked, true);
  assert.equal(restored.render().editorDrafts["journal:new"], undefined);
  await restored.render().unlockDeviceLock("app");
  assert.equal(restored.render().editorDrafts["journal:new"].text, draft.text);
  restored.close();
});

test("Journal protection redacts previews, guards deep links and export, and relocks on leaving", async () => {
  const record = {
    id: "journal-one",
    kind: "journal",
    title: "Private title",
    content: "Private text",
  };
  const legacy = {
    id: "journal-legacy",
    title: "Private legacy title",
    text: "Private legacy text",
  };
  const h = await biometricAccount({
    ...empty(),
    reflections: [record, legacy],
  });
  await h.render().updateDeviceLock({ appDelay: null, journal: true });
  assert.equal(h.render().data.reflections[0].title, "Private journal entry");
  assert.equal(h.render().data.reflections[0].content, undefined);
  assert.equal(h.render().data.reflections[1].title, "Private journal entry");
  assert.equal(h.render().data.reflections[1].text, undefined);
  await assert.rejects(
    h.render().remove("reflections", record.id),
    /Unlock My Journal/,
  );
  await assert.rejects(
    h.render().reflectJournal(record.id, { start: 0, end: 4 }, "insight"),
    /Unlock My Journal/,
  );
  h.render().navigate("reflection-detail", { id: legacy.id });
  assert.equal(h.render().journalRouteProtected, true);
  assert.equal(h.render().journalLocked, true);
  h.render().navigate("journal-entry", { id: record.id });
  assert.equal(h.render().journalRouteProtected, true);
  assert.equal(h.render().journalLocked, true);
  await h.render().unlockDeviceLock("journal");
  assert.equal(h.render().journalLocked, false);
  assert.equal(h.render().data.reflections[0].content, record.content);
  h.appState("background");
  h.appState("active");
  assert.equal(h.render().journalLocked, true);
  await h.render().unlockDeviceLock("journal");
  h.render().navigate("today");
  h.render();
  assert.equal(h.render().journalLocked, true);
  assert.equal(h.render().data.reflections[0].content, undefined);
  let exported = false;
  h.onRequest = async (route) => {
    assert.equal(route, "/export");
    exported = true;
    return ok({ reflections: [record] });
  };
  h.biometricError = "User canceled";
  await assert.rejects(h.render().exportData(), /did not finish/);
  assert.equal(exported, false);
  h.biometricError = null;
  await h.render().exportData();
  assert.equal(exported, true);
  h.close();
});

test("Journey opens a Journal record on Solace and back returns to the same Journey route", async () => {
  const h = await signedIn();
  h.render().navigate("journey");
  h.render().navigate("journey-activity", { day: "2026-11-06" });
  h.render().navigate("journal-entry", { id: "entry-b" });
  assert.equal(h.render().activeTab, "chat");
  assert.equal(h.render().params.id, "entry-b");
  h.render().back();
  assert.equal(h.render().activeTab, "journey");
  assert.equal(h.render().route, "journey-activity");
  assert.equal(h.render().params.day, "2026-11-06");
  h.close();
});

test("writing after a completed practice returns to detail without restarting its player", async () => {
  const h = await signedIn();
  h.render().switchSolaceMode("companion");
  h.render().navigate("technique-detail", { id: "reflection" });
  h.render().navigate("moment-player", { techniqueId: "reflection" });
  const completed = h.render();
  completed.back();
  completed.navigate("journal-editor", { prompt: "Synthetic prompt" });
  assert.equal(h.render().route, "journal-editor");
  h.render().back();
  assert.equal(h.render().route, "technique-detail");
  assert.equal(h.render().params.id, "reflection");
  h.close();
});

test("late chat updates can update their own tab but never a replacement route or another tab", async () => {
  const h = await signedIn();
  h.render().setTab("chat");
  const firstChat = h.render();
  firstChat.setTab("today");
  firstChat.setParams({ id: "finished-in-background" });
  assert.equal(h.render().params.id, undefined);
  h.render().setTab("chat");
  assert.equal(h.render().params.id, "finished-in-background");
  h.render().navigate("chat", { id: "opened-from-history" });
  firstChat.setParams({ id: "stale" });
  assert.equal(h.render().params.id, "opened-from-history");
});

test("leaving a player for another tab returns to its parent on a later tab switch", async () => {
  const h = await signedIn();
  h.render().setTab("explore");
  h.render().navigate("moments");
  h.render().navigate("moment-player", { activity: { id: "practice" } });
  h.render().navigate("journey");
  assert.equal(h.render().route, "journey");
  h.render().setTab("explore");
  assert.equal(h.render().route, "moments");
});

test("repeated detail taps keep one route and reopening its ancestor unwinds the branch", async () => {
  const h = await signedIn();
  h.render().setTab("journey");
  const journey = h.render();
  journey.navigate("journey-activity", { day: "2026-11-06" });
  journey.navigate("journey-activity", { day: "2026-11-06" });
  h.render().back();
  assert.equal(h.render().route, "journey");
  journey.navigate("journey-activity", { day: "2026-11-06" });
  h.render().setParams({ historyY: 240 });
  h.render().navigate("session-detail", { id: "session-a" });
  h.render().navigate("session-detail", { id: "session-b" });
  h.render().back();
  assert.equal(h.render().params.id, "session-a");
  h.render().navigate("journey-activity", { day: "2026-11-06" });
  assert.equal(h.render().params.historyY, 240);
  h.render().back();
  assert.equal(h.render().route, "journey");
  h.close();
});

test("late or repeated Back from a closed detail cannot pop another route", async () => {
  const h = await signedIn();
  h.render().setTab("journey");
  h.render().navigate("session-detail", { id: "session-a" });
  const pendingDeletion = h.render();
  h.render().setTab("profile");
  h.render().navigate("settings");
  pendingDeletion.back();
  assert.equal(h.render().route, "settings");
  h.render().setTab("journey");
  h.render().navigate("session-detail", { id: "session-b" });
  pendingDeletion.back();
  assert.equal(h.render().params.id, "session-b");
  const top = h.render();
  top.back();
  top.back();
  assert.equal(h.render().params.id, "session-a");
  h.close();
});

test("habit reflection preserves the active conversation and Back returns to Habit Insights", async () => {
  const h = await signedIn();
  h.render().navigate("chat", { id: "saved-conversation" });
  h.render().setTab("journey");
  h.render().navigate("habit-insights");
  h.render().navigate("chat", { habitAssistant: "reflect" });
  assert.equal(h.render().route, "chat");
  assert.equal(h.render().params.id, "saved-conversation");
  assert.equal(h.render().params.habitAssistant, "reflect");
  h.render().setParams({ habitAssistant: undefined });
  h.render().back();
  assert.equal(h.render().route, "habit-insights");
  h.render().setTab("chat");
  assert.equal(h.render().params.id, "saved-conversation");
  assert.equal(h.render().params.habitAssistant, undefined);
  h.close();
});

test("habit progress waits for a confirmed write and rejects duplicate taps in flight", async () => {
  const h = await signedIn();
  const deferredResponse = deferred();
  const original = h.onRequest;
  const write = { day: "2026-11-07", amount: 1, expectedRevision: 0 };
  h.onRequest = (path, options) => {
    if (path !== "/habits/walk/progress") return original(path, options);
    assert.deepEqual(JSON.parse(options.body), write);
    return deferredResponse.promise;
  };
  const pending = h.render().setHabitProgress("walk", write);
  await assert.rejects(
    h.render().setHabitProgress("walk", write),
    /already being saved/,
  );
  assert.equal(h.render().data.habitProgress.length, 0);
  deferredResponse.resolve(ok({ error: "Try again." }, 503));
  await assert.rejects(pending, /Try again/);
  assert.equal(h.render().data.habitProgress.length, 0);
  assert.equal(h.render().data.habitGarden.length, 0);
  const progress = {
    id: "walk-day",
    habitId: "walk",
    ...write,
    complete: true,
    revision: 1,
  };
  const garden = { id: "garden", earnedTotal: 1, stage: "sprout" };
  h.onRequest = (path, options) =>
    path === "/habits/walk/progress"
      ? ok({ progress, garden })
      : original(path, options);
  await h.render().setHabitProgress("walk", write);
  assert.equal(h.render().data.habitProgress[0].amount, 1);
  assert.equal(h.render().data.habitGarden[0].stage, "sprout");
  h.close();
});

test("Today's Habits shows at most three due rows and keeps its header routes usable when empty", () => {
  const calls = [];
  const app = {
    data: { habits: [], habitProgress: [] },
    navigate: (...args) => calls.push(args),
  };
  const view = habitViews(() => app);
  assert.match(view.today().text, /Start with one small habit/);
  view.today().press("Create a habit");
  assert.deepEqual(calls.pop(), ["habits"]);

  app.data.habits = [
    dailyHabit("tuesday", "Tuesday only", { type: "weekdays", days: [2] }),
  ];
  assert.match(view.today().text, /Nothing is scheduled today/);
  assert.ok(!view.today().labels.some((label) => label?.startsWith("Open ")));

  app.data.habits.push(dailyHabit("walk", "Walk"));
  const one = view.today();
  assert.match(one.text, /0 of 1 scheduled completed/);
  assert.deepEqual(
    one.labels.filter((label) => label?.startsWith("Open ")),
    ["Open Walk"],
  );

  app.data.habits = [
    ...app.data.habits,
    ...["Read", "Stretch", "Water"].map((name) =>
      dailyHabit(name.toLowerCase(), name),
    ),
  ];
  const today = view.today();
  assert.match(today.text, /0 of 4 scheduled completed/);
  assert.deepEqual(
    today.labels.filter((label) => label?.startsWith("Open ")),
    ["Open Walk", "Open Read", "Open Stretch"],
  );
  today.press("Open Read");
  assert.deepEqual(calls.pop(), ["habit-details", { id: "read" }]);
  today.press("View all habits");
  assert.deepEqual(calls.pop(), ["habits"]);
});

test("Journey Habit Progress uses the selected range, saved garden, and one insights action", async (t) => {
  const h = await signedIn();
  t.after(() => h.close());
  const view = habitViews(h.render);
  assert.match(view.journey().text, /0 Actions completed/);
  assert.match(view.journey().text, /No scheduled goals/);

  const walk = dailyHabit("walk", "Take a walk", {
    type: "weekdays",
    days: [1, 3],
  });
  walk.revisions[0].day = "2026-10-26";
  const account = accountTransport("account-a", "token-account-a", {
    ...empty(),
    habits: [walk],
    habitProgress: [
      ["2026-10-26", true],
      ["2026-10-28", false],
      ["2026-11-02", true],
      ["2026-11-04", false],
      ["2026-11-09", true],
    ].map(([day, complete]) => ({
      id: `walk-${day}`,
      habitId: walk.id,
      day,
      amount: complete ? 1 : 0,
      complete,
      earned: true,
      target: 1,
      revision: complete ? 1 : 2,
    })),
    habitGarden: [{ id: "garden", stage: "growing", earnedTotal: 5 }],
  });
  const requests = [];
  h.onRequest = (route) => {
    requests.push(route);
    return account(route);
  };
  await h.render().refresh();
  h.render().setTab("journey");

  const week = view.journey();
  assert.match(week.text, /Your week at a glance\./);
  assert.match(week.text, /1 Actions completed/);
  assert.match(week.text, /100% Scheduled goals met/);
  assert.match(week.text, /Garden.*Growing plant/);
  assert.equal(week.labels.length, 1);
  assert.match(week.labels[0], /^Habit Progress\./);
  assert.match(
    week.labels[0],
    /1 completed habit action\. 100% of scheduled goals met\./,
  );

  const month = view.journey({ period: "month", startDay: "2026-11-01" });
  assert.match(month.text, /Your month at a glance\./);
  assert.match(month.text, /2 Actions completed/);
  assert.match(month.text, /67% Scheduled goals met/);

  const allTime = { period: "all", startDay: null };
  const all = view.journey(allTime);
  assert.match(all.text, /Your habits over time\./);
  assert.match(all.text, /3 Actions completed/);
  assert.match(all.text, /60% Scheduled goals met/);
  assert.match(all.text, /Garden.*Growing plant/);

  const beforeHabit = view.journey({
    startDay: "2026-10-19",
    endDay: "2026-10-25",
  });
  assert.match(beforeHabit.text, /0 Actions completed/);
  assert.match(beforeHabit.text, /No scheduled goals/);
  assert.doesNotMatch(beforeHabit.text, /0%/);

  week.press(week.labels[0]);
  assert.equal(h.render().route, "habit-insights");
  h.render().back();
  assert.equal(h.render().route, "journey");
  assert.deepEqual(requests, ["/state"]);

  const restored = harness({ storage: h.storage });
  t.after(() => restored.close());
  restored.onRequest = account;
  await until(() => restored.render().user?.id === "account-a");
  assert.equal(habitViews(restored.render).journey(allTime).text, all.text);
});

test("Today completion and Undo update the dashboard and Journey from confirmed account data", async (t) => {
  const h = await signedIn();
  t.after(() => h.close());
  const day = "2026-11-09";
  const account = accountTransport("account-a", "token-account-a", {
    ...empty(),
    habits: [
      dailyHabit("stretch", "Evening stretch"),
      dailyHabit("walk", "Lunch walk"),
      dailyHabit("read", "Read a page"),
      dailyHabit("water", "Drink water"),
    ],
  });
  const requests = [];
  h.onRequest = async (route, options) => {
    if (route !== "/habits/stretch/progress") return account(route);
    assert.equal(options.method, "PUT");
    assert.equal(options.headers.Authorization, "Bearer token-account-a");
    const write = JSON.parse(options.body);
    requests.push(write);
    return ok({
      progress: {
        id: "stretch-day",
        habitId: "stretch",
        day,
        amount: write.amount,
        target: 1,
        complete: write.amount === 1,
        revision: requests.length,
        earned: true,
      },
      garden: { id: "garden", earnedTotal: 1, stage: "sprout" },
    });
  };
  await h.render().refresh();
  const view = habitViews(h.render);
  const before = view.today();
  const previewLabels = [
    "Open Evening stretch",
    "Open Lunch walk",
    "Open Read a page",
  ];
  assert.deepEqual(
    before.labels.filter((label) => label?.startsWith("Open ")),
    previewLabels,
  );
  assert.match(view.dashboard().text, /0 of 4 completed/);
  assert.match(view.journey().text, /0 Actions completed/);
  assert.match(view.journey().text, /0% Scheduled goals met/);

  before.press("Complete Evening stretch");
  await until(() => h.render().data.habitProgress[0]?.complete === true);
  const completed = view.today();
  assert.match(completed.text, /1 of 4 scheduled completed/);
  assert.deepEqual(
    completed.labels.filter((label) => label?.startsWith("Open ")),
    previewLabels,
  );
  assert.ok(completed.labels.includes("Undo Evening stretch"));
  completed.press("View all habits");
  assert.equal(h.render().route, "habits");
  const dashboard = view.dashboard();
  assert.match(dashboard.text, /1 of 4 completed/);
  assert.ok(dashboard.labels.includes("View Drink water"));
  assert.match(view.journey().text, /1 Actions completed/);
  assert.match(view.journey().text, /25% Scheduled goals met/);
  assert.match(view.journey().text, /Garden.*Sprout/);

  h.render().back();
  assert.equal(h.render().route, "today");
  view.today().press("Undo Evening stretch");
  await until(() => h.render().data.habitProgress[0]?.complete === false);
  assert.match(view.today().text, /0 of 4 scheduled completed/);
  assert.match(view.dashboard().text, /0 of 4 completed/);
  assert.match(view.journey().text, /0 Actions completed/);
  assert.match(view.journey().text, /0% Scheduled goals met/);
  assert.match(view.journey().text, /Garden.*Sprout/);
  assert.deepEqual(requests, [
    { day, amount: 1, expectedRevision: 0 },
    { day, amount: 0, expectedRevision: 1 },
  ]);
});

test("switching Solace modes does not restore an exited immersive practice", async () => {
  const h = await signedIn();
  h.render().navigate("chat", { id: "saved-conversation" });
  h.render().navigate("technique-detail", { id: "box-breathing" });
  h.render().navigate("moment-player", { techniqueId: "box-breathing" });
  h.render().switchSolaceMode("journal");
  assert.equal(h.render().route, "journal");
  h.render().switchSolaceMode("companion");
  assert.equal(h.render().route, "technique-detail");
  assert.equal(h.render().params.id, "box-breathing");
  h.render().back();
  assert.equal(h.render().params.id, "saved-conversation");
  h.render().navigate("voice-talk", { id: "saved-conversation" });
  h.render().switchSolaceMode("companion");
  assert.equal(h.render().route, "chat");
  assert.equal(h.render().params.id, "saved-conversation");
  h.close();
});

test("a Solace link or tab switch leaves an Explore practice at its detail", async () => {
  const h = await signedIn();
  for (const leave of [
    (app) => app.switchSolaceMode("journal"),
    (app) => app.setTab("journey"),
  ]) {
    h.render().navigate("explore");
    h.render().navigate("technique-detail", { id: "box-breathing" });
    h.render().navigate("moment-player", { techniqueId: "box-breathing" });
    leave(h.render());
    h.render().setTab("explore");
    assert.equal(h.render().route, "technique-detail");
  }
  h.close();
});

test("a multiline first chat turn stays pending across tab switches and cannot be sent twice", async () => {
  const h = await signedIn();
  const reply = deferred();
  const text = "Synthetic message\nA second line";
  let requests = 0;
  h.onRequest = async (route, { body }) => {
    assert.equal(route, "/chat");
    assert.equal(JSON.parse(body).text, text);
    requests++;
    return reply.promise;
  };
  h.render().setTab("chat");
  const chatScreen = h.render();
  chatScreen.setChatDraft("new", text);
  const sending = chatScreen.chat(text).then((result) => {
    chatScreen.setChatDraft("new", "", text);
    chatScreen.setParams({ id: result.conversation.id });
  });

  h.render().setTab("today");
  h.render().setTab("chat");
  assert.equal(h.render().chatPending.new, text);
  h.render().setChatDraft("new", "Edited while sending");
  assert.equal(h.render().chatDrafts.new, text);
  await assert.rejects(h.render().chat(text), /still replying/);
  assert.equal(requests, 1);

  h.render().setTab("today");
  reply.resolve(
    ok({
      conversation: {
        id: "saved-turn",
        messages: [{ role: "user", content: text }],
      },
    }),
  );
  await sending;
  assert.equal(h.render().params.id, undefined);
  h.render().setTab("chat");
  assert.equal(h.render().params.id, "saved-turn");
  assert.equal(h.render().chatPending.new, undefined);
  assert.equal(h.render().chatDrafts.new, undefined);
  assert.equal(h.render().data.conversations.length, 1);
  assert.equal(h.render().data.conversations[0].messages[0].content, text);
  h.close();
});

test("signing out clears pending chat text before an old request resolves", async () => {
  const h = await signedIn();
  const reply = deferred();
  h.onRequest = async (route) => (route === "/chat" ? reply.promise : ok({}));
  const sending = h.render().chat("Synthetic pending text");
  const rejected = assert.rejects(sending);
  assert.equal(h.render().chatPending.new, "Synthetic pending text");
  await h.render().signOut();
  assert.equal(h.render().chatPending.new, undefined);
  reply.resolve(ok({ conversation: { id: "old-turn", messages: [] } }));
  await rejected;
  assert.equal(h.render().data.conversations.length, 0);
  h.close();
});

test("retrying an idempotent toolkit add cannot duplicate a favorite in account state", async () => {
  const h = await signedIn();
  assert.deepEqual(Array.from(h.render().data.favorites), []);
  const record = {
    id: "favorite-grounding-grounding",
    kind: "grounding",
    targetId: "grounding",
    title: "Five-senses grounding",
  };
  h.onRequest = async (route) => {
    assert.equal(route, "/records/favorites");
    return ok({ record });
  };
  const add = {
    kind: "grounding",
    targetId: "grounding",
    title: "Five-senses grounding",
  };
  await h.render().save("favorites", add);
  await h.render().save("favorites", add);
  assert.equal(h.render().data.favorites.length, 1);
  assert.equal(h.render().data.favorites[0].id, record.id);
  h.onRequest = accountTransport("account-b", "token-b");
  await h.render().signIn("different@solace.test", "test-only-password");
  assert.equal(h.render().data.favorites.length, 0);
});

test("network-failed writing is marked device-only, survives refresh, and reconciles on retry", async () => {
  const h = await signedIn();
  h.onRequest = async () => {
    throw Error("Simulated connection failure");
  };
  const saved = await h.render().save("checkins", {
    mood: "Okay",
    note: "Private thought",
    day: "2026-11-05",
  });
  assert.equal(saved.localOnly, true);
  assert.equal(h.render().pendingWrites.length, 1);
  assert.equal(h.render().draftProtection, "memory");
  h.onRequest = async (route, options) => {
    if (route === "/state")
      return ok({ user: { id: "account-a" }, data: empty() });
    if (route === "/records/checkins")
      return ok({ record: JSON.parse(options.body) });
    throw Error(`Unexpected request: ${route}`);
  };
  await h.render().refresh();
  assert.equal(h.render().data.checkins[0].localOnly, true);
  await h.render().flushPendingWrites();
  assert.equal(h.render().pendingWrites.length, 0);
  assert.equal(h.render().data.checkins.length, 1);
  assert.equal(h.render().data.checkins[0].localOnly, undefined);
  h.close();
});

test("lost POST responses retry the same identity and only acknowledge matching owned records", async () => {
  const h = await signedIn();
  let remote;
  h.onRequest = async (_route, options) => {
    remote = JSON.parse(options.body);
    throw Error("Response lost after server commit");
  };
  await h
    .render()
    .save("reflections", { text: "A kept thought", need: "Rest" });
  let mismatch = true;
  h.onRequest = async (route, options) => {
    assert.equal(route, "/records/reflections");
    if (options.method === "POST") {
      assert.equal(JSON.parse(options.body).id, remote.id);
      return ok({ error: "Already exists" }, 409);
    }
    return ok({
      records: [
        { ...remote, text: mismatch ? "Different writing" : remote.text },
      ],
    });
  };
  await assert.rejects(
    h.render().flushPendingWrites(),
    /could not be matched safely/,
  );
  assert.equal(h.render().pendingWrites.length, 1);
  mismatch = false;
  await h.render().flushPendingWrites();
  assert.equal(h.render().pendingWrites.length, 0);
  assert.equal(h.render().data.reflections[0].id, remote.id);
  h.close();
});

test("validation errors and non-writing operations never enter the offline queue", async () => {
  const h = await signedIn();
  h.onRequest = async () => ok({ error: "Invalid writing" }, 400);
  await assert.rejects(
    h.render().save("reflections", { text: "Writing" }),
    /Invalid writing/,
  );
  assert.equal(h.render().pendingWrites.length, 0);
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  await assert.rejects(
    h.render().save("sessions", { type: "breathing", completed: true }),
    /Unable to connect/,
  );
  assert.equal(h.render().pendingWrites.length, 0);
  h.close();
});

test("removing queued writing discards its device record without claiming a server delete", async () => {
  const h = await signedIn();
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  const saved = await h
    .render()
    .save("reflections", { text: "A device entry" });
  let requests = 0;
  h.onRequest = async () => {
    requests++;
    throw Error("Must not call API");
  };
  await h.render().remove("reflections", saved.id);
  assert.equal(requests, 0);
  assert.equal(h.render().pendingWrites.length, 0);
  assert.equal(h.render().data.reflections.length, 0);
  h.close();
});

test("automatic sync cannot upload writing while its device discard is committing", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  const saved = await h.render().save("reflections", { text: "Discard me" });
  const held = h.holdNextCredentialWrite();
  const discard = h.render().discardPendingWrite(saved.id);
  await until(() => held.started);
  let uploads = 0;
  h.onRequest = async () => {
    uploads++;
    return ok({ record: saved });
  };
  const sync = h.render().flushPendingWrites();
  held.resolve();
  await Promise.all([discard, sync]);
  assert.equal(uploads, 0);
  assert.equal(h.render().pendingWrites.length, 0);
  h.close();
});

test("native queued writing and background-protected drafts restore only for their account and erase on logout", async () => {
  const storage = new Map();
  const h = harness({ platform: "ios", storage });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.render().setEditorDraft("reflection:new", {
    text: "A protected draft 🌺",
    need: "Rest",
  });
  h.appState("background");
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  const saved = await h
    .render()
    .save("checkins", { mood: "Calm", day: "2026-11-05" });
  assert.equal(saved.localOnly, true);
  assert.equal(h.render().draftProtection, "device");
  h.close();

  const restarted = harness({ platform: "ios", storage });
  restarted.onRequest = accountTransport("account-a", "token-a");
  await until(() => !restarted.render().initializing);
  let app = restarted.render();
  assert.equal(app.editorDrafts["reflection:new"].text, "A protected draft 🌺");
  assert.equal(app.pendingWrites.length, 1);
  assert.equal(app.data.checkins[0].id, saved.id);
  restarted.onRequest = accountTransport("account-b", "token-b");
  await app.signIn("different@solace.test", "test-only-password");
  app = restarted.render();
  assert.equal(app.pendingWrites.length, 0);
  assert.equal(Object.keys(app.editorDrafts).length, 0);
  assert.ok(
    ![...storage.keys()].some((key) =>
      key.startsWith("solace.writing.v1.account-a"),
    ),
  );
  await app.signOut();
  assert.equal(storage.size, 0);
  restarted.close();
});

test("a syncing 401 cannot leave syncing UI stuck after same-account reauthentication", async () => {
  const h = await signedIn();
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  await h.render().save("reflections", { text: "Waiting entry" });
  h.onRequest = async () => ok({ error: "Session expired" }, 401);
  await assert.rejects(h.render().flushPendingWrites(), /Session expired/);
  let app = h.render();
  assert.equal(app.syncingWrites, false);
  assert.equal(app.sessionExpired, true);
  h.onRequest = accountTransport("account-a", "renewed-token");
  await app.signIn("synthetic@solace.test", "test-only-password");
  app = h.render();
  assert.equal(app.syncingWrites, false);
  assert.equal(app.pendingWrites.length, 1);
  h.close();
});

test("a late old-account sync cannot publish writing into a newly signed-in account", async () => {
  const h = await signedIn();
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  await h.render().save("reflections", { text: "Account A only" });
  const held = deferred();
  let remote;
  h.onRequest = async (_route, options) => {
    remote = JSON.parse(options.body);
    return held.promise;
  };
  const syncing = h.render().flushPendingWrites();
  const rejected = assert.rejects(syncing, /session changed/);
  h.onRequest = accountTransport("account-b", "token-b");
  await h.render().signIn("different@solace.test", "test-only-password");
  held.resolve(ok({ record: remote }));
  await rejected;
  const app = h.render();
  assert.equal(app.user.id, "account-b");
  assert.equal(app.pendingWrites.length, 0);
  assert.equal(app.data.reflections.length, 0);
  assert.equal(app.syncingWrites, false);
  h.close();
});

test("a lost response plus failed device commit retains retry identity across a fresh UI timestamp", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  let remote;
  h.onRequest = async (_route, options) => {
    remote = JSON.parse(options.body);
    throw Error("Response lost after commit");
  };
  h.failSecureSet = (key) => key.includes("solace.writing");
  await assert.rejects(
    h.render().save("reflections", {
      text: "Do not duplicate me",
      need: "Rest",
      createdAt: "2026-11-05T01:00:00.000Z",
    }),
    /storage unavailable/,
  );
  assert.equal(h.render().pendingWrites.length, 0);
  h.failSecureSet = null;
  h.onRequest = async (_route, options) => {
    if (options.method === "POST") {
      const retried = JSON.parse(options.body);
      assert.equal(retried.id, remote.id);
      assert.equal(retried.createdAt, remote.createdAt);
      return ok({ error: "Already exists" }, 409);
    }
    return ok({ records: [remote] });
  };
  const saved = await h.render().save("reflections", {
    text: "Do not duplicate me",
    need: "Rest",
    createdAt: "2026-11-05T01:01:00.000Z",
  });
  assert.equal(saved.id, remote.id);
  assert.equal(h.render().data.reflections.length, 1);
  h.close();
});

test("failed native logout erasure leaves a current retryable account rather than stale callbacks", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.failSecureRemove = (key) => key.includes("solace.writing");
  await assert.rejects(h.render().signOut(), /storage unavailable/);
  let app = h.render();
  assert.equal(app.user.id, "account-a");
  assert.equal(app.busy, false);
  assert.match(app.offlineError, /try signing out again/);
  h.failSecureRemove = null;
  await app.signOut();
  assert.equal(h.render().user, null);
  h.close();
});

test("a render during logout cannot restore erased drafts or transmit private writes", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  const waiting = deferred();
  let logoutStarted = false;
  let writes = 0;
  h.onRequest = async (route) => {
    if (route === "/auth/logout") {
      logoutStarted = true;
      return waiting.promise;
    }
    writes++;
    return ok({ record: { id: "write" } });
  };
  const logout = h.render().signOut();
  await until(() => logoutStarted);
  const current = h.render();
  current.setEditorDraft("reflection:logout", { text: "Private writing" });
  h.appState("background");
  await assert.rejects(
    current.save("reflections", { text: "Private writing" }),
    /account change/,
  );
  waiting.resolve(ok({ ok: true }));
  await logout;
  await settle();
  assert.equal(writes, 0);
  assert.equal(h.storage.size, 0);
  assert.deepEqual(Object.keys(h.render().editorDrafts), []);
  h.close();
});

test("signing out aborts an in-flight private request and clears its account", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  const transport = accountTransport("account-a", "token-a");
  h.onRequest = transport;
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  const pending = deferred();
  let signal;
  h.onRequest = async (route, options) => {
    if (route !== "/export") return transport(route);
    signal = options.signal;
    return pending.promise;
  };
  const exporting = h.render().exportData();
  const rejected = assert.rejects(exporting, /cancelled|session changed/);
  await until(() => signal);
  await h.render().signOut();
  pending.resolve(ok({ data: { reflections: [{ id: "private" }] } }));
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(h.render().user, null);
  h.close();
});

test("failed old-account erasure never persists the new account's credential", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.failSecureRemove = (key) => key.includes("solace.writing");
  h.onRequest = accountTransport("account-b", "token-b");
  await assert.rejects(
    h.render().signIn("second@solace.test", "test-only-password"),
    /storage unavailable/,
  );
  assert.equal(h.storage.get("solace.session"), "token-a");
  assert.equal(h.render().user.id, "account-a");
  h.close();
});

test("malformed API responses preserve a usable session and hide proxy HTML", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = async () => new Response("<html>Proxy setup</html>");
  await assert.rejects(
    h.render().signIn("synthetic@solace.test", "test-only-password"),
    /unexpected response/,
  );
  assert.equal(h.storage.has("solace.session"), false);
  h.onRequest = async () =>
    new Response("<html>Internal proxy details</html>", { status: 502 });
  await assert.rejects(
    h.render().signIn("synthetic@solace.test", "test-only-password"),
    /Something went wrong/,
  );
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.onRequest = async () =>
    ok({ user: { id: "account-a" }, data: { checkins: null } });
  await assert.rejects(h.render().refresh(), /could not read your saved space/);
  assert.equal(h.render().user.id, "account-a");
  assert.equal(h.render().data.checkins.length, 0);
  h.close();
});

test("chat reuses the retry identity only for the same draft and original conversation", async () => {
  const h = await signedIn();
  const text = "Original draft\nSecond paragraph";
  h.render().setChatDraft("new", text);
  const bodies = [];
  h.onRequest = async (_route, { body }) => {
    bodies.push(JSON.parse(body));
    if (bodies.length <= 3) throw Error("Response lost");
    return ok({ conversation: { id: "saved-conversation", messages: [] } });
  };
  await assert.rejects(h.render().chat(text));
  assert.equal(h.render().chatDrafts.new, text);
  assert.equal(h.render().chatPending.new, undefined);
  await assert.rejects(h.render().chat(text));
  assert.equal(bodies[1].text, text);
  assert.match(bodies[0].requestId, /^[0-9a-f-]{36}$/);
  assert.equal(bodies[0].requestId, bodies[1].requestId);
  await assert.rejects(h.render().chat(text, "saved-conversation"));
  assert.notEqual(bodies[0].requestId, bodies[2].requestId);
  h.render().setChatDraft("new", "Edited draft");
  await h.render().chat(text);
  assert.notEqual(bodies[0].requestId, bodies[3].requestId);
  await h.render().chat(text);
  assert.notEqual(bodies[3].requestId, bodies[4].requestId);
  h.close();
});

test("account deletion cannot commit online before erasure, and credential cleanup cannot misreport committed deletion", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  let deleted = 0;
  h.onRequest = async (route) => {
    if (route === "/account") {
      deleted++;
      return new Response(null, { status: 204 });
    }
    if (route === "/state")
      return ok({ error: "Account no longer exists" }, 401);
    throw Error(`Unexpected request: ${route}`);
  };
  h.failSecureRemove = (key) => key.includes("solace.writing");
  await assert.rejects(h.render().deleteAccount(), /storage unavailable/);
  assert.equal(deleted, 0);
  assert.equal(h.render().user.id, "account-a");
  h.failSecureRemove = (key) => key === "solace.session";
  await h.render().deleteAccount();
  let app = h.render();
  assert.equal(deleted, 1);
  assert.equal(app.user, null);
  assert.equal(app.token, null);
  assert.match(app.sessionError, /online account was deleted/);
  h.failSecureRemove = null;
  await app.retrySession();
  app = h.render();
  assert.equal(app.sessionError, null);
  assert.equal(h.storage.size, 0);
  h.close();
});

test("a native token removal failure does not leave logout busy or callbacks stale", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  h.failSecureRemove = (key) => key === "solace.session";
  await assert.rejects(h.render().signOut(), /storage unavailable/);
  const app = h.render();
  assert.equal(app.busy, false);
  assert.match(app.offlineError, /could not clear its saved sign-in/);
  h.failSecureRemove = null;
  await app.signOut();
  assert.equal(h.render().user, null);
  assert.equal(h.storage.size, 0);
  h.close();
});

test("the iOS development default reaches the host API and keeps the existing auth lifecycle", async () => {
  const h = harness({ platform: "ios" });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  assert.equal(h.lastRequestUrl, "http://127.0.0.1:3001/api/state");
  assert.equal(h.render().user.id, "account-a");
  assert.equal(h.storage.get("solace.session"), "token-a");
  await h.render().signOut();
  assert.equal(h.render().user, null);
  assert.equal(h.storage.size, 0);
  h.close();
});

test("an unconfigured release shows a recoverable configuration error without sending credentials", async () => {
  const h = harness({ development: false });
  await settle();
  let calls = 0;
  h.onRequest = async () => {
    calls++;
    throw Error("Must not transmit");
  };
  await assert.rejects(
    h.render().signIn("synthetic@solace.test", "test-only-password"),
    /install an updated build/,
  );
  const app = h.render();
  assert.equal(calls, 0);
  assert.equal(app.busy, false);
  assert.equal(app.user, null);
  assert.doesNotMatch(app.error, /EXPO_PUBLIC_API_URL/);
  assert.equal(app.pendingWrites.length, 0);
  h.close();
});

test("development connection diagnostics expose only the server origin while release errors stay generic", async () => {
  const h = harness({
    platform: "ios",
    apiUrl: "https://api.solace.test/private-routing-prefix",
  });
  await settle();
  h.onRequest = async () => {
    throw Error("Disconnected");
  };
  await assert.rejects(
    h.render().signIn("synthetic@solace.test", "test-only-password"),
    (error) => {
      assert.match(error.message, /https:\/\/api\.solace\.test/);
      assert.match(error.message, /same Mac/);
      assert.match(error.message, /npm run server/);
      assert.ok(!error.message.includes("private-routing-prefix"));
      return true;
    },
  );
  h.close();

  const release = harness({
    development: false,
    apiUrl: "https://api.solace.test",
  });
  await settle();
  release.onRequest = async () => {
    throw Error("Disconnected");
  };
  await assert.rejects(
    release.render().signIn("synthetic@solace.test", "test-only-password"),
    (error) => {
      assert.equal(
        error.message,
        "Unable to connect to Solace. Check your connection and try again.",
      );
      return true;
    },
  );
  release.close();
});

test("legacy account snapshots receive empty feature collections without losing existing records", async () => {
  const h = await signedIn();
  assert.deepEqual(Array.from(h.render().data.preferences), []);
  assert.deepEqual(Array.from(h.render().data.goals), []);
  h.close();
});

test("feature calls use authenticated structured routes and voice preserves its raw audio content type", async () => {
  const h = await signedIn();
  const seen = [];
  h.onRequest = async (route, options) => {
    seen.push({ route, options });
    return ok(
      route === "/voice/transcribe"
        ? { text: "Reviewed words", provider: "live" }
        : { provider: "offline", activity: null },
    );
  };
  await h.render().generateMoment("A little distracted", "ocean");
  await h.render().weeklyReflection("2026-11-05");
  await h.render().capabilities();
  const audio = new ArrayBuffer(100);
  await h.render().transcribeVoice(audio, "audio/mp4");
  assert.deepEqual(
    seen.map((x) => x.route),
    [
      "/moments/generate",
      "/insights/weekly",
      "/capabilities",
      "/voice/transcribe",
    ],
  );
  assert.deepEqual(JSON.parse(seen[0].options.body), {
    feeling: "A little distracted",
    environment: "ocean",
  });
  assert.equal(seen[3].options.headers["Content-Type"], "audio/mp4");
  assert.equal(seen[3].options.headers.Authorization, "Bearer token-account-a");
  assert.equal(seen[3].options.body, audio);
  h.close();
});

test("late generated guidance cannot return into a replacement account", async () => {
  const h = await signedIn();
  let finish;
  h.onRequest = async (route) =>
    route === "/moments/generate"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : ok({ ok: true });
  const waiting = h.render().generateMoment("QA words", "forest");
  const rejected = assert.rejects(waiting);
  await h.render().signOut();
  h.onRequest = accountTransport("account-b", "new-token");
  await h.render().signIn("new@solace.test", "test-only-password");
  finish(
    ok({
      activity: null,
      provider: "offline",
      explanation: "Old account preference",
      usedMemoryIds: [],
    }),
  );
  await rejected;
  assert.equal(h.render().user.id, "account-b");
  assert.equal(h.render().data.sessions.length, 0);
  h.close();
});

test("first explicit feature identities create with POST, then known records update without duplicates", async () => {
  const h = await signedIn();
  const seen = [];
  h.onRequest = async (route, options) => {
    const record = JSON.parse(options.body);
    seen.push([route, options.method]);
    return ok({ record });
  };
  await h.render().save("preferences", {
    id: "wellness",
    environment: "forest",
    ambientEnabled: false,
    streaksEnabled: false,
  });
  await h.render().save("preferences", {
    id: "wellness",
    environment: "ocean",
    ambientEnabled: false,
    streaksEnabled: false,
  });
  await h.render().save("sessions", {
    id: "generated-stable",
    kind: "generated",
    completed: true,
  });
  assert.deepEqual(seen, [
    ["/records/preferences", "POST"],
    ["/records/preferences/wellness", "PATCH"],
    ["/records/sessions", "POST"],
  ]);
  assert.equal(h.render().data.preferences.length, 1);
  assert.equal(h.render().data.preferences[0].environment, "ocean");
  assert.equal(h.render().data.sessions.length, 1);
  h.close();
});

test("voice authorization failures trigger the existing session-expiry recovery", async () => {
  const h = await signedIn();
  h.onRequest = async () => ok({ error: "Session expired" }, 401);
  await assert.rejects(
    h.render().transcribeVoice(new ArrayBuffer(100), "audio/mp4"),
    /Session expired/,
  );
  assert.equal(h.render().sessionExpired, true);
  assert.equal(h.render().token, null);
  h.close();
});

test("a long journal draft atomically becomes one protected write and retries using its original ID", async () => {
  const storage = new Map();
  const h = harness({ platform: "ios", storage });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  const record = {
    id: "journal-stable",
    kind: "journal",
    createdAt: "2026-11-05T12:00:00.000Z",
    day: "2026-11-05",
    title: "A walk",
    text: "A quiet afternoon.\n".repeat(2900),
    mood: "Calm",
    tags: ["park"],
    bookmarked: true,
  };
  const draft = {
    id: record.id,
    createdAt: record.createdAt,
    title: record.title,
    text: record.text,
    mood: record.mood,
    tags: "park",
    bookmarked: "yes",
  };
  const key = "journal:new";
  h.render().setEditorDraft(key, draft);
  assert.equal(await h.render().flushEditorDrafts(), true);
  let remote;
  h.onRequest = async (route, options) => {
    assert.equal(route, "/records/reflections");
    assert.equal(options.method, "POST");
    remote = JSON.parse(options.body);
    throw Error("Response lost after commit");
  };
  const held = h.holdNextCredentialWrite();
  const saving = h.render().save("reflections", record, { key, value: draft });
  await until(() => held.started);
  h.appState("background");
  held.resolve();
  const queued = await saving;
  await settle();
  assert.equal(queued.id, record.id);
  assert.equal(queued.localOnly, true);
  assert.equal(h.render().editorDrafts[key], undefined);
  h.close();

  // Simulate closing the app between the durable queue commit and UI cleanup.
  const reopened = harness({ platform: "ios", storage });
  reopened.onRequest = accountTransport("account-a", "token-a");
  await until(() => !reopened.render().initializing);
  assert.equal(reopened.render().editorDrafts[key], undefined);
  assert.equal(reopened.render().data.reflections[0].id, record.id);
  let replayPosts = 0;
  reopened.onRequest = async (route, options) => {
    assert.equal(route, "/records/reflections");
    if (options.method === "POST") {
      replayPosts++;
      assert.deepEqual(JSON.parse(options.body), remote);
      return ok({ error: "Already exists" }, 409);
    }
    return ok({ records: [{ ...remote, updatedAt: record.createdAt }] });
  };
  await reopened.render().flushPendingWrites();
  const app = reopened.render();
  assert.equal(replayPosts, 1);
  assert.equal(app.pendingWrites.length, 0);
  assert.equal(app.data.reflections.length, 1);
  assert.equal(app.data.reflections[0].text, record.text);
  assert.equal(app.data.reflections[0].localOnly, undefined);
  reopened.close();
});

test("native draft status acknowledges only the current committed revision and recovers from storage failure", async () => {
  const storage = new Map();
  const h = harness({ platform: "ios", storage });
  await settle();
  h.onRequest = accountTransport("account-a", "token-a");
  await h.render().signIn("synthetic@solace.test", "test-only-password");
  const key = "journal:new";
  h.render().setEditorDraft(key, { text: "First version" });
  assert.equal(h.render().editorDraftPersistence[key], "writing");
  const held = h.holdNextCredentialWrite();
  const first = h.render().flushEditorDrafts();
  await until(() => held.started);
  h.render().setEditorDraft(key, { text: "Second version" });
  held.resolve();
  assert.equal(await first, true);
  assert.equal(h.render().editorDraftPersistence[key], "writing");

  h.failSecureSet = (key) => key.startsWith("solace.writing.");
  assert.equal(await h.render().flushEditorDrafts(), false);
  assert.equal(h.render().editorDraftPersistence[key], "failed");
  assert.equal(h.render().editorDrafts[key].text, "Second version");
  h.failSecureSet = undefined;
  assert.equal(await h.render().flushEditorDrafts(), true);
  assert.equal(h.render().editorDraftPersistence[key], "committed");
  h.close();

  const reopened = harness({ platform: "ios", storage });
  reopened.onRequest = accountTransport("account-a", "token-a");
  await until(() => !reopened.render().initializing);
  assert.equal(reopened.render().editorDrafts[key].text, "Second version");
  assert.equal(reopened.render().editorDraftPersistence[key], "committed");
  await reopened.render().signOut();
  assert.equal(reopened.render().editorDraftPersistence[key], undefined);
  reopened.close();
});

test("a targeted journal sync can succeed without altering a different failed queued entry", async () => {
  const h = await signedIn();
  h.onRequest = async () => {
    throw Error("Offline while writing");
  };
  for (const id of ["journal-first", "journal-second"])
    await h.render().save("reflections", { id, kind: "journal", text: id });
  const target = (id) => ({ id, collection: "reflections" });
  const pending = (id) =>
    h.render().pendingWrites.find((entry) => entry.id === id);
  h.onRequest = async (_route, options) => {
    assert.equal(JSON.parse(options.body).id, "journal-first");
    return ok({ error: "Try again later." }, 502);
  };
  await assert.rejects(
    h.render().flushPendingWrites(target("journal-first")),
    /Try again later/,
  );
  assert.equal(pending("journal-first").syncState, "failed");
  assert.equal(pending("journal-first").syncError, "Try again later.");
  assert.equal(pending("journal-second").syncState, undefined);

  const response = deferred();
  h.onRequest = async (_route, options) => {
    const record = JSON.parse(options.body);
    assert.equal(record.id, "journal-second");
    await response.promise;
    return ok({ record });
  };
  const syncing = h.render().flushPendingWrites(target("journal-second"));
  assert.equal(pending("journal-second").syncState, "syncing");
  assert.equal(pending("journal-first").syncState, "failed");
  response.resolve();
  await syncing;
  assert.equal(pending("journal-second"), undefined);
  assert.equal(pending("journal-first").syncState, "failed");
  assert.equal(
    h.render().data.reflections.find((entry) => entry.id === "journal-second")
      .localOnly,
    undefined,
  );
  assert.equal(
    h.render().data.reflections.find((entry) => entry.id === "journal-first")
      .localOnly,
    true,
  );
  h.close();
});
