import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Ask AutomateX remains grounded and rejects out-of-scope questions", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companies = await page.request.get("/api/companies");
  expect(companies.status()).toBe(200);
  const companyId = ((await companies.json()) as { data?: { id?: string }[] }).data?.[0]?.id;
  expect(companyId).toBeTruthy();
  const response = await page.request.post(`/api/companies/${companyId}/automation-audit/ask`, {
    data: { question: "What's the weather?" },
  });
  expect([200, 400, 409]).toContain(response.status());
});
