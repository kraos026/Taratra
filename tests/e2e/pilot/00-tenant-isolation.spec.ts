import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { fixtureCompanyId, tenantBCertificationCompanyName } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Tenant A cannot use a Tenant B company identifier", async ({ browser }) => {
  test.setTimeout(180_000);
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  const tenantBCompanyId = await fixtureCompanyId(tenantBCertificationCompanyName);

  const aContext = await browser.newContext();
  const a = await aContext.newPage();
  await loginAsTenantA(a, config!);
  const forbidden = await a.request.get(
    `/api/companies/${tenantBCompanyId}/automation-audit/evidence-requests`,
  );
  expect([403, 404]).toContain(forbidden.status());
  await aContext.close();
});
