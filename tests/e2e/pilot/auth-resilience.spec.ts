import { expect, test } from "@playwright/test";

test("signup has labelled fields, consistent branding and a safe recoverable provider error", async ({
  page,
}) => {
  await page.route("**/auth/v1/signup*", (route) =>
    route.fulfill({
      status: 400,
      json: { code: "unexpected_failure", msg: "private provider detail" },
    }),
  );
  await page.goto("/signup");
  await expect(page.getByText("Optivos", { exact: true })).toBeVisible();
  await page.getByLabel("Adresse e-mail").fill("browser-fixture@example.invalid");
  await page.getByLabel("Mot de passe", { exact: true }).fill("Browser-fixture-only-2026!");
  const submit = page.getByRole("button", { name: "Créer mon compte" });
  await submit.click();
  await expect(page.getByRole("status")).toContainText("Création du compte impossible");
  await expect(page.getByRole("status")).not.toContainText("private provider detail");
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue("browser-fixture@example.invalid");
  await expect(page).toHaveURL(/\/signup$/);
});

test("login presents rate limiting without blaming credentials or remaining disabled", async ({
  page,
}) => {
  await page.route("**/auth/v1/token*", (route) =>
    route.fulfill({
      status: 429,
      json: { code: "over_request_rate_limit", msg: "private detail" },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("email", { exact: true }).fill("browser-fixture@example.invalid");
  await page.getByLabel("password", { exact: true }).fill("Browser-fixture-only-2026!");
  const submit = page.getByRole("button", { name: "Se connecter" });
  await submit.click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Trop de tentatives");
  await expect(submit).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
});

for (const width of [390, 820, 1440]) {
  test(`signup does not overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Créer votre compte Optivos" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeInViewport();
    expect(
      await page
        .getByLabel("Adresse e-mail")
        .evaluate((input) => getComputedStyle(input).backgroundColor),
    ).not.toBe("rgb(255, 255, 255)");
  });
}
