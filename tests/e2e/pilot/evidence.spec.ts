import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loginAsTenantA } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("evidence request and bounded evidence submission use durable routes", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companies = await page.request.get("/api/companies");
  expect(companies.status()).toBe(200);
  const companyId = ((await companies.json()) as { data?: { id?: string }[] }).data?.[0]?.id;
  expect(companyId).toBeTruthy();

  const requests = await page.request.get(
    `/api/companies/${companyId}/automation-audit/evidence-requests`,
  );
  expect(requests.status()).toBe(200);
  const created = await page.request.post(
    `/api/companies/${companyId}/automation-audit/evidence-requests`,
    {
      data: {
        target: "SYSTEM_EVIDENCE",
        requestedEvidenceType: "CSV_EXPORT",
        reason: "Certification evidence request",
        gapId: "certification-gap",
        actionId: "certification-action",
      },
    },
  );
  expect([200, 201]).toContain(created.status());
  const createdPayload = (await created.json()) as { data?: { requestId?: string; id?: string } };
  const requestId = createdPayload.data?.requestId ?? createdPayload.data?.id;
  expect(requestId).toBeTruthy();
  const csv = await readFile(
    resolve(process.cwd(), "tests/e2e/pilot/fixtures/synthetic-evidence.csv"),
    "utf8",
  );
  const evidence = await page.request.post(
    `/api/companies/${companyId}/automation-audit/evidence`,
    {
      data: {
        requestId,
        sourceId: "certification-csv",
        sourceVersion: 1,
        sourceType: "CSV_EXPORT",
        rawContent: csv,
        origin: "Synthetic certification fixture",
        authorOrSystem: "certification-runner",
      },
    },
  );
  expect([200, 201, 409]).toContain(evidence.status());
});
