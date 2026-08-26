import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { apiItems } from "./api";

export const tenantACertificationCompanyName = "AutomateX Certification Company A";
export const tenantBCertificationCompanyName = "AutomateX Certification Company B";

type CompanyItem = {
  id?: string;
  name?: string;
};

export function uniqueCertificationCompanyName(prefix = "AutomateX E2E Certification Company") {
  const configuredRunId = process.env.AUTOMATEX_E2E_RUN_ID?.trim();
  const runId = configuredRunId || `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `${prefix} ${runId}`;
}

export async function createCertificationCompany(
  page: Page,
  name = uniqueCertificationCompanyName(),
): Promise<string> {
  const response = await page.request.post("/api/companies", {
    data: {
      name,
      sectorId: "operations",
      employeeCount: 42,
      companySize: "small",
      primaryContactName: "Certification Owner",
      primaryContactRole: "Operations Director",
      country: "France",
      description: "Isolated certification company created by the Playwright E2E harness.",
      status: "client",
    },
  });
  expect([200, 201]).toContain(response.status());
  const payload = (await response.json()) as {
    data?: { id?: string; company?: { id?: string } };
    id?: string;
  };
  const id = payload.data?.company?.id ?? payload.data?.id ?? payload.id;
  expect(id, `Created certification company ${name} must return an id`).toBeTruthy();
  return id!;
}

export async function firstCompanyId(page: Page): Promise<string> {
  return certificationCompanyId(page, tenantACertificationCompanyName);
}

export async function tenantBCertificationCompanyId(page: Page): Promise<string> {
  return certificationCompanyId(page, tenantBCertificationCompanyName);
}

export async function certificationCompanyId(
  page: Page,
  expectedName = tenantACertificationCompanyName,
): Promise<string> {
  const response = await page.request.get(
    `/api/companies?search=${encodeURIComponent(expectedName)}`,
  );
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { data?: { items?: CompanyItem[] } | CompanyItem[] };
  const items = apiItems(payload);
  const id = items.find((company) => company.name === expectedName)?.id ?? items[0]?.id;
  expect(id, `Certification company ${expectedName} must exist`).toBeTruthy();
  return id!;
}

export async function fixtureCompanyId(name = tenantACertificationCompanyName): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  expect(databaseUrl, "DATABASE_URL is required for local company fixture lookup").toBeTruthy();
  const database = new pg.Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    const result = await database.query<{ id: string }>(
      `select id from public.companies where name = $1 and deleted_at is null limit 1`,
      [name],
    );
    const id = result.rows[0]?.id;
    expect(id, `Fixture company ${name} must exist`).toBeTruthy();
    return id;
  } finally {
    await database.end();
  }
}
