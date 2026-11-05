const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const NODE_GUIDANCE =
  "Use the project's validated Node 24 LTS (24.3+), Node 22.13+, or Node 26+. Set SOLACE_NODE to an absolute executable path if needed.";

// The installed Expo SDK 58 excludes Node 23/25 and early Node 22/24 releases.
function supportedNode(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(
    String(version).trim(),
  );
  if (!match) return false;
  const [, major, minor] = match.map(Number);
  return (
    (major === 22 && minor >= 13) || (major === 24 && minor >= 3) || major >= 26
  );
}

function probeVersion(executable) {
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function bundledWindowsRuntimes(env = process.env) {
  try {
    const base = path.join(
      env.ProgramFiles || "C:/Program Files",
      "WindowsApps",
    );
    return fs
      .readdirSync(base)
      .filter((folder) => folder.startsWith("OpenAI.CodexPrimaryRuntime."))
      .sort()
      .reverse()
      .map((folder) =>
        path.join(base, folder, "dependencies", "node", "bin", "node.exe"),
      );
  } catch {
    return [];
  }
}

function selectRuntime(options = {}) {
  const env = options.env || process.env;
  const current = options.current || process.execPath;
  const version = options.version || process.version;
  const exists = options.exists || fs.existsSync;
  const probe = options.probe || probeVersion;
  if (env.SOLACE_NODE) {
    if (
      !path.isAbsolute(env.SOLACE_NODE) ||
      !exists(env.SOLACE_NODE) ||
      !supportedNode(probe(env.SOLACE_NODE))
    )
      throw new Error(
        `SOLACE_NODE is not a supported Node executable. ${NODE_GUIDANCE}`,
      );
    return env.SOLACE_NODE;
  }
  if (supportedNode(version)) return current;
  let configured;
  try {
    configured = JSON.parse(
      fs.readFileSync(
        options.configFile || path.join(ROOT, ".solace-runtime.json"),
        "utf8",
      ),
    ).node;
  } catch {}
  const candidates = [configured];
  if ((options.platform || process.platform) === "win32")
    candidates.push(
      ...(options.windowsRuntimes || bundledWindowsRuntimes(env)),
    );
  for (const candidate of candidates) {
    if (
      candidate &&
      path.isAbsolute(candidate) &&
      exists(candidate) &&
      supportedNode(probe(candidate))
    )
      return candidate;
  }
  throw new Error(
    `This Node version cannot run the installed Expo SDK. ${NODE_GUIDANCE}`,
  );
}

function runtimeEnvironment(executable, env = process.env) {
  return {
    ...env,
    PATH: path.dirname(executable) + path.delimiter + (env.PATH || ""),
  };
}

function packageRequire(directory) {
  return createRequire(path.join(directory, "package.json"));
}

function packageBin(directory, name, bin = name) {
  try {
    const metadataPath = packageRequire(directory).resolve(
      `${name}/package.json`,
    );
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const relative =
      typeof metadata.bin === "string" ? metadata.bin : metadata.bin?.[bin];
    const target =
      relative && path.resolve(path.dirname(metadataPath), relative);
    return target && fs.existsSync(target) ? target : null;
  } catch {
    return null;
  }
}

function sourceServerArgs(root = ROOT) {
  try {
    // Direct loader launch keeps the API in the supervised Node process.
    const loader = packageRequire(path.join(root, "server")).resolve("tsx");
    if (!fs.existsSync(loader)) return null;
    return ["--import", pathToFileURL(loader).href, "src/index.ts"];
  } catch {
    return null;
  }
}

function dependencyIssues(root = ROOT, scope = "all") {
  const issues = [];
  if (scope !== "server") {
    if (!packageBin(root, "expo", "expo"))
      issues.push("Root Expo CLI is missing.");
    if (!packageBin(root, "typescript", "tsc"))
      issues.push("Root TypeScript compiler is missing.");
  }
  if (scope !== "root") {
    const directory = path.join(root, "server");
    if (!sourceServerArgs(root) || !packageBin(directory, "tsx"))
      issues.push(
        "Server TypeScript development dependency tsx is missing or incomplete.",
      );
    try {
      const metadata = JSON.parse(
        fs.readFileSync(path.join(directory, "package.json"), "utf8"),
      );
      for (const name of Object.keys(metadata.dependencies || {})) {
        try {
          packageRequire(directory).resolve(name);
        } catch {
          issues.push(`Server dependency ${name} is missing.`);
        }
      }
    } catch {
      issues.push("server/package.json cannot be read.");
    }
  }
  return issues;
}

function installGuidance(issues) {
  return `${issues.join("\n")}\nRun npm run setup from the project root. Root npm ci does not install server/ dependencies.\nFor an existing root install: npm --prefix server ci --include=dev --include=optional.\ntsx is a development dependency and is absent from production-only installs.`;
}

function findNpmCli(
  executable = process.execPath,
  env = process.env,
  exists = fs.existsSync,
) {
  const directory = path.dirname(executable);
  const candidates = [
    env.npm_execpath,
    path.join(directory, "node_modules/npm/bin/npm-cli.js"),
    path.resolve(directory, "../lib/node_modules/npm/bin/npm-cli.js"),
  ];
  for (const entry of (env.PATH || "").split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(entry, "node_modules/npm/bin/npm-cli.js"));
    try {
      const target = fs.realpathSync(path.join(entry, "npm"));
      if (target.endsWith("npm-cli.js")) candidates.push(target);
    } catch {}
  }
  const cli = candidates.find(
    (candidate) =>
      candidate &&
      path.basename(candidate) === "npm-cli.js" &&
      exists(candidate),
  );
  if (!cli)
    throw new Error(
      "npm CLI could not be located. Run this command through npm, or install npm for the selected Node runtime.",
    );
  return cli;
}

module.exports = {
  ROOT,
  NODE_GUIDANCE,
  supportedNode,
  probeVersion,
  selectRuntime,
  runtimeEnvironment,
  packageBin,
  packageRequire,
  sourceServerArgs,
  dependencyIssues,
  installGuidance,
  findNpmCli,
};
