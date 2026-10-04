import { expect, test } from "@playwright/test";
import { loginAsTenantA } from "./support/auth";
import { firstCompanyId } from "./support/company";
import { readPilotE2EConfig } from "./support/env";

const config = readPilotE2EConfig(process.env);

test("document review is local until explicit canonical answer save (mocked answer API)", async ({
  page,
}) => {
  test.skip(!config, "CERTIFICATION ENVIRONMENT NOT CONFIGURED");
  await loginAsTenantA(page, config!);
  const companyId = await firstCompanyId(page);
  const question = {
    id: "10000000-0000-4000-8000-000000000001",
    code: "operations.description",
    domain: "operations",
    prompt: "Comment traitez-vous les factures ?",
    answerType: "long_text",
    options: [],
    mandatory: true,
  };
  const view = {
    session: { id: "20000000-0000-4000-8000-000000000001", status: "in_progress", lockVersion: 1 },
    nextQuestion: question,
    answers: [],
    questions: [question],
    progress: {
      progressPercentage: 0,
      confidencePercentage: 0,
      missingMandatory: [question.code],
      readyForProcessMapping: false,
      domains: [],
    },
  };
  await page.route(`**/api/companies/${companyId}/interviews`, (route) =>
    route.fulfill({ json: { data: view } }),
  );
  const saves: Record<string, unknown>[] = [];
  await page.route(`**/api/interviews/${view.session.id}/answer`, (route) => {
    const body = route.request().postDataJSON();
    saves.push(body);
    return route.fulfill({
      json: {
        data: {
          ...view,
          nextQuestion: null,
          answers: [
            {
              questionId: question.id,
              value: body.value,
              confidence: body.confidence,
              documentSource: body.documentSource,
            },
          ],
        },
      },
    });
  });
  await page.goto(`/companies/${companyId}/interview`);
  const documents = page.getByRole("region", { name: "Documents d’appui" });
  await documents.getByLabel("Choisir un document d’appui").setInputFiles({
    name: "procedure.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Les factures sont reçues par email.\nUn responsable valide chaque facture.",
      "utf8",
    ),
  });
  await documents.getByRole("combobox").selectOption("Ligne 2");
  await expect(
    documents.getByRole("button", { name: "Reprendre cet extrait dans ma réponse" }),
  ).toBeDisabled();
  await documents.getByRole("checkbox").check();
  if (process.env.OPTIVOS_DOCUMENT_PROOF_PATH) {
    await documents.screenshot({ path: process.env.OPTIVOS_DOCUMENT_PROOF_PATH });
  }
  await documents.getByRole("button", { name: "Reprendre cet extrait dans ma réponse" }).click();
  expect(saves).toHaveLength(0);
  await expect(page.getByLabel("Réponse", { exact: true })).toHaveValue(
    "Un responsable valide chaque facture.",
  );
  await expect(page.getByLabel("Niveau de certitude")).toHaveValue("uncertain");
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await expect(page.getByText("Source documentaire relue : procedure.txt · Ligne 2")).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({
    value: "Un responsable valide chaque facture.",
    confidence: "uncertain",
    documentSource: { fileName: "procedure.txt", location: "Ligne 2", reviewed: true },
  });
  expect((saves[0].documentSource as { sha256: string }).sha256).toMatch(/^[a-f0-9]{64}$/);
  // Browser behavior only: real persistence/RLS is not certified by this mocked endpoint.
});
