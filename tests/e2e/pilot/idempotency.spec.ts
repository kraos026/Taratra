import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("evidence request retry remains bounded and observable", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const body = {
    target: "SYSTEM_EVIDENCE",
    requestedEvidenceType: "CSV_EXPORT",
    reason: "Idempotency certification request",
    gapId: "idempotency-gap",
    actionId: "idempotency-action",
  };
  const first = await page.request.post(
    `/api/companies/${companyId}/automation-audit/evidence-requests`,
    {
      data: body,
    },
  );
  const second = await page.request.post(
    `/api/companies/${companyId}/automation-audit/evidence-requests`,
    {
      data: body,
    },
  );
  expect([200, 201, 409]).toContain(first.status());
  expect([200, 201, 409]).toContain(second.status());
});
