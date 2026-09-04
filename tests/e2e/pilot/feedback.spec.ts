import { expect, test } from "@playwright/test";
import pg from "pg";
import { loginAsTenantA, loginAsTenantB } from "./support/auth";
import { createCertificationCompany, firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

const feedback = {
  understandingScore: 5,
  recommendationRelevanceScore: 4,
  roiCredibilityScore: 3,
  nextStepClarityScore: 4,
  experienceScore: 5,
  willingToPay: "YES",
  acceptablePrice: 99,
  priceCurrency: "EUR",
  comment: "Retour local de certification.",
};

test("pre-audit feedback stays visible and is attached without duplication after audit creation", async ({
  page,
}) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await createCertificationCompany(page, `Optivos Feedback ${Date.now()}`);

  const created = await page.request.post("/api/pilot-feedback", {
    data: { companyId, ...feedback },
  });
  expect(created.status()).toBe(200);
  const createdBody = (await created.json()) as { data: { id: string; auditId: null } };
  expect(createdBody.data.auditId).toBeNull();

  const auditId = await insertAudit(companyId);
  const afterAudit = await page.request.get(`/api/pilot-feedback?companyId=${companyId}`);
  expect(afterAudit.status()).toBe(200);
  await expect(afterAudit.json()).resolves.toMatchObject({
    data: { id: createdBody.data.id, auditId: null },
  });

  const updated = await page.request.patch("/api/pilot-feedback", {
    data: { companyId, ...feedback, experienceScore: 4 },
  });
  expect(updated.status()).toBe(200);
  await expect(updated.json()).resolves.toMatchObject({
    data: { id: createdBody.data.id, auditId, experienceScore: 4 },
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /modifier mon avis/i })).toBeVisible();
  await expect(feedbackCount(companyId)).resolves.toBe(1);
});

test("Tenant A creates, reads, updates and retries one pilot feedback", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const auditId = await createFreshAudit(companyId);

  const created = await page.request.post("/api/pilot-feedback", {
    data: { companyId, ...feedback },
  });
  expect(created.status()).toBe(200);
  const createdBody = (await created.json()) as {
    data: { id: string; companyId: string; auditId: string };
  };
  expect(createdBody.data.companyId).toBe(companyId);
  expect(createdBody.data.auditId).toBe(auditId);

  const read = await page.request.get(`/api/pilot-feedback?companyId=${companyId}`);
  expect(read.status()).toBe(200);
  await expect(read.json()).resolves.toMatchObject({
    data: { id: createdBody.data.id, ...feedback },
  });

  const updatedInput = {
    ...feedback,
    experienceScore: 4,
    willingToPay: "UNSURE",
    acceptablePrice: undefined,
    priceCurrency: undefined,
    comment: "Avis modifié sans créer de doublon.",
  };
  const updated = await page.request.patch("/api/pilot-feedback", {
    data: { companyId, ...updatedInput },
  });
  expect(updated.status()).toBe(200);
  await expect(updated.json()).resolves.toMatchObject({
    data: { id: createdBody.data.id, experienceScore: 4, willingToPay: "UNSURE" },
  });

  const retried = await page.request.post("/api/pilot-feedback", {
    data: { companyId, ...updatedInput },
  });
  expect(retried.status()).toBe(200);

  const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  try {
    const count = await database.query<{ count: string }>(
      "select count(*) from public.pilot_feedback where company_id = $1",
      [companyId],
    );
    expect(Number(count.rows[0]?.count)).toBe(1);
  } finally {
    await database.end();
  }
});

async function createFreshAudit(companyId: string): Promise<string> {
  const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  try {
    await database.query("delete from public.pilot_feedback where company_id = $1", [companyId]);
    const inserted = await database.query<{ id: string }>(
      `insert into public.audits(organization_id, company_id, status)
       select organization_id, id, 'draft' from public.companies where id = $1
       returning id`,
      [companyId],
    );
    expect(inserted.rows[0]?.id).toBeTruthy();
    return inserted.rows[0]!.id;
  } finally {
    await database.end();
  }
}

async function insertAudit(companyId: string): Promise<string> {
  const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  try {
    const inserted = await database.query<{ id: string }>(
      `insert into public.audits(organization_id, company_id, status)
       select organization_id, id, 'draft' from public.companies where id = $1
       returning id`,
      [companyId],
    );
    expect(inserted.rows[0]?.id).toBeTruthy();
    return inserted.rows[0]!.id;
  } finally {
    await database.end();
  }
}

async function feedbackCount(companyId: string): Promise<number> {
  const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  try {
    const result = await database.query<{ count: string }>(
      "select count(*) from public.pilot_feedback where company_id = $1",
      [companyId],
    );
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await database.end();
  }
}

test("pilot feedback rejects invalid values without writing", async ({ page }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const invalidInputs = [
    { ...feedback, understandingScore: 0 },
    { ...feedback, understandingScore: 6 },
    { ...feedback, understandingScore: 1.5 },
    { ...feedback, acceptablePrice: -1 },
    { ...feedback, willingToPay: "MAYBE" },
    { ...feedback, comment: "x".repeat(2001) },
    { ...feedback, experienceScore: undefined },
  ];

  for (const input of invalidInputs) {
    const response = await page.request.post("/api/pilot-feedback", {
      data: { companyId, ...input },
    });
    expect(response.status()).toBe(400);
  }
});

test("Tenant B cannot read or write Tenant A feedback", async ({ browser }) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  const tenantA = await browser.newPage();
  await loginAsTenantA(tenantA, config!);
  const companyId = await firstCompanyId(tenantA);
  await tenantA.close();

  const tenantB = await browser.newPage();
  await loginAsTenantB(tenantB, config!);
  expect((await tenantB.request.get(`/api/pilot-feedback?companyId=${companyId}`)).status()).toBe(
    404,
  );
  expect(
    (
      await tenantB.request.post("/api/pilot-feedback", { data: { companyId, ...feedback } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await tenantB.request.patch("/api/pilot-feedback", { data: { companyId, ...feedback } })
    ).status(),
  ).toBe(404);
  await tenantB.close();
});

test("dashboard feedback dialog is usable on mobile and preserves the saved state", async ({
  page,
}) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await page.setViewportSize({ width: 412, height: 915 });
  await loginAsTenantA(page, config!);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const trigger = page.getByRole("button", { name: /modifier mon avis|donner mon avis/i });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /aidez-nous à améliorer Optivos/i });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(412);

  for (const [index, score] of [5, 4, 3, 4, 5].entries()) {
    await dialog.locator("fieldset").nth(index).getByText(String(score), { exact: true }).click();
  }
  await dialog.getByText("Je ne sais pas encore", { exact: true }).click();
  await dialog.getByLabel(/un commentaire/i).fill("Validation mobile du feedback Optivos.");
  await dialog.getByRole("button", { name: /enregistrer|envoyer/i }).click();
  await expect(dialog.getByText("Merci pour votre retour.")).toBeVisible();
  await dialog.getByRole("button", { name: "Terminer" }).click();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /modifier mon avis/i })).toBeVisible();
});
