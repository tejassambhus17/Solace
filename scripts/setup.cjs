const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  ROOT,
  findNpmCli,
  runtimeEnvironment,
  dependencyIssues,
  installGuidance,
  supportedNode,
  NODE_GUIDANCE,
} = require("./tooling.cjs");

function setup(options = {}) {
  if (!supportedNode(process.version)) throw new Error(NODE_GUIDANCE);
  const root = options.root || ROOT;
  const runtime = options.runtime || process.execPath;
  const run = options.run || spawnSync;
  const log = options.log || console.log;
  const npm = options.npm || findNpmCli(runtime);
  for (const directory of [root, path.join(root, "server")]) {
    if (!fs.existsSync(path.join(directory, "package-lock.json")))
      throw new Error(
        `A package-lock.json is required in ${directory}. Restore the repository lockfile before installing.`,
      );
  }
  const steps = [
    {
      label: "Installing app dependencies from package-lock.json",
      cwd: root,
      args: ["ci", "--include=dev", "--include=optional"],
    },
    {
      label: "Installing API dependencies from server/package-lock.json",
      cwd: path.join(root, "server"),
      args: ["ci", "--include=dev", "--include=optional"],
    },
    {
      label: "Building the API for its production start command",
      cwd: path.join(root, "server"),
      args: ["run", "build"],
    },
  ];
  for (const step of steps) {
    log(step.label);
    const result = run(runtime, [npm, ...step.args], {
      cwd: step.cwd,
      stdio: "inherit",
      env: runtimeEnvironment(runtime),
      windowsHide: true,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `${step.label} failed. No setup success is being reported. Fix the npm error above, then rerun npm run setup.`,
      );
  }
  for (const directory of [root, path.join(root, "server")]) {
    const destination = path.join(directory, ".env");
    const example = path.join(directory, ".env.example");
    if (!fs.existsSync(example)) continue;
    try {
      fs.copyFileSync(example, destination, fs.constants.COPYFILE_EXCL);
      log(
        `Created ${path.relative(root, destination)} from its example; existing env files are never overwritten.`,
      );
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const issues = (options.inspect || dependencyIssues)(root);
  if (issues.length) throw new Error(installGuidance(issues));
  log(
    "Dependency setup and API build completed. Run npm run doctor, then npm run dev. Live AI and device reachability require separate verification.",
  );
  return 0;
}

module.exports = { setup };
if (require.main === module) {
  try {
    process.exitCode = setup();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
