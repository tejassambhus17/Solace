const fs = require("node:fs");
const path = require("node:path");
const {
  ROOT,
  dependencyIssues,
  installGuidance,
  findNpmCli,
  supportedNode,
  NODE_GUIDANCE,
  packageRequire,
} = require("./tooling.cjs");

function doctor(options = {}) {
  if (!supportedNode(process.version)) throw new Error(NODE_GUIDANCE);
  const root = options.root || ROOT;
  const log = options.log || console.log;
  log(`Selected runtime: ${process.version} (${process.execPath})`);
  findNpmCli(process.execPath);
  const issues = dependencyIssues(root);
  for (const directory of [root, path.join(root, "server")])
    if (!fs.existsSync(path.join(directory, "package-lock.json")))
      issues.push(
        `${path.relative(root, directory) || "Root"} package-lock.json is missing.`,
      );
  if (issues.length) throw new Error(installGuidance(issues));
  try {
    const serverRequire = packageRequire(path.join(root, "server"));
    serverRequire("sharp");
    serverRequire("esbuild").transformSync("const ready: boolean = true", {
      loader: "ts",
    });
  } catch {
    throw new Error(
      "A server platform binary (Sharp/esbuild) could not load. Run npm run setup on this computer; do not copy node_modules between Windows, macOS, CPU architectures or Node installations.",
    );
  }
  log(
    "Root Expo/TypeScript and server dependencies, including tsx, are available.",
  );
  log(
    "Server Sharp and TypeScript-transform platform binaries loaded successfully.",
  );
  for (const filename of [".env", "server/.env"])
    log(
      `${filename}: ${fs.existsSync(path.join(root, filename)) ? "present (contents not printed)" : "absent; explicit environment or defaults will be used"}`,
    );
  log(
    `Built API: ${fs.existsSync(path.join(root, "server/dist/index.js")) ? "present" : "not built; run npm --prefix server run build before production start"}`,
  );
  log(
    "These are development-install checks. API startup, database persistence, authentication, real AI and simulator/device reachability must be verified separately.",
  );
  return 0;
}

module.exports = { doctor };
if (require.main === module) {
  try {
    process.exitCode = doctor();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
