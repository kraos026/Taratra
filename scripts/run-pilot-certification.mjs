import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const envCheck = spawnSync(process.execPath, ["scripts/validate-pilot-certification-env.mjs"], {
  stdio: "inherit",
  shell: false,
});
if (envCheck.status !== 0) process.exit(envCheck.status ?? 1);

const commands = [
  ["npx", ["prisma", "validate"]],
  ["npx", ["prisma", "generate"]],
  ["npx", ["prisma", "migrate", "status"]],
  ["npm", ["run", "test:rls"]],
  ["npx", ["playwright", "test", "tests/e2e/pilot"]],
];

for (const [command, args] of commands) {
  const executable = executableForPlatform(command);
  const result = spawnSync(executable.command, [...executable.argsPrefix, ...args], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function executableForPlatform(command) {
  if (process.platform !== "win32") return { command, argsPrefix: [] };
  if (command === "npm") return nodeCliExecutable("npm-cli.js");
  if (command === "npx") return nodeCliExecutable("npx-cli.js");
  return { command, argsPrefix: [] };
}

function nodeCliExecutable(cliFileName) {
  const cliPath = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    cliFileName,
  );
  if (!fs.existsSync(cliPath)) {
    return { command: cliFileName === "npm-cli.js" ? "npm.cmd" : "npx.cmd", argsPrefix: [] };
  }
  return { command: process.execPath, argsPrefix: [cliPath] };
}
