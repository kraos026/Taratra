import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Tenant A company journey uses real API data", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const response = await page.request.get("/api/companies");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { data?: { id?: string }[] };
  const companyId = payload.data?.[0]?.id;
  expect(companyId, "Tenant A requires a certification company").toBeTruthy();
  await page.goto(`/companies/${companyId}`);
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(`/companies/${companyId}/automation-audit`);
  await expect(page).not.toHaveURL(/\/login/);
});
