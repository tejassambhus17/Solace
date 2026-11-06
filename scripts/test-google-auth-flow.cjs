const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { setImmediate: nextTick } = require("node:timers/promises");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../src/google-auth-flow.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const moduleStub = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleStub,
  exports: moduleStub.exports,
});
const { GOOGLE_RETURN_URL, runGoogleFlow, googleAuthMessage } =
  moduleStub.exports;
const flowId = "synthetic-google-flow-id";
const apiOrigin = "https://solace-qa.example.invalid";
const browserUrl = `${apiOrigin}/api/auth/google/browser/${flowId}`;
const handoff = "A".repeat(43);
const callbackUrl = `${GOOGLE_RETURN_URL}?handoff=${handoff}`;

function harness(overrides = {}) {
  const events = [];
  const services = {
    apiOrigin,
    randomBytes: async (count) => Buffer.alloc(count, 0xab),
    digestBase64: async (value) =>
      createHash("sha256").update(value).digest("base64"),
    start: async (challenge) => {
      events.push(["start", challenge]);
      return { id: flowId, url: browserUrl };
    },
    open: async (url, redirect) => {
      events.push(["open", url, redirect]);
      return { type: "success", url: callbackUrl };
    },
    complete: async ({ id, verifier, handoff: code }) => {
      events.push(["complete", id, verifier, code]);
    },
    ...overrides,
  };
  const controller = new AbortController();
  return {
    events,
    controller,
    run: () => runGoogleFlow(services, controller.signal),
  };
}

test("redemption includes the app’s S256 proof and the browser’s one-time handoff", async () => {
  const fixture = harness();
  assert.equal(await fixture.run(), "complete");
  const verifier = "ab".repeat(32);
  assert.deepEqual(fixture.events, [
    ["start", createHash("sha256").update(verifier).digest("base64url")],
    ["open", browserUrl, "solace://google-auth"],
    ["complete", flowId, verifier, handoff],
  ]);
});

test("closing the browser does not redeem a session", async () => {
  for (const type of ["cancel", "dismiss"]) {
    const fixture = harness({ open: async () => ({ type }) });
    assert.equal(await fixture.run(), "cancelled");
    assert.equal(
      fixture.events.some(([event]) => event === "complete"),
      false,
    );
  }
});

test("the app rejects other redirects and callbacks carrying URL credentials", async () => {
  for (const url of [
    GOOGLE_RETURN_URL,
    "solace://google-auth-similar",
    "solace://google-auth?token=fake",
    "solace://google-auth#id_token=fake",
    "https://example.invalid/google-auth",
    `${GOOGLE_RETURN_URL}?handoff=too-short`,
    `${callbackUrl}&handoff=${handoff}`,
    `${callbackUrl}&access_token=fake`,
    `${callbackUrl}#id_token=fake`,
  ]) {
    const fixture = harness({ open: async () => ({ type: "success", url }) });
    await assert.rejects(fixture.run(), /could not return/);
    assert.equal(
      fixture.events.some(([event]) => event === "complete"),
      false,
    );
  }
});

test("an unsafe authorization URL never opens a browser", async () => {
  for (const url of [
    browserUrl.replace("https:", "http:"),
    browserUrl.replace(".invalid/", ".invalid.evil.invalid/"),
    browserUrl.replace("https://", "https://example.invalid@"),
    `${browserUrl}?token=untrusted`,
    `${browserUrl}#untrusted`,
    `${browserUrl}-wrong-flow`,
  ]) {
    const fixture = harness({ start: async () => ({ id: flowId, url }) });
    await assert.rejects(fixture.run(), /could not start/);
    assert.deepEqual(fixture.events, []);
  }
});

test("leaving the account scope during browser authentication prevents redemption", async () => {
  const fixture = harness({
    open: async () => {
      fixture.controller.abort();
      return { type: "success", url: callbackUrl };
    },
  });
  assert.equal(await fixture.run(), "cancelled");
  assert.equal(
    fixture.events.some(([event]) => event === "complete"),
    false,
  );
});

test("start and redemption failures do not show success or leak diagnostic text", async () => {
  for (const phase of ["start", "complete"]) {
    const error = Object.assign(new Error("private diagnostic detail"), {
      connection: true,
    });
    const fixture = harness({
      [phase]: async () => {
        throw error;
      },
    });
    await assert.rejects(fixture.run(), (received) => received === error);
    assert.match(googleAuthMessage(error), /Check your connection/);
    assert.doesNotMatch(googleAuthMessage(error), /private diagnostic detail/);
  }
  assert.match(
    googleAuthMessage({ code: "GOOGLE_UNAVAILABLE" }),
    /unavailable/,
  );
  assert.match(
    googleAuthMessage({ code: "GOOGLE_EMAIL_IN_USE" }),
    /link Google in Account settings/,
  );
  assert.match(
    googleAuthMessage({ status: 401 }, true),
    /Sign in to your Solace account again/,
  );
  assert.match(
    googleAuthMessage({ code: "GOOGLE_CANCELLED" }, true),
    /linking was cancelled/,
  );
});

function linkHookHarness() {
  const hookSource = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/google-auth.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const slots = [];
  const effects = [];
  const redeemed = [];
  let opened = 0;
  let cursor = 0;
  let finishBrowser;
  const browser = new Promise((resolve) => {
    finishBrowser = resolve;
  });
  const app = {
    user: { id: "account-a" },
    appLocked: false,
    privacyCovered: false,
    googleConfiguration: async () => ({ enabled: true }),
    googleLinkStatus: async () => ({ linked: false }),
    googleLinkStart: async () => ({ id: flowId, url: browserUrl }),
    googleLinkComplete: async (proof) => {
      redeemed.push(proof);
      return { linked: true };
    },
  };
  const mocks = {
    react: {
      createContext: () => ({}),
      useRef(value) {
        const index = cursor++;
        return (slots[index] ??= { current: value });
      },
      useState(value) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [
          slots[index],
          (update) => {
            slots[index] = update;
          },
        ];
      },
      useEffect(effect, dependencies) {
        const index = cursor++;
        const previous = slots[index];
        if (
          !previous ||
          dependencies.some((value, i) => value !== previous.dependencies[i])
        )
          effects.push({
            cleanup: previous?.cleanup,
            setup: () => {
              slots[index] = { dependencies, cleanup: effect() };
            },
          });
      },
    },
    "react-native": { Platform: { OS: "android" }, Keyboard: { dismiss() {} } },
    "expo-crypto": {
      getRandomBytesAsync: async (count) => Buffer.alloc(count, 0xab),
      digestStringAsync: async (_algorithm, text) =>
        createHash("sha256").update(text).digest("base64"),
      CryptoDigestAlgorithm: { SHA256: "SHA-256" },
      CryptoEncoding: { BASE64: "base64" },
    },
    "expo-web-browser": {
      openAuthSessionAsync: () => {
        opened += 1;
        return browser;
      },
    },
    "./store": { API_URL: apiOrigin, useApp: () => ({ ...app }) },
    "./google-auth-flow": moduleStub.exports,
  };
  const hook = { exports: {} };
  vm.runInNewContext(hookSource, {
    module: hook,
    exports: hook.exports,
    require: (name) => mocks[name],
    AbortController,
    URL,
    __DEV__: true,
  });
  return {
    redeemed,
    get opened() {
      return opened;
    },
    finishBrowser: () => finishBrowser({ type: "success", url: callbackUrl }),
    render(changes, mode = "link") {
      Object.assign(app, changes);
      cursor = 0;
      const state = hook.exports.useGoogleAuth(mode);
      const staged = effects.splice(0);
      for (const effect of staged) effect.cleanup?.();
      for (const effect of staged) effect.setup();
      return state;
    },
  };
}

test("missing Google configuration disables native sign-in without opening a browser", async () => {
  const fixture = linkHookHarness();
  fixture.render(
    { googleConfiguration: async () => ({ enabled: false }) },
    "login",
  );
  await nextTick();
  const state = fixture.render({}, "login");
  assert.equal(state.availability, "unavailable");
  assert.match(state.notice, /not configured/);
  await state.start();
  assert.equal(fixture.opened, 0);
  assert.equal(fixture.redeemed.length, 0);
});

test("account linking keeps the in-memory proof while the app locks, then redeems after unlock", async () => {
  const fixture = linkHookHarness();
  fixture.render();
  await nextTick();
  const flow = fixture.render().start();
  await nextTick();
  fixture.render({ appLocked: true, privacyCovered: true });
  fixture.finishBrowser();
  await nextTick();
  assert.equal(fixture.redeemed.length, 0);
  fixture.render({ appLocked: true, privacyCovered: false });
  await nextTick();
  assert.equal(fixture.redeemed.length, 0);
  fixture.render({ appLocked: false });
  await flow;
  assert.equal(fixture.redeemed.length, 1);
  assert.equal(fixture.render().availability, "linked");
});

test("switching accounts during a locked browser handoff cancels the original proof", async () => {
  const fixture = linkHookHarness();
  fixture.render();
  await nextTick();
  const flow = fixture.render().start();
  await nextTick();
  fixture.render({ appLocked: true });
  fixture.finishBrowser();
  await nextTick();
  fixture.render({ user: { id: "account-b" }, appLocked: false });
  await flow;
  assert.equal(fixture.redeemed.length, 0);
});
