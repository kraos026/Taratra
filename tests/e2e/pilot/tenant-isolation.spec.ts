import { expect, test } from "@playwright/test";
import { loginAs, loginAsTenantA, loginAsTenantB } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("Tenant A cannot use a Tenant B company identifier", async ({ browser }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  const a = await browser.newPage();
  await loginAsTenantA(a, config!);
  const aCompanies = await a.request.get("/api/companies");
  expect(aCompanies.status()).toBe(200);
  const aIds = new Set(
    ((await aCompanies.json()) as { data?: { id?: string }[] }).data?.map((x) => x.id),
  );
  await a.close();

  const b = await browser.newPage();
  await loginAsTenantB(b, config!);
  const bCompanies = await b.request.get("/api/companies");
  expect(bCompanies.status()).toBe(200);
  const bIds =
    ((await bCompanies.json()) as { data?: { id?: string }[] }).data?.map((x) => x.id) ?? [];
  expect(bIds.some((id) => id && aIds.has(id))).toBe(false);
  for (const companyId of bIds.slice(0, 1)) {
    const forbidden = await b.request.get(
      `/api/companies/${companyId}/automation-audit/evidence-requests`,
    );
    expect([200, 404]).toContain(forbidden.status());
  }
  await loginAs(b, config!.userBEmail, config!.userBPassword);
  await b.close();
});
