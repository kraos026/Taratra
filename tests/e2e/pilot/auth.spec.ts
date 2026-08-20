import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("protected route rejects an anonymous browser", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/login/);
});

test("Tenant A authenticates and receives a session-backed companies response", async ({
  page,
}) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const response = await page.request.get("/api/companies");
  expect(response.status()).toBe(200);
  await page.reload();
  await expect(page).not.toHaveURL(/\/login/);
});
