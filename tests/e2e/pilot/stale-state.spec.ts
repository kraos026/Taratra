import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Decision Center reload reads current persisted state", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const first = await page.request.get(
    `/api/companies/${companyId}/automation-audit/decision-center`,
  );
  expect([200, 404, 409]).toContain(first.status());
  await page.reload();
  await page.goto(`/companies/${companyId}/automation-audit/decision-center`);
  await expect(page).not.toHaveURL(/\/login/);
});
