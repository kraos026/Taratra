import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const command = process.env.AUTOMATEX_PILOT_RESTART_COMMAND;
if (!command) {
  console.error(
    "RESTART HARNESS PENDING: set AUTOMATEX_PILOT_RESTART_COMMAND to the staging app restart command.",
  );
  process.exit(2);
}

const [executable, ...args] = parseCommandLine(command);
const resolved = executableForPlatform(executable);
const result = spawnSync(resolved.command, [...resolved.argsPrefix, ...args], {
  shell: false,
  stdio: "inherit",
});
process.exit(result.status ?? 1);

function parseCommandLine(value) {
  const tokens = [];
  let current = "";
  let quoted = false;

  for (const char of value.trim()) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === " " && !quoted) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  if (tokens.length === 0) {
    throw new Error("RESTART HARNESS PENDING: restart command is empty.");
  }
  return tokens;
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
