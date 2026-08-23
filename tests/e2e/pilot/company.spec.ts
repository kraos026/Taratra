import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Tenant A company journey uses real API data", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  await page.goto(`/companies/${companyId}`, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
});
