const path = require("node:path");
const { spawnSync, spawn } = require("node:child_process");
const {
  ROOT,
  selectRuntime,
  runtimeEnvironment,
  packageBin,
  sourceServerArgs,
  dependencyIssues,
  installGuidance,
  findNpmCli,
} = require("./tooling.cjs");

function runSupervisedCommand(runtime, job, options = {}) {
  const signals = options.signals || process;
  const child = (options.spawn || spawn)(runtime, job.args, {
    cwd: job.cwd || ROOT,
    stdio: "inherit",
    env: runtimeEnvironment(runtime),
    windowsHide: true,
  });
  return new Promise((resolve, reject) => {
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    const cleanup = () => {
      signals.removeListener("SIGINT", interrupt);
      signals.removeListener("SIGTERM", terminate);
    };
    signals.on("SIGINT", interrupt);
    signals.on("SIGTERM", terminate);
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolve(
        code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1),
      );
    });
  });
}

async function main() {
  const runtime = selectRuntime();
  const [command, ...rest] = process.argv.slice(2);
  const file = (name) => path.join(ROOT, "scripts", name);
  const commands = {
    setup: { args: [file("setup.cjs"), ...rest] },
    doctor: { args: [file("doctor.cjs"), ...rest] },
    tooling: { args: ["--test", file("test-tooling.cjs"), ...rest] },
    dev: { args: [file("dev.mjs"), ...rest] },
    "native-config": {
      args: ["--test", file("test-native-config.cjs"), ...rest],
    },
    "google-auth": {
      args: ["--test", file("test-google-auth-flow.cjs"), ...rest],
    },
    moments: { args: ["--test", file("test-moments.cjs"), ...rest] },
    navigation: { args: ["--test", file("test-navigation.cjs"), ...rest] },
    voice: { args: ["--test", file("test-voice.cjs"), ...rest] },
    "companion-actions": {
      args: ["--test", file("test-companion-actions.cjs"), ...rest],
    },
    "ambient-mixer": {
      args: ["--test", file("test-ambient-mixer.cjs"), ...rest],
    },
    progress: { args: ["--test", file("test-progress.cjs"), ...rest] },
    insights: { args: ["--test", file("test-insights.mjs"), ...rest] },
    routine: { args: ["--test", file("test-routine.mjs"), ...rest] },
    offline: { args: ["--test", file("test-offline.cjs"), ...rest] },
    wellness: { args: ["--test", file("test-wellness.mjs"), ...rest] },
    reminders: { args: ["--test", file("test-reminders.cjs"), ...rest] },
    "session-state": {
      args: ["--test", file("test-session-state.cjs"), ...rest],
    },
    "api-config": { args: ["--test", file("test-api-config.cjs"), ...rest] },
  };
  if (command === "npm")
    commands.npm = { args: [findNpmCli(runtime), ...rest] };
  if (command === "expo" || command === "tsc") {
    const target =
      command === "expo"
        ? packageBin(ROOT, "expo", "expo")
        : packageBin(ROOT, "typescript", "tsc");
    if (!target)
      throw new Error(
        installGuidance([`Root ${command} development tool is missing.`]),
      );
    commands[command] = { args: [target, ...rest] };
  }
  if (command === "server") {
    const issues = dependencyIssues(ROOT, "server");
    if (issues.length) throw new Error(installGuidance(issues));
    commands.server = {
      args: [...sourceServerArgs(ROOT), ...rest],
      cwd: path.join(ROOT, "server"),
    };
  }
  const job = commands[command];
  if (!job) throw new Error("Unknown Solace runtime command.");
  // A targeted termination of this wrapper must reach the dev supervisor,
  // whose owned process groups contain the API and Metro workers.
  if (command === "dev") return runSupervisedCommand(runtime, job);
  const result = spawnSync(runtime, job.args, {
    cwd: job.cwd || ROOT,
    stdio: "inherit",
    env: runtimeEnvironment(runtime),
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
module.exports = { main, runSupervisedCommand };
if (require.main === module)
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Solace could not start.",
      );
      process.exitCode = 1;
    });
