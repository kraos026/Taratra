import { expect, type Page } from "@playwright/test";

export async function firstCompanyId(page: Page): Promise<string> {
  const response = await page.request.get("/api/companies");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { data?: { id?: string }[] };
  const id = payload.data?.[0]?.id;
  expect(id, "A certification company must exist").toBeTruthy();
  return id!;
}
