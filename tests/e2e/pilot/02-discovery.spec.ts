import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { fixtureCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Discovery loads through the existing company-scoped route", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await fixtureCompanyId();
  await page
    .goto(`/companies/${companyId}/discovery`, { waitUntil: "domcontentloaded" })
    .catch((error: unknown) => {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    });
  expect(page.url()).not.toMatch(/\/login/);
});
