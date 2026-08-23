import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { apiItems } from "./api";

export const tenantACertificationCompanyName = "AutomateX Certification Company A";
export const tenantBCertificationCompanyName = "AutomateX Certification Company B";

type CompanyItem = {
  id?: string;
  name?: string;
};

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
