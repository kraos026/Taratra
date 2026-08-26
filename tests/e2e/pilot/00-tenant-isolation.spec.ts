import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { loginAsTenantB } from "./support/auth";
import { createCertificationCompany } from "./support/company";
import { pilotBrowserContextOptions, readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Tenant B cannot use a same-run Tenant A company identifier", async ({ browser }) => {
  test.setTimeout(180_000);
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");

  const aContext = await browser.newContext(pilotBrowserContextOptions(config!));
  const a = await aContext.newPage();
  await loginAsTenantA(a, config!);
  const tenantACompanyId = await createCertificationCompany(a);
  await aContext.close();

  const bContext = await browser.newContext(pilotBrowserContextOptions(config!));
  const b = await bContext.newPage();
  await loginAsTenantB(b, config!);
  const forbidden = await b.request.get(
    `/api/companies/${tenantACompanyId}/automation-audit/evidence-requests`,
  );
  expect([403, 404]).toContain(forbidden.status());
  await bContext.close();
});
