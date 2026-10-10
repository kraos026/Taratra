import {
  assertLocalCertificationEnv,
  certificationEnv,
  ensureLocalSupabase,
  runChecked,
  startProductionApp,
  stopProcessTree,
} from "./local-certification-support.mjs";
import { configureSystemChromeForPlaywright } from "./system-chrome.mjs";
console.log("PRIVACY REQUEST TEST: LOCAL SYNTHETIC ONLY; NO REMOTE MUTATIONS");
const env = certificationEnv(await ensureLocalSupabase());
assertLocalCertificationEnv(env);
configureSystemChromeForPlaywright(env);
runChecked(process.execPath, ["scripts/check-local-migrations.mjs"], env);
runChecked(process.execPath, ["scripts/ensure-local-certification-identities.mjs"], env);
runChecked("npm", ["run", "build"], env);
let app;
process.on("exit", () => stopProcessTree(app));
try {
  app = await startProductionApp(env);
  runChecked(
    "npx",
    [
      "playwright",
      "test",
      "tests/e2e/pilot/privacy-requests.spec.ts",
      "tests/e2e/pilot/data-profile.spec.ts",
    ],
    env,
  );
} finally {
  stopProcessTree(app);
}
