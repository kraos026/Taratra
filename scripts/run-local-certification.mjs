import {
  assertLocalCertificationEnv,
  certificationEnv,
  ensureLocalSupabase,
  logPresence,
  runChecked,
  waitForLocalLogin,
} from "./local-certification-support.mjs";
import { configureSystemChromeForPlaywright } from "./system-chrome.mjs";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const bootstrapOnly = process.argv.includes("--bootstrap-only");
let appProcess = null;

function stopAppProcess() {
  if (!appProcess?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(appProcess.pid), "/t", "/f"], {
      encoding: "utf8",
      shell: false,
      stdio: "ignore",
    });
    appProcess = null;
    return;
  }
  appProcess.kill();
  appProcess = null;
}

process.on("exit", () => {
  stopAppProcess();
});
process.on("SIGINT", () => {
  stopAppProcess();
  process.exit(130);
});

console.log("TARGET = local Supabase");
console.log("ENVIRONMENT = LOCAL CERTIFICATION");
console.log("PRODUCTION = NO");
console.log("REMOTE SUPABASE = FORBIDDEN");

const supabaseValues = await ensureLocalSupabase();
const env = certificationEnv(supabaseValues);
assertLocalCertificationEnv(env);
const browser = configureSystemChromeForPlaywright(env);
console.log(`SYSTEM CHROME FOUND = ${browser.found ? "YES" : "NO"}`);
console.log(`PLAYWRIGHT BROWSER PROVIDER = ${browser.provider}`);
console.log(`PLAYWRIGHT BROWSER CHANNEL = ${browser.channel ?? "NONE"}`);
console.log(`PLAYWRIGHT EXECUTABLE DETECTED = ${browser.executablePath ? "YES" : "NO"}`);
console.log("PLAYWRIGHT BUNDLED BROWSER REQUIRED = NO");

if (process.platform === "win32" && !browser.found) {
  throw new Error("LOCAL CERTIFICATION: SYSTEM CHROME FOUND = NO");
}

logPresence(env);

runChecked(process.execPath, ["scripts/certification-db-guard.mjs"], env);
runChecked(process.execPath, ["scripts/validate-pilot-certification-env.mjs"], env);
runChecked("npx", ["prisma", "validate"], env);
runChecked("npx", ["prisma", "generate"], env);
runChecked(process.execPath, ["scripts/ensure-local-certification-identities.mjs"], env);
runChecked("npm", ["run", "build"], env);

appProcess = await startProductionApp(env);
runChecked(process.execPath, ["scripts/playwright-system-chrome-smoke.mjs"], env);

if (bootstrapOnly) {
  console.log("LOCAL CERTIFICATION BOOTSTRAP: PASS");
  process.exit(0);
}

const pilotFiles = [
  "tests/e2e/pilot/00-tenant-isolation.spec.ts",
  "tests/e2e/pilot/01-stale-state.spec.ts",
  "tests/e2e/pilot/02-discovery.spec.ts",
  "tests/e2e/pilot/ask-automatex.spec.ts",
  "tests/e2e/pilot/auth.spec.ts",
  "tests/e2e/pilot/company.spec.ts",
  "tests/e2e/pilot/evidence.spec.ts",
  "tests/e2e/pilot/idempotency.spec.ts",
  "tests/e2e/pilot/interview.spec.ts",
  "tests/e2e/pilot/zz-decision-center.spec.ts",
];

console.log(`LOCAL CERTIFICATION PLAYWRIGHT FILES = ${pilotFiles.length}`);
for (const file of pilotFiles) {
  stopAppProcess();
  appProcess = await startProductionApp(env);
  console.log(`LOCAL CERTIFICATION PLAYWRIGHT: ${file}`);
  runChecked("npx", ["playwright", "test", file], env);
}

console.log("LOCAL CERTIFICATION: PASS");

async function startProductionApp(env) {
  console.log("LOCAL APP: starting production server on http://localhost:3000");
  const npm = executableForPlatform("npm");
  const child = spawn(
    npm.command,
    [...npm.argsPrefix, "run", "start", "--", "-H", "localhost", "-p", "3000"],
    {
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (data) => {
    const text = data.toString();
    if (/ready|started|local/i.test(text)) process.stdout.write(text);
  });
  child.stderr.on("data", (data) => process.stderr.write(data.toString()));
  await waitForLocalLogin(90_000);
  return child;
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
