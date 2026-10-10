import {
  assertLocalCertificationEnv,
  certificationEnv,
  ensureLocalSupabase,
  runChecked,
  startProductionApp,
  stopProcessTree,
} from "./local-certification-support.mjs";
import { configureSystemChromeForPlaywright } from "./system-chrome.mjs";

console.log("DATA PROFILE TEST TARGET = LOCAL FICTITIOUS ONLY; PRODUCTION/STAGING MUTATIONS = NO");
const values = await ensureLocalSupabase();
const env = certificationEnv(values);
assertLocalCertificationEnv(env);
configureSystemChromeForPlaywright(env);
runChecked(process.execPath, ["scripts/check-local-migrations.mjs"], env);
runChecked(process.execPath, ["scripts/ensure-local-certification-identities.mjs"], env);
runChecked("npm", ["run", "build"], env);
let app;
process.on("exit", () => stopProcessTree(app));
try {
  app = await startProductionApp(env);
  runChecked("npx", ["playwright", "test", "tests/e2e/pilot/data-profile.spec.ts"], env);
} finally {
  stopProcessTree(app);
}
