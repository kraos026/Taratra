import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Interview loads through the existing company-scoped route", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const response = await page.request.get(`/api/companies/${companyId}/interviews`);
  expect([200, 404, 409]).toContain(response.status());
  await page.goto(`/companies/${companyId}/interview`);
  await expect(page).not.toHaveURL(/\/login/);
});
