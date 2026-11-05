import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Solace requires Node 22.13+ (Node 24 LTS recommended).");
  process.exit(1);
}
const children = [
  spawn(
    process.execPath,
    [resolve(root, "server/node_modules/tsx/dist/cli.mjs"), "src/index.ts"],
    { cwd: resolve(root, "server"), stdio: "inherit", env: process.env },
  ),
  spawn(
    process.execPath,
    [resolve(root, "node_modules/expo/bin/cli"), "start", "--web"],
    { cwd: root, stdio: "inherit", env: process.env },
  ),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}
for (const child of children)
  child.on("exit", (code) => {
    if (!stopping) {
      stop();
      process.exitCode = code ?? 1;
    }
  });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
