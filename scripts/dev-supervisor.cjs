const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const {
  ROOT,
  dependencyIssues,
  installGuidance,
  sourceServerArgs,
  packageBin,
  runtimeEnvironment,
  packageRequire,
} = require("./tooling.cjs");

function clientEnvironment(executable, env = process.env) {
  const next = runtimeEnvironment(executable, env);
  // Private server configuration is never loaded into or forwarded to Metro.
  for (const name of Object.keys(next))
    if (
      /^(?:OPENAI|GEMINI)_/i.test(name) ||
      [
        "AI_MODE",
        "DATABASE_PATH",
        "TRUST_PROXY_HOPS",
        "ALLOWED_ORIGINS",
        "PORT",
        "HOST",
      ].includes(name)
    )
      delete next[name];
  return next;
}

function publicApiUrl(root, env = process.env) {
  if (Object.prototype.hasOwnProperty.call(env, "EXPO_PUBLIC_API_URL"))
    return String(env.EXPO_PUBLIC_API_URL || "").trim();
  if (
    ["1", "true", "yes", "on"].includes(
      String(env.EXPO_NO_DOTENV).toLowerCase(),
    )
  )
    return "";
  // Read the public value with Expo's own development-file precedence and
  // expansion rules. This parser does not mutate or log the environment.
  const { parseProjectEnv } = packageRequire(ROOT)("@expo/env");
  return String(
    parseProjectEnv(root, { mode: "development", silent: true, systemEnv: env })
      .env.EXPO_PUBLIC_API_URL || "",
  ).trim();
}

function ownReadiness(child, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      child.removeListener("message", message);
      child.removeListener("error", error);
      child.removeListener("exit", exited);
      signal.removeEventListener("abort", aborted);
    };
    const error = (value) => {
      cleanup();
      reject(value);
    };
    const exited = () =>
      error(new Error("API stopped before it became ready."));
    const aborted = () => error(new Error("Development startup stopped."));
    const message = (value) => {
      if (
        value?.type !== "solace:ready" ||
        !Number.isInteger(value.port) ||
        value.port < 1 ||
        value.port > 65535
      )
        return;
      cleanup();
      resolve(value);
    };
    child.on("message", message);
    child.once("error", error);
    child.once("exit", exited);
    signal.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(
      () =>
        error(
          new Error(
            "API startup timed out. Check the server error above; Expo has not been started.",
          ),
        ),
      timeoutMs,
    );
    if (signal.aborted) aborted();
  });
}

function healthUrl(readiness) {
  let host = readiness.host || "127.0.0.1";
  if (host === "0.0.0.0") host = "127.0.0.1";
  if (host === "::") host = "::1";
  if (!/^[a-zA-Z0-9.:-]+$/.test(host))
    throw new Error("The API reported an invalid local listening address.");
  return `http://${host.includes(":") ? `[${host}]` : host}:${readiness.port}/api/health`;
}

async function verifyHealth(url, options = {}) {
  const fetcher = options.fetch || fetch;
  const timeoutMs = options.timeoutMs || 5000;
  const deadline = Date.now() + timeoutMs;
  do {
    options.signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(Math.min(1000, timeoutMs));
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    try {
      const response = await fetcher(url, { signal });
      const body = await response.json();
      if (response.ok && body.ok === true && body.service === "Solace API")
        return;
    } catch {
      options.signal?.throwIfAborted();
    }
    if (Date.now() < deadline)
      await delay(Math.min(150, timeoutMs), undefined, {
        signal: options.signal,
      });
  } while (Date.now() < deadline);
  throw new Error(
    "The API process started, but its health endpoint could not be verified. Expo has not been started.",
  );
}

async function terminateOwnedProcess(child, options = {}) {
  if (!Number.isInteger(child.pid) || child.pid <= 0) return;
  const platform = options.platform || process.platform;
  const leaderExited = () =>
    child.exitCode !== null || child.signalCode !== null;
  const wait =
    options.wait ||
    (() =>
      new Promise((resolve) => {
        if (leaderExited()) return resolve();
        const timer = setTimeout(finish, 1500);
        function finish() {
          clearTimeout(timer);
          child.removeListener("exit", finish);
          resolve();
        }
        child.once("exit", finish);
      }));
  if (platform === "win32") {
    // An exited PID may already have been reused; never taskkill that PID.
    if (leaderExited()) return;
    const result = (options.spawnSync || spawnSync)(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true, timeout: 5000 },
    );
    if (result.error || result.status !== 0)
      throw new Error(
        "An owned development process could not be stopped. Check the process before restarting development.",
      );
    await wait();
    if (!leaderExited())
      throw new Error(
        "An owned development process did not exit after cleanup.",
      );
    return;
  }
  const killGroup = options.killGroup || process.kill;
  const signal = (name) => {
    try {
      killGroup(-child.pid, name);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      throw error;
    }
  };
  // Detached POSIX process groups remain ours after the leader exits. Killing
  // only a live leader would leave surviving Metro workers behind on macOS.
  if (!signal("SIGTERM")) return;
  await wait();
  signal("SIGKILL");
}

function createDevelopmentSession(options = {}) {
  const root = options.root || ROOT;
  const runtime = options.runtime || process.execPath;
  const inspect = options.inspect || dependencyIssues;
  const issues = inspect(root);
  if (issues.length) throw new Error(installGuidance(issues));
  const serverArgs = options.serverArgs || sourceServerArgs(root);
  const expo = options.expo || packageBin(root, "expo", "expo");
  if (!serverArgs || !expo)
    throw new Error(
      installGuidance(["Development entry points are unavailable."]),
    );
  const spawnChild = options.spawn || spawn;
  const terminate = options.terminate || terminateOwnedProcess;
  const signals = options.signals || process;
  const log = options.log || console.log;
  const report = options.report || console.error;
  const env = options.env || process.env;
  const startup = new AbortController();
  const children = [];
  let stopping = false;
  let resolveDone;
  let stopPromise;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const onSignal = () => {
    void stop(0);
  };
  async function stop(code = 0) {
    if (stopPromise) return stopPromise;
    stopping = true;
    startup.abort();
    signals.removeListener("SIGINT", onSignal);
    signals.removeListener("SIGTERM", onSignal);
    stopPromise = Promise.allSettled(
      children.map((child) => Promise.resolve().then(() => terminate(child))),
    ).then((results) => {
      const failed = results.some((result) => result.status === "rejected");
      if (failed)
        report(
          "Some development processes could not be stopped. Inspect the owned child processes before restarting.",
        );
      resolveDone(failed ? 1 : code);
    });
    return stopPromise;
  }
  function launch(name, args, cwd, childEnv, ipc = false) {
    const child = spawnChild(runtime, args, {
      cwd,
      env: childEnv,
      stdio: ipc ? ["inherit", "inherit", "inherit", "ipc"] : "inherit",
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    children.push(child);
    child.once("error", () => {
      if (stopping) return;
      report(
        `${name} could not launch. Check its installed dependencies and runtime.`,
      );
      void stop(1);
    });
    child.once("exit", (code, signal) => {
      if (stopping) return;
      report(
        `${name} stopped${signal ? ` (${signal})` : ` (exit ${code ?? "unknown"})`}. Stopping the remaining development processes.`,
      );
      void stop(code || 1);
    });
    return child;
  }
  signals.on("SIGINT", onSignal);
  signals.on("SIGTERM", onSignal);
  const ready = (async () => {
    try {
      const api = launch(
        "API",
        serverArgs,
        path.join(root, "server"),
        runtimeEnvironment(runtime, env),
        true,
      );
      const address = await ownReadiness(
        api,
        options.readinessTimeoutMs || 15000,
        startup.signal,
      );
      const url = healthUrl(address);
      await verifyHealth(url, {
        fetch: options.fetch,
        signal: startup.signal,
        timeoutMs: options.healthTimeoutMs || 5000,
      });
      startup.signal.throwIfAborted();
      if (
        address.port !== 3001 &&
        !(options.readPublicApiUrl || publicApiUrl)(root, env)
      )
        throw new Error(
          "The API selected a non-default port, but EXPO_PUBLIC_API_URL is blank. Set the matching public app URL in the shell or root .env.local, then restart. Expo has not been started.",
        );
      const rest = options.args || [];
      const native = rest.includes("--ios") || rest.includes("--android");
      const args = [
        expo,
        "start",
        ...(!native && !rest.includes("--web") ? ["--web"] : []),
        ...rest,
      ];
      log(`Verified this API process at ${url}. Starting Expo.`);
      launch("Expo", args, root, clientEnvironment(runtime, env));
      return true;
    } catch (error) {
      if (!stopping)
        report(
          error instanceof Error
            ? error.message
            : "Development startup failed.",
        );
      await stop(1);
      return false;
    }
  })();
  return { ready, done, stop };
}

module.exports = {
  clientEnvironment,
  publicApiUrl,
  ownReadiness,
  healthUrl,
  verifyHealth,
  terminateOwnedProcess,
  createDevelopmentSession,
};
