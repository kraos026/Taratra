import { expect, type Page } from "@playwright/test";
import type { PilotE2EConfig } from "./env";

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("email").fill(email);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 });
}

export async function loginAsTenantA(page: Page, config: PilotE2EConfig): Promise<void> {
  await loginAs(page, config.userAEmail, config.userAPassword);
}

export async function loginAsTenantB(page: Page, config: PilotE2EConfig): Promise<void> {
  await loginAs(page, config.userBEmail, config.userBPassword);
}
