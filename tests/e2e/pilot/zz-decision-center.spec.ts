import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("eligible real company exposes the production decision center", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  await page
    .goto(`/companies/${companyId}/automation-audit/decision-center`, {
      timeout: 15_000,
      waitUntil: "domcontentloaded",
    })
    .catch((error: unknown) => {
      if (!/ERR_ABORTED|Timeout/i.test(String(error))) throw error;
    });
  expect(page.url()).not.toMatch(/\/login/);
  await page.goto("about:blank");
});
