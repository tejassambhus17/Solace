import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import {
  mkdtempSync,
  existsSync,
  statSync,
  rmSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readServerConfig } from "../src/config.js";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const entry = resolve(serverRoot, "dist/index.js");
const temporary = () => mkdtempSync(join(tmpdir(), "solace-startup-"));
function cleanup(directory: string) {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.match(basename(directory), /^solace-startup-/);
  rmSync(directory, { recursive: true, force: true });
}
function environment(database: string, overrides: Record<string, string> = {}) {
  return {
    ...process.env,
    NODE_ENV: "test",
    PORT: "0",
    HOST: "127.0.0.1",
    AI_MODE: "offline",
    OPENAI_API_KEY: "",
    TRUST_PROXY_HOPS: "0",
    DATABASE_PATH: database,
    ...overrides,
  };
}
type StartupSignal = { type?: string; port?: number; host?: string };
function launch(
  cwd: string,
  database: string,
  overrides: Record<string, string> = {},
  preload?: string,
) {
  assert.ok(existsSync(entry), "Build the server before the process tests.");
  const child = spawn(
    process.execPath,
    [...(preload ? ["--import", pathToFileURL(preload).href] : []), entry],
    {
      cwd,
      env: environment(database, overrides),
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let output = "";
  const signals: StartupSignal[] = [];
  child.stdout!.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr!.on("data", (chunk) => {
    output += String(chunk);
  });
  child.on("message", (value) => {
    signals.push(value as StartupSignal);
  });
  return { child, signals, output: () => output };
}
async function signal(process: ReturnType<typeof launch>, expected: string) {
  const cached = process.signals.find((value) => value.type === expected);
  if (cached) return cached;
  if (process.child.exitCode !== null || process.child.signalCode !== null)
    throw new Error(`API already exited: ${process.output()}`);
  return new Promise<StartupSignal>((resolveSignal, reject) => {
    const timeout = setTimeout(
      () => finish(new Error(`Startup timeout: ${process.output()}`)),
      10000,
    );
    const finish = (error?: Error, value?: StartupSignal) => {
      clearTimeout(timeout);
      process.child.removeListener("message", message);
      process.child.removeListener("error", failure);
      process.child.removeListener("exit", exited);
      if (error) reject(error);
      else resolveSignal(value!);
    };
    const message = (value: unknown) => {
      if ((value as StartupSignal)?.type === expected)
        finish(undefined, value as StartupSignal);
    };
    const failure = (error: Error) => finish(error);
    const exited = (code: number | null) =>
      finish(new Error(`API exited ${code}: ${process.output()}`));
    process.child.on("message", message);
    process.child.once("error", failure);
    process.child.once("exit", exited);
  });
}
async function ready(process: ReturnType<typeof launch>) {
  const value = await signal(process, "solace:ready");
  assert.equal(value.host, "127.0.0.1");
  assert.ok(Number.isInteger(value.port) && value.port! > 0);
  return `http://127.0.0.1:${value.port}/api`;
}
async function availablePort() {
  const reservation = createServer();
  await new Promise<void>((resolveListening, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolveListening);
  });
  const address = reservation.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolveClosed) =>
    reservation.close(() => resolveClosed()),
  );
  return port;
}
async function stopped(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolveStopped, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("API did not exit."));
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveStopped();
    });
    child.kill("SIGTERM");
  });
}
async function failed(process: ReturnType<typeof launch>) {
  return new Promise<number | null>((resolveCode, reject) => {
    const timeout = setTimeout(() => {
      process.child.kill("SIGKILL");
      reject(new Error("Invalid startup did not terminate."));
    }, 10000);
    process.child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    process.child.once("exit", (code) => {
      clearTimeout(timeout);
      resolveCode(code);
    });
  });
}
async function call(
  base: string,
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  expected = 200,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path} returned ${response.status}`,
  );
  if (expected === 204) return null;
  return response.json();
}

test("startup configuration uses the server directory and rejects unusable mode/port values", () => {
  const root = resolve("server-fixture");
  const defaults = readServerConfig({}, root);
  assert.equal(defaults.databasePath, resolve(root, "data/solace.sqlite"));
  assert.equal(defaults.port, 3001);
  assert.equal(defaults.ai.mode, "auto");
  assert.equal(defaults.ai.apiKey, undefined);
  assert.equal(defaults.ai.model, "gpt-6.1-terra");
  assert.equal(defaults.ai.lightModel, "gpt-6-luna");
  assert.equal(defaults.ai.transcriptionModel, "gpt-transcribe");
  assert.equal(defaults.ai.ttsModel, "gpt-4o-mini-tts");
  assert.equal(defaults.ai.ttsVoice, "marin");
  assert.deepEqual(defaults.realtime, {
    enabled: true,
    model: "gpt-realtime-2.1-mini",
    voice: "marin",
    limits: {
      sessionSeconds: 300,
      dailySeconds: 900,
      globalDailySeconds: 3600,
    },
  });
  const voice = readServerConfig(
    {
      OPENAI_REALTIME_ENABLED: "false",
      OPENAI_REALTIME_MODEL: "gpt-realtime-2.1",
      REALTIME_SESSION_SECONDS: "60",
    },
    root,
  ).realtime;
  assert.equal(voice.enabled, false);
  assert.equal(voice.model, "gpt-realtime-2.1");
  assert.equal(voice.limits.sessionSeconds, 60);
  assert.throws(
    () => readServerConfig({ REALTIME_DAILY_SECONDS: "0" }, root),
    /REALTIME_DAILY_SECONDS/,
  );
  const configured = readServerConfig(
    {
      AI_MODE: "live",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
      OPENAI_CHAT_MODEL: "custom-chat",
      OPENAI_LIGHT_MODEL: "custom-light",
      OPENAI_TRANSCRIPTION_MODEL: "custom-transcribe",
      OPENAI_TTS_MODEL: "custom-tts",
      OPENAI_TTS_VOICE: "cedar",
      OPENAI_BASE_URL: "https://eu.api.openai.com/v1/",
    },
    root,
  ).ai;
  assert.equal(configured.model, "custom-chat");
  assert.equal(configured.lightModel, "custom-light");
  assert.equal(configured.transcriptionModel, "custom-transcribe");
  assert.equal(configured.ttsModel, "custom-tts");
  assert.equal(configured.ttsVoice, "cedar");
  assert.equal(configured.baseUrl, "https://eu.api.openai.com/v1/");
  assert.throws(
    () => readServerConfig({ AI_PROVIDER: "other" }, root),
    /AI_PROVIDER/,
  );
  assert.throws(
    () =>
      readServerConfig({ OPENAI_CHAT_MODEL: "models/not-a-model-id" }, root),
    /OPENAI_CHAT_MODEL/,
  );
  assert.throws(
    () =>
      readServerConfig(
        { OPENAI_BASE_URL: "https://proxy.example.test/v1" },
        root,
      ),
    /official OpenAI API/,
  );
  assert.equal(
    readServerConfig({ DATABASE_PATH: ":memory:", PORT: "0" }, root)
      .databasePath,
    ":memory:",
  );
  assert.equal(
    readServerConfig({ DATABASE_PATH: "private/records.sqlite" }, root)
      .databasePath,
    resolve(root, "private/records.sqlite"),
  );
  for (const PORT of ["", "abc", "-1", "1.5", "65536", "3001 "])
    assert.throws(() => readServerConfig({ PORT }, root), /PORT/);
  assert.throws(() => readServerConfig({ HOST: " " }, root), /HOST/);
  assert.throws(
    () => readServerConfig({ DATABASE_PATH: "" }, root),
    /DATABASE_PATH/,
  );
  assert.throws(() => readServerConfig({ AI_MODE: "other" }, root), /AI_MODE/);
  assert.throws(
    () => readServerConfig({ AI_MODE: "live", OPENAI_API_KEY: " " }, root),
    /requires OPENAI_API_KEY/,
  );
});

test(
  "compiled API persists accounts, sessions and chat history through actual process restarts",
  { timeout: 30000 },
  async () => {
    const directory = temporary();
    const database = join(directory, "private.sqlite");
    let process = launch(directory, database);
    try {
      let base = await ready(process);
      const health = await call(base, "/health");
      assert.equal(health.ok, true);
      assert.equal(health.database, "sqlite");
      assert.equal(health.aiProvider, "offline");
      assert.equal(health.aiConfigured, false);
      await call(base, "/state", undefined, "GET", undefined, 401);
      const password = "Synthetic process verification password";
      const a = await call(
        base,
        "/auth/register",
        undefined,
        "POST",
        { name: "Process A", email: "process-a@solace.test", password },
        201,
      );
      const b = await call(
        base,
        "/auth/register",
        undefined,
        "POST",
        { name: "Process B", email: "process-b@solace.test", password },
        201,
      );
      await call(
        base,
        "/records/checkins",
        a.token,
        "POST",
        { mood: "Calm", note: "Synthetic process check-in" },
        201,
      );
      const conversation = await call(base, "/chat", a.token, "POST", {
        text: "I'd like to reflect on my day",
      });
      assert.equal(
        conversation.provider,
        "offline",
        "Built-in guidance must not be reported as live AI.",
      );
      assert.equal(conversation.conversation.messages.length, 2);
      const privateState = await call(base, "/state", b.token);
      assert.equal(privateState.data.conversations.length, 0);
      assert.equal(privateState.data.checkins.length, 0);
      assert.ok(statSync(database).size > 0);
      await stopped(process.child);

      process = launch(serverRoot, database);
      base = await ready(process);
      assert.equal((await call(base, "/auth/me", a.token)).user.id, a.user.id);
      let restored = await call(base, "/state", a.token);
      assert.equal(restored.data.checkins.length, 1);
      assert.equal(
        restored.data.conversations[0].id,
        conversation.conversation.id,
      );
      assert.equal(restored.data.conversations[0].messages.length, 2);
      const login = await call(base, "/auth/login", undefined, "POST", {
        email: "process-a@solace.test",
        password,
      });
      const continued = await call(base, "/chat", login.token, "POST", {
        text: "I am taking a quiet pause",
        conversationId: conversation.conversation.id,
      });
      assert.equal(continued.conversation.id, conversation.conversation.id);
      assert.equal(continued.conversation.messages.length, 4);
      await call(base, "/auth/logout", login.token, "POST", undefined, 204);
      await call(base, "/state", login.token, "GET", undefined, 401);
      await stopped(process.child);

      process = launch(directory, database);
      base = await ready(process);
      await call(base, "/auth/me", login.token, "GET", undefined, 401);
      restored = await call(base, "/state", a.token);
      assert.equal(restored.data.conversations[0].messages.length, 4);
      assert.equal(
        (await call(base, "/state", b.token)).data.conversations.length,
        0,
      );
      await call(base, "/auth/logout", a.token, "POST", undefined, 204);
      await call(base, "/auth/me", a.token, "GET", undefined, 401);
    } finally {
      await stopped(process.child);
      cleanup(directory);
    }
  },
);

test(
  "shutdown handles success, storage failure and a stuck HTTP drain without leaking error details",
  { timeout: 40000 },
  async () => {
    const directory = temporary();
    const preload = join(directory, "shutdown-fixture.mjs");
    writeFileSync(
      preload,
      `import { Server } from "node:http";
      import { Store } from ${JSON.stringify(pathToFileURL(join(serverRoot, "dist/database.js")).href)};
      process.on("message", ({ type, scenario }) => {
        if (type !== "test:shutdown") return;
        if (scenario === "storage") {
          Store.prototype.close = () => { throw Error("private-database-path"); };
        }
        if (scenario === "stalled") {
          Server.prototype.close = () => {};
          const schedule = globalThis.setTimeout;
          globalThis.setTimeout = (fn, ms, ...args) =>
            schedule(fn, ms === 35000 ? 30 : ms, ...args);
        }
        process.emit("SIGTERM");
      });`,
    );
    try {
      for (const [scenario, exitCode, diagnostic] of [
        ["normal", 0, undefined],
        ["storage", 1, /could not finish a clean shutdown/],
        ["stalled", 1, /shutdown timed out/],
      ] as const) {
        const process = launch(directory, ":memory:", {}, preload);
        try {
          await ready(process);
          const result = failed(process);
          process.child.send({ type: "test:shutdown", scenario });
          assert.equal(await result, exitCode);
          if (diagnostic) assert.match(process.output(), diagnostic);
          assert.doesNotMatch(
            process.output(),
            /private-database-path|UnhandledPromiseRejection/,
          );
        } finally {
          await stopped(process.child);
        }
      }
    } finally {
      cleanup(directory);
    }
  },
);

test(
  "missing live credentials and invalid port fail before opening the database",
  { timeout: 25000 },
  async () => {
    const directory = temporary();
    try {
      for (const overrides of [{ AI_MODE: "live" }, { PORT: "not-a-port" }]) {
        const database = join(
          directory,
          `unopened-${Object.keys(overrides)[0]}.sqlite`,
        );
        const process = launch(directory, database, overrides);
        assert.equal(await failed(process), 1);
        assert.doesNotMatch(process.output(), /API ready on port/);
        assert.match(process.output(), /requires OPENAI_API_KEY|PORT must be/);
        assert.equal(existsSync(database), false);
      }
    } finally {
      cleanup(directory);
    }
  },
);

test(
  "an occupied port never opens or rewrites the running API database",
  { timeout: 20000 },
  async () => {
    const directory = temporary();
    const database = join(directory, "first.sqlite");
    const first = launch(directory, database);
    let second: ReturnType<typeof launch> | undefined;
    try {
      const base = await ready(first);
      const port = new URL(base).port;
      await call(
        base,
        "/auth/register",
        undefined,
        "POST",
        {
          name: "Owner",
          email: "owner@solace.test",
          password: "Synthetic process account password",
        },
        201,
      );
      const bytes = readFileSync(database);
      const modified = statSync(database).mtimeMs;
      second = launch(directory, database, { PORT: port });
      assert.equal(await failed(second), 1);
      assert.equal(second.signals.length, 0);
      assert.match(second.output(), /already in use/);
      assert.deepEqual(readFileSync(database), bytes);
      assert.equal(
        statSync(database).mtimeMs,
        modified,
        "a failed launch must not persist even an identical snapshot",
      );

      const sentinel = join(directory, "must-not-open.sqlite");
      const sentinelBytes = Buffer.from(
        "This is deliberately not a SQLite database.",
      );
      writeFileSync(sentinel, sentinelBytes);
      second = launch(directory, sentinel, { PORT: port });
      assert.equal(await failed(second), 1);
      assert.match(second.output(), /already in use/);
      assert.deepEqual(readFileSync(sentinel), sentinelBytes);
      assert.equal(second.signals.length, 0);
      assert.equal((await call(base, "/health")).ok, true);
    } finally {
      if (second) await stopped(second.child);
      await stopped(first.child);
      cleanup(directory);
    }
  },
);

test(
  "database initialization failure releases its reserved listener without readiness",
  { timeout: 20000 },
  async () => {
    const directory = temporary();
    const invalidDatabase = join(directory, "database-is-a-directory");
    mkdirSync(invalidDatabase);
    const port = await availablePort();
    const process = launch(directory, invalidDatabase, { PORT: String(port) });
    try {
      assert.equal(await failed(process), 1);
      assert.match(process.output(), /could not start/);
      assert.doesNotMatch(process.output(), /already in use|API ready on port/);
      assert.equal(process.signals.length, 0);
      const replacement = createServer();
      try {
        await new Promise<void>((resolveListening, reject) => {
          replacement.once("error", reject);
          replacement.listen(port, "127.0.0.1", resolveListening);
        });
      } finally {
        await new Promise<void>((resolveClosed) =>
          replacement.close(() => resolveClosed()),
        );
      }
    } finally {
      await stopped(process.child);
      cleanup(directory);
    }
  },
);

test(
  "reserved listener returns 503 until database and API initialization actually finish",
  { timeout: 20000 },
  async () => {
    const directory = temporary();
    const database = join(directory, "starting.sqlite");
    const port = await availablePort();
    const process = launch(
      directory,
      database,
      { PORT: String(port) },
      join(serverRoot, "tests/fixtures/hold-database.mjs"),
    );
    try {
      await signal(process, "test:database-opening");
      assert.equal(existsSync(database), false);
      const base = `http://127.0.0.1:${port}/api`;
      const pending = await call(
        base,
        "/health",
        undefined,
        "GET",
        undefined,
        503,
      );
      assert.equal(pending.ok, false);
      assert.equal(pending.code, "STARTING");
      const rejectedSignup = await call(
        base,
        "/auth/register",
        undefined,
        "POST",
        {
          name: "Pending",
          email: "pending@solace.test",
          password: "Synthetic process account password",
        },
        503,
      );
      assert.equal(rejectedSignup.code, "STARTING");
      assert.equal(
        process.signals.some((value) => value.type === "solace:ready"),
        false,
      );
      assert.doesNotMatch(process.output(), /API ready on port/);
      const started = ready(process);
      process.child.send({ type: "test:continue-database" });
      assert.equal(await started, base);
      assert.equal((await call(base, "/health")).ok, true);
      await call(
        base,
        "/auth/register",
        undefined,
        "POST",
        {
          name: "Pending",
          email: "pending@solace.test",
          password: "Synthetic process account password",
        },
        201,
      );
    } finally {
      await stopped(process.child);
      cleanup(directory);
    }
  },
);
