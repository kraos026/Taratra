import { expect, test, type Page } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);
const companyId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const session = {
  id: sessionId,
  lockVersion: 1,
  currentStep: "review",
  status: "completed",
  answers: [],
};

async function openReview(page: Page, status = "completed") {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  // Browser-only fault fixtures: no company or answers are persisted.
  await page.route(`**/api/companies/${companyId}/discovery`, (route) =>
    route.fulfill({ json: { data: { ...session, status } } }),
  );
  await page.goto(`/companies/${companyId}/discovery`);
  await expect(page.getByRole("heading", { name: "Comprendre votre entreprise" })).toBeVisible();
}

test("Discovery never validates when saving the final answers fails", async ({ page }) => {
  let validations = 0;
  await page.route(`**/api/discovery-sessions/${sessionId}`, (route) =>
    route.fulfill({ status: 409, json: { error: { code: "CONFLICT" } } }),
  );
  await page.route(`**/api/discovery-sessions/${sessionId}/validate`, (route) => {
    validations++;
    return route.fulfill({ json: { data: { ...session, status: "validated" } } });
  });
  await openReview(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Valider et continuer/ }).click();
  await expect(
    page.getByText("Cette session a été modifiée ailleurs. Rechargez la page."),
  ).toBeVisible();
  expect(validations).toBe(0);
});

test("Discovery recovers from a save network failure without losing the draft", async ({
  page,
}) => {
  await page.route(`**/api/discovery-sessions/${sessionId}`, (route) => route.abort("failed"));
  await openReview(page);
  await page.getByRole("checkbox").check();
  const submit = page.getByRole("button", { name: /Valider et continuer/ });
  await submit.click();
  await expect(page.getByText(/Impossible d’enregistrer/)).toBeVisible();
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("checkbox")).toBeChecked();
});

test("Discovery locks validated answers and provides the next real route", async ({ page }) => {
  await openReview(page, "validated");
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("link", { name: /Continuer vers l’entretien/ })).toHaveAttribute(
    "href",
    `/companies/${companyId}/interview`,
  );
});
