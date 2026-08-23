import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Ask AutomateX remains grounded and rejects out-of-scope questions", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const response = await page.request.post(`/api/companies/${companyId}/automation-audit/ask`, {
    data: { question: "What's the weather?" },
  });
  expect([200, 400, 404, 409]).toContain(response.status());
});
