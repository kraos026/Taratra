import { expect, type Page } from "@playwright/test";
import type { PilotE2EConfig } from "./env";

async function gotoLogin(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto("/login", { timeout: 30_000, waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: /se connecter/i })).toBeEnabled({
        timeout: 10_000,
      });
      return;
    } catch (error) {
      if (attempt === 2 || !/ERR_ABORTED|frame was detached|Timeout/i.test(String(error))) {
        throw error;
      }
      await page
        .goto("about:blank", { timeout: 10_000, waitUntil: "domcontentloaded" })
        .catch(() => {});
    }
  }
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await gotoLogin(page);
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
