import {
  assertLocalCertificationEnv,
  cleanNextArtifacts,
  certificationEnv,
  ensureLocalSupabase,
  logPresence,
  runChecked,
  startProductionApp,
  stopProcessTree,
} from "./local-certification-support.mjs";
import { configureSystemChromeForPlaywright } from "./system-chrome.mjs";
import { discoverPilotTests } from "./pilot-test-files.mjs";

const bootstrapOnly = process.argv.includes("--bootstrap-only");
let appProcess = null;

function stopAppProcess() {
  stopProcessTree(appProcess);
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
runChecked(process.execPath, ["scripts/check-local-migrations.mjs"], env);
runChecked(process.execPath, ["scripts/validate-pilot-certification-env.mjs"], env);
runChecked("npx", ["prisma", "validate"], env);
runChecked("npx", ["prisma", "generate"], env);
runChecked(process.execPath, ["scripts/ensure-local-certification-identities.mjs"], env);
cleanNextArtifacts();
runChecked("npm", ["run", "build"], env);

appProcess = await startProductionApp(env);
runChecked(process.execPath, ["scripts/playwright-system-chrome-smoke.mjs"], env);

if (bootstrapOnly) {
  console.log("LOCAL CERTIFICATION BOOTSTRAP: PASS");
  process.exit(0);
}

const pilotFiles = discoverPilotTests();
if (pilotFiles.length === 0) throw new Error("LOCAL CERTIFICATION: no pilot tests found");

console.log(`LOCAL CERTIFICATION PLAYWRIGHT FILES = ${pilotFiles.length}`);
for (const file of pilotFiles) {
  stopAppProcess();
  appProcess = await startProductionApp(env);
  console.log(`LOCAL CERTIFICATION PLAYWRIGHT: ${file}`);
  runChecked("npx", ["playwright", "test", file], env);
}

console.log("LOCAL CERTIFICATION: PASS");
