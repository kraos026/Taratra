import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("eligible real company exposes the production decision center", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const response = await page.request.get("/api/companies");
  expect(response.status()).toBe(200);
  const companyId = ((await response.json()) as { data?: { id?: string }[] }).data?.[0]?.id;
  expect(companyId).toBeTruthy();
  await page.goto(`/companies/${companyId}/automation-audit/decision-center`);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/decision|décision/i).first()).toBeVisible();
});
