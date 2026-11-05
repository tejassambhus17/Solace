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
  const module = { exports: {} };
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
        getItemAsync: storageMock.getItem,
        setItemAsync: async (key, value) => {
          if (h.failSecureSet?.(key))
            throw Error("Protected device storage unavailable");
          await storageMock.setItem(key, value);
        },
        deleteItemAsync: async (key) => {
          if (h.failSecureRemove?.(key))
            throw Error("Protected device storage unavailable");
          await storageMock.removeItem(key);
        },
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: "unlocked-this-device",
      };
    if (name === "./offline") return offline.exports;
    if (name === "./api-config") return apiConfig.exports;
    throw Error(`Unexpected dependency: ${name}`);
  };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: requireMock,
    process: { env: { EXPO_PUBLIC_API_URL: options.apiUrl } },
    __DEV__: options.development ?? true,
    AbortController,
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
  assert.equal(h.render().activeTab, "today");
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
    /configured HTTPS API/,
  );
  const app = h.render();
  assert.equal(calls, 0);
  assert.equal(app.busy, false);
  assert.equal(app.user, null);
  assert.match(app.error, /EXPO_PUBLIC_API_URL/);
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
  await h
    .render()
    .save("preferences", {
      id: "wellness",
      environment: "forest",
      ambientEnabled: false,
      streaksEnabled: false,
    });
  await h
    .render()
    .save("preferences", {
      id: "wellness",
      environment: "ocean",
      ambientEnabled: false,
      streaksEnabled: false,
    });
  await h
    .render()
    .save("sessions", {
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
