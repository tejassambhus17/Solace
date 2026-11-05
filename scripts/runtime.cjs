// Prefer the supported system Node; Codex Desktop on Windows also bundles a current runtime.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const [major, minor] = process.versions.node.split(".").map(Number);
let runtime = process.env.SOLACE_NODE || process.execPath;
try {
  const config = JSON.parse(
    fs.readFileSync(path.join(root, ".solace-runtime.json"), "utf8"),
  );
  if (
    !process.env.SOLACE_NODE &&
    (major < 22 || (major === 22 && minor < 13)) &&
    fs.existsSync(config.node)
  )
    runtime = config.node;
} catch {}
if (
  !process.env.SOLACE_NODE &&
  (major < 22 || (major === 22 && minor < 13)) &&
  process.platform === "win32"
) {
  try {
    const base = path.join(
      process.env.ProgramFiles || "C:/Program Files",
      "WindowsApps",
    );
    const candidates = fs
      .readdirSync(base)
      .filter((v) => v.startsWith("OpenAI.CodexPrimaryRuntime."))
      .sort()
      .reverse();
    for (const folder of candidates) {
      const candidate = path.join(
        base,
        folder,
        "dependencies",
        "node",
        "bin",
        "node.exe",
      );
      if (fs.existsSync(candidate)) {
        runtime = candidate;
        break;
      }
    }
  } catch {}
}
const version = spawnSync(runtime, ["--version"], { encoding: "utf8" });
if (version.error || !/^v(2[2-9]|[3-9]\d)\./.test(version.stdout || "")) {
  console.error(
    "Install Node 22.13+ / Node 24 LTS, or set SOLACE_NODE to its executable path.",
  );
  process.exit(1);
}
const [command, ...rest] = process.argv.slice(2);
const commands = {
  expo: { args: [path.join(root, "node_modules/expo/bin/cli"), ...rest] },
  tsc: { args: [path.join(root, "node_modules/typescript/bin/tsc"), ...rest] },
  dev: { args: [path.join(root, "scripts/dev.mjs"), ...rest] },
  server: {
    args: [
      path.join(root, "server/node_modules/tsx/dist/cli.mjs"),
      "src/index.ts",
      ...rest,
    ],
    cwd: path.join(root, "server"),
  },
  insights: {
    args: ["--test", path.join(root, "scripts/test-insights.mjs"), ...rest],
  },
  wellness: {
    args: ["--test", path.join(root, "scripts/test-wellness.mjs"), ...rest],
  },
  reminders: {
    args: ["--test", path.join(root, "scripts/test-reminders.cjs"), ...rest],
  },
  "session-state": {
    args: [
      "--test",
      path.join(root, "scripts/test-session-state.cjs"),
      ...rest,
    ],
  },
};
const job = commands[command];
if (!job) {
  console.error("Unknown Solace runtime command.");
  process.exit(1);
}
const result = spawnSync(runtime, job.args, {
  cwd: job.cwd || root,
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: path.dirname(runtime) + path.delimiter + process.env.PATH,
  },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
