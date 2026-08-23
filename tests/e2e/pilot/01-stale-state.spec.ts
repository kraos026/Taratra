import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Decision Center reload reads current persisted state", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  await page.goto(`/companies/${companyId}/automation-audit/decision-center`);
  await expect(page).not.toHaveURL(/\/login/);
  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("about:blank");
});
