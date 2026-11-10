const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { randomUUID } = require("node:crypto");
const { setImmediate: turn } = require("node:timers/promises");
const tooling = require("./tooling.cjs");
const { setup } = require("./setup.cjs");
const {
  createDevelopmentSession,
  clientEnvironment,
  publicApiUrl,
  terminateOwnedProcess,
} = require("./dev-supervisor.cjs");
const { runSupervisedCommand } = require("./runtime.cjs");

function fixture(t, beforeCleanup = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "solace-tooling-"));
  t.after(async () => {
    await beforeCleanup();
    const resolved = fs.realpathSync(root);
    const prefix = path.join(fs.realpathSync(os.tmpdir()), "solace-tooling-");
    assert.ok(
      resolved.startsWith(prefix),
      "cleanup stays inside this test's bounded temp namespace",
    );
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  for (const prefix of ["", "server/"]) {
    write(
      `${prefix}package.json`,
      JSON.stringify({
        name: `fixture${prefix ? "-server" : ""}`,
        dependencies: {},
      }),
    );
    write(`${prefix}package-lock.json`, JSON.stringify({ lockfileVersion: 3 }));
  }
  const pkg = (prefix, name, bin, target) => {
    write(
      `${prefix}node_modules/${name}/package.json`,
      JSON.stringify({
        name,
        main: "index.js",
        bin,
        exports: { ".": "./index.js", "./package.json": "./package.json" },
      }),
    );
    write(`${prefix}node_modules/${name}/index.js`, "module.exports = {};\n");
    write(`${prefix}node_modules/${name}/${target}`, "// fixture entry\n");
  };
  return { root, write, pkg };
}

function simulated(options = {}) {
  const children = [];
  const stopped = [];
  const logs = [];
  const signals = new EventEmitter();
  const spawn = (_runtime, args, spawnOptions) => {
    const child = new EventEmitter();
    Object.assign(child, {
      pid: 100 + children.length,
      exitCode: null,
      signalCode: null,
      args,
      spawnOptions,
    });
    children.push(child);
    return child;
  };
  const terminate = async (child) => {
    stopped.push(child.pid);
    child.exitCode = 0;
    child.emit("exit", 0, null);
  };
  const session = createDevelopmentSession({
    root: tooling.ROOT,
    inspect: () => [],
    runtime: process.execPath,
    serverArgs: ["fixture-api.js"],
    expo: "fixture-expo.js",
    spawn,
    terminate,
    signals,
    readinessTimeoutMs: 40,
    healthTimeoutMs: 20,
    fetch: async () => ({
      ok: true,
      json: async () => ({ ok: true, service: "Solace API" }),
    }),
    log: (value) => logs.push(value),
    report: (value) => logs.push(value),
    ...options,
  });
  return { session, children, stopped, logs, signals };
}

test("runtime validation accepts supported Node 26 and rejects unsupported SDK versions", () => {
  for (const version of [
    "v22.13.0",
    "22.23.3",
    "v24.3.0",
    "v24.22.1",
    "v26.13.0",
    "v27.0.0",
  ])
    assert.equal(tooling.supportedNode(version), true, version);
  for (const version of [
    "v20.9.0",
    "v22.12.9",
    "v23.0.0",
    "v24.2.9",
    "v25.0.0",
    "v24.3.0-rc.1",
    "garbage",
  ])
    assert.equal(tooling.supportedNode(version), false, version);
});

test("a supported selected Node 26 is retained and explicit unsupported overrides fail", () => {
  const current = path.resolve("node-current");
  assert.equal(
    tooling.selectRuntime({
      current,
      version: "v26.13.0",
      env: {},
      probe: () => {
        throw Error("must not replace a supported runtime");
      },
    }),
    current,
  );
  const chosen = path.resolve("node-chosen");
  assert.equal(
    tooling.selectRuntime({
      current,
      version: "v26.13.0",
      env: { SOLACE_NODE: chosen },
      exists: () => true,
      probe: () => "v24.22.1",
    }),
    chosen,
  );
  assert.throws(
    () =>
      tooling.selectRuntime({
        env: { SOLACE_NODE: chosen },
        exists: () => true,
        probe: () => "v22.0.0",
      }),
    /SOLACE_NODE/,
  );
});

test("runtime fallback verifies the full version rather than just its major", (t) => {
  const f = fixture(t);
  const bad = path.join(f.root, "node-bad");
  const good = path.join(f.root, "node-good");
  f.write("runtime.json", JSON.stringify({ node: bad }));
  assert.equal(
    tooling.selectRuntime({
      version: "v20.9.0",
      env: {},
      configFile: path.join(f.root, "runtime.json"),
      platform: "win32",
      windowsRuntimes: [good],
      exists: () => true,
      probe: (name) => (name === bad ? "v24.0.0" : "v24.22.1"),
    }),
    good,
  );
});

test("a root-only install reports missing server tsx with actionable instructions", (t) => {
  const f = fixture(t);
  f.pkg("", "expo", { expo: "bin/cli" }, "bin/cli");
  f.pkg("", "typescript", { tsc: "bin/tsc" }, "bin/tsc");
  const issues = tooling.dependencyIssues(f.root);
  assert.ok(issues.some((value) => value.includes("tsx")));
  assert.match(
    tooling.installGuidance(issues),
    /npm --prefix server ci --include=dev/,
  );
  f.pkg("server/", "tsx", "dist/cli.mjs", "dist/cli.mjs");
  assert.deepEqual(tooling.dependencyIssues(f.root), []);
  const args = tooling.sourceServerArgs(f.root);
  assert.equal(args[0], "--import");
  assert.ok(args[1].startsWith("file:"));
  assert.equal(args[2], "src/index.ts");
});

test("setup uses both lockfiles, includes dev dependencies and builds with the selected Node", (t) => {
  const f = fixture(t);
  const calls = [];
  const logs = [];
  f.write(".env", "KEEP_EXISTING_PUBLIC_CONFIG\n");
  f.write(".env.example", "NEW_EXAMPLE\n");
  f.write("server/.env", "DO_NOT_OVERWRITE_PRIVATE_SENTINEL\n");
  f.write("server/.env.example", "EMPTY_PRIVATE_TEMPLATE\n");
  assert.equal(
    setup({
      root: f.root,
      runtime: process.execPath,
      npm: "fixture-npm-cli.js",
      inspect: () => [],
      log: (line) => logs.push(line),
      run: (...args) => {
        calls.push(args);
        return { status: 0 };
      },
    }),
    0,
  );
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0][1], [
    "fixture-npm-cli.js",
    "ci",
    "--include=dev",
    "--include=optional",
  ]);
  assert.equal(calls[0][2].cwd, f.root);
  assert.deepEqual(calls[1][1], [
    "fixture-npm-cli.js",
    "ci",
    "--include=dev",
    "--include=optional",
  ]);
  assert.equal(calls[1][2].cwd, path.join(f.root, "server"));
  assert.deepEqual(calls[2][1], ["fixture-npm-cli.js", "run", "build"]);
  assert.equal(calls[2][0], process.execPath);
  assert.equal(
    fs.readFileSync(path.join(f.root, ".env"), "utf8"),
    "KEEP_EXISTING_PUBLIC_CONFIG\n",
  );
  assert.equal(
    fs.readFileSync(path.join(f.root, "server/.env"), "utf8"),
    "DO_NOT_OVERWRITE_PRIVATE_SENTINEL\n",
  );
  assert.ok(!logs.join("\n").includes("PRIVATE_SENTINEL"));
});

test("setup aborts on installation failure without reporting success or replacing env files", (t) => {
  const f = fixture(t);
  const logs = [];
  let calls = 0;
  f.write(".env.example", "EXPO_PUBLIC_API_URL=http://127.0.0.1:3001\n");
  assert.throws(
    () =>
      setup({
        root: f.root,
        npm: "fixture-npm-cli.js",
        inspect: () => [],
        log: (line) => logs.push(line),
        run: () => {
          calls++;
          return { status: 1 };
        },
      }),
    /failed/,
  );
  assert.equal(calls, 1);
  assert.equal(fs.existsSync(path.join(f.root, ".env")), false);
  assert.ok(!logs.some((line) => line.includes("completed")));
});

test("npm is executed as JavaScript through selected Node rather than a Windows npm.cmd launcher", () => {
  const cli = path.resolve("fake-npm", "bin", "npm-cli.js");
  assert.equal(
    tooling.findNpmCli(
      process.execPath,
      { npm_execpath: cli, PATH: "" },
      (name) => name === cli,
    ),
    cli,
  );
  assert.throws(
    () =>
      tooling.findNpmCli(
        process.execPath,
        { npm_execpath: path.resolve("npm.cmd"), PATH: "" },
        () => false,
      ),
    /npm CLI could not be located/,
  );
  assert.throws(
    () =>
      tooling.findNpmCli(
        process.execPath,
        { npm_execpath: path.resolve("yarn.js"), PATH: "" },
        (candidate) => candidate === path.resolve("yarn.js"),
      ),
    /npm CLI could not be located/,
  );
});

test("public dev URL respects Expo file precedence, shell overrides and explicit blank values", (t) => {
  const f = fixture(t);
  f.write(".env", "EXPO_PUBLIC_API_URL=http://127.0.0.1:3001\n");
  f.write(".env.local", "EXPO_PUBLIC_API_URL=http://127.0.0.1:3002\n");
  assert.equal(publicApiUrl(f.root, {}), "http://127.0.0.1:3002");
  f.write(
    ".env.development.local",
    "EXPO_PUBLIC_API_URL=http://127.0.0.1:3003\n",
  );
  assert.equal(publicApiUrl(f.root, {}), "http://127.0.0.1:3003");
  assert.equal(
    publicApiUrl(f.root, { EXPO_PUBLIC_API_URL: "http://127.0.0.1:3004" }),
    "http://127.0.0.1:3004",
  );
  assert.equal(publicApiUrl(f.root, { EXPO_PUBLIC_API_URL: "" }), "");
  assert.equal(publicApiUrl(f.root, { EXPO_NO_DOTENV: "1" }), "");
});

test("an exited POSIX leader does not exempt its surviving owned process group from cleanup", async () => {
  const child = new EventEmitter();
  Object.assign(child, { pid: 12345, exitCode: 1, signalCode: null });
  const calls = [];
  let descendantAlive = true;
  await terminateOwnedProcess(child, {
    platform: "darwin",
    wait: async () => {},
    killGroup: (pid, signal) => {
      calls.push([pid, signal]);
      if (signal === "SIGKILL") descendantAlive = false;
    },
  });
  assert.deepEqual(calls, [
    [-12345, "SIGTERM"],
    [-12345, "SIGKILL"],
  ]);
  assert.equal(descendantAlive, false);
  await terminateOwnedProcess(child, {
    platform: "win32",
    spawnSync: () => {
      throw Error("An exited Windows PID must not be targeted");
    },
  });
});

test("termination directed at the outer wrapper is forwarded to its dev supervisor", async () => {
  const signals = new EventEmitter();
  const child = new EventEmitter();
  const forwarded = [];
  child.kill = (signal) => {
    forwarded.push(signal);
    queueMicrotask(() => child.emit("exit", 0, null));
    return true;
  };
  const running = runSupervisedCommand(
    process.execPath,
    { args: ["dev.mjs"] },
    { signals, spawn: () => child },
  );
  signals.emit("SIGTERM");
  assert.equal(await running, 0);
  assert.deepEqual(forwarded, ["SIGTERM"]);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("Metro receives public app config but not private provider or database environment", () => {
  const original = {
    PATH: "existing",
    EXPO_PUBLIC_API_URL: "http://127.0.0.1:3001",
    OPENAI_API_KEY: "private-test-sentinel",
    OPENAI_BASE_URL: "private-origin",
    GEMINI_API_KEY: "gemini-test-sentinel",
    GEMINI_MODEL: "gemini-test-model",
    DATABASE_PATH: "private-db",
    PORT: "3001",
    HOST: "0.0.0.0",
    AI_MODE: "live",
    AI_PROVIDER: "openai",
  };
  const client = clientEnvironment(process.execPath, original);
  assert.equal(client.EXPO_PUBLIC_API_URL, original.EXPO_PUBLIC_API_URL);
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "DATABASE_PATH",
    "PORT",
    "HOST",
    "AI_MODE",
    "AI_PROVIDER",
  ])
    assert.equal(key in client, false);
  assert.equal(original.OPENAI_API_KEY, "private-test-sentinel");
  assert.equal(original.GEMINI_API_KEY, "gemini-test-sentinel");
});

test("missing tsx prevents any child process or Expo launch", () => {
  let spawned = false;
  assert.throws(
    () =>
      createDevelopmentSession({
        inspect: () => ["Server tsx is missing"],
        spawn: () => {
          spawned = true;
        },
      }),
    /npm run setup/,
  );
  assert.equal(spawned, false);
});

test("Expo waits for the owned API's IPC signal and successful health, then cleans up on interrupt", async () => {
  let releaseHealth;
  const h = simulated({
    args: ["--ios"],
    fetch: () =>
      new Promise((resolve) => {
        releaseHealth = resolve;
      }),
  });
  assert.equal(h.children.length, 1);
  h.children[0].emit("message", {
    type: "solace:ready",
    port: 3001,
    host: "0.0.0.0",
  });
  await turn();
  assert.equal(h.children.length, 1);
  releaseHealth({
    ok: true,
    json: async () => ({ ok: true, service: "Solace API" }),
  });
  assert.equal(await h.session.ready, true);
  assert.equal(h.children.length, 2);
  assert.deepEqual(h.children[1].args, ["fixture-expo.js", "start", "--ios"]);
  h.signals.emit("SIGINT");
  assert.equal(await h.session.done, 0);
  assert.deepEqual(h.stopped.sort(), [100, 101]);
});

test("an API failure before readiness cannot accept an unrelated healthy listener", async () => {
  let fetched = false;
  const h = simulated({
    fetch: async () => {
      fetched = true;
      return {
        ok: true,
        json: async () => ({ ok: true, service: "Solace API" }),
      };
    },
  });
  h.children[0].exitCode = 1;
  h.children[0].emit("exit", 1, null);
  assert.equal(await h.session.ready, false);
  assert.equal(await h.session.done, 1);
  assert.equal(h.children.length, 1);
  assert.equal(fetched, false);
});

test("runtime API failure also stops its already-running Expo sibling", async () => {
  const h = simulated();
  h.children[0].emit("message", { type: "solace:ready", port: 3001 });
  await h.session.ready;
  h.children[0].exitCode = 2;
  h.children[0].emit("exit", 2, null);
  assert.equal(await h.session.done, 2);
  assert.ok(h.stopped.includes(h.children[1].pid));
});

test("missing readiness and failed health never start Expo", async () => {
  const silent = simulated({ readinessTimeoutMs: 15 });
  assert.equal(await silent.session.ready, false);
  assert.equal(await silent.session.done, 1);
  assert.equal(silent.children.length, 1);
  const unhealthy = simulated({
    fetch: async () => ({
      ok: true,
      json: async () => ({ ok: true, service: "Not Solace" }),
    }),
  });
  unhealthy.children[0].emit("message", { type: "solace:ready", port: 3001 });
  assert.equal(await unhealthy.session.ready, false);
  assert.equal(await unhealthy.session.done, 1);
  assert.equal(unhealthy.children.length, 1);
});

test("a non-default API port with blank public client URL stops before Expo rather than pointing at port 3001", async () => {
  const h = simulated({ readPublicApiUrl: () => "" });
  h.children[0].emit("message", { type: "solace:ready", port: 3141 });
  assert.equal(await h.session.ready, false);
  assert.equal(await h.session.done, 1);
  assert.equal(h.children.length, 1);
  assert.ok(
    h.logs.some((line) => line.includes("EXPO_PUBLIC_API_URL is blank")),
  );
});

test(
  "direct tsx source startup verifies actual API auth before starting an Expo stub",
  { timeout: 20000 },
  async (t) => {
    let session;
    const f = fixture(t, () => session?.stop(0));
    f.write("expo-stub.cjs", "setInterval(() => {}, 1000);\n");
    let url;
    const reports = [];
    session = createDevelopmentSession({
      expo: path.join(f.root, "expo-stub.cjs"),
      env: {
        ...process.env,
        PORT: "0",
        HOST: "127.0.0.1",
        EXPO_PUBLIC_API_URL: "http://tooling-expo-stub.test",
        AI_MODE: "offline",
        OPENAI_API_KEY: "",
        DATABASE_PATH: path.join(f.root, "source-api.sqlite"),
      },
      fetch: async (target, options) => {
        url = target;
        return fetch(target, options);
      },
      log: () => {},
      report: (value) => reports.push(value),
    });
    assert.equal(await session.ready, true, reports.join("\n"));
    const base = new URL(url).origin;
    const registration = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Tooling QA",
        email: `tooling-${randomUUID()}@solace.test`,
        password: "test-only-password-2026",
      }),
    });
    assert.equal(registration.status, 201);
    const account = await registration.json();
    const headers = { Authorization: `Bearer ${account.token}` };
    assert.equal((await fetch(`${base}/api/state`, { headers })).status, 200);
    assert.equal(
      (await fetch(`${base}/api/auth/logout`, { method: "POST", headers }))
        .status,
      204,
    );
    assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 401);
    await session.stop(0);
    assert.equal(await session.done, 0);
    assert.ok(fs.statSync(path.join(f.root, "source-api.sqlite")).size > 0);
    await assert.rejects(fetch(url));
  },
);
