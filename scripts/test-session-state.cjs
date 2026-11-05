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
function harness() {
  const slots = [];
  const effects = [];
  const storage = new Map();
  let cursor = 0;
  let heldWrite = null;
  let current;
  const h = {
    storage,
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
      if (!old || deps.some((value, i) => value !== old[i]))
        effects.push(effect);
      slots[index] = deps;
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
  const source = fs.readFileSync(
    path.join(__dirname, "../src/store.tsx"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  const module = { exports: {} };
  const requireMock = (name) => {
    if (name === "react") return react;
    if (name === "react-native") return { Platform: { OS: "web" } };
    if (name === "@react-native-async-storage/async-storage")
      return storageMock;
    if (name === "expo-secure-store") return {};
    throw Error(`Unexpected dependency: ${name}`);
  };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: requireMock,
    process: { env: {} },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) =>
      h.onRequest(new URL(url).pathname.replace(/^\/api/, ""), options),
  });
  h.render = () => {
    cursor = 0;
    current = module.exports.AppProvider({ children: null }).props.value;
    for (const effect of effects.splice(0)) effect();
    return current;
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
