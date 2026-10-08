import { describe, expect, it } from "vitest";
import { customerDecisionText } from "./customer-decision-copy";

describe("Customer decision copy", () => {
  it.each(["performs 100% of manual steps", "carries 72.5% of manual duration"])(
    "bounds unresolved actor evidence without inventing a role: %s",
    (statement) => {
      const id = "11111111-2222-3333-4444-555555555555";
      const copy = customerDecisionText(`${id} ${statement}.`);
      expect(copy).toContain("Dans le modèle publié");
      expect(copy).toContain("Son identité");
      expect(copy).toContain("restent à vérifier");
      expect(copy).toContain("ne mesure pas sa charge de travail réelle");
      expect(copy).not.toContain(id);
      expect(copy).not.toContain("référence interne non nommée");
      expect(copy).toContain(statement.startsWith("performs") ? "100 %" : "72.5 %");
    },
  );
  it.each([
    ["Manual invoice processing", "sur une facture récente"],
    ["Email dependency", "les échanges nécessaires"],
    ["Excel dependency", "la source de référence"],
    ["Missing documentation", "faire vérifier cette procédure"],
    ["Missing KPI", "relever une valeur de départ"],
  ])(
    "provides verification steps for the known finding %s, not invented facts",
    (finding, step) => {
      const review = customerDecisionText(`Review finding: ${finding}`);
      expect(review).toContain(step);
      expect(customerDecisionText(`Fix or validate this issue before automating: ${finding}`)).toBe(
        review,
      );
      expect(customerDecisionText(`Review finding: ${finding}.`)).toBe(review);
      expect(review).not.toContain("Examiner le constat");
      expect(review).not.toMatch(/\d/);
    },
  );
  it("does not invent a tailored action for an unrecognized finding", () => {
    expect(customerDecisionText("Review finding: Custom customer issue")).toBe(
      "Examiner le constat : Custom customer issue",
    );
    expect(customerDecisionText("Review finding: constructor")).toBe(
      "Examiner le constat : constructor",
    );
    expect(customerDecisionText("This company")).toBe("Cette entreprise");
    expect(customerDecisionText("This company sells software")).toBe("This company sells software");
  });
  it.each([
    ["Human bottleneck", "Dépendance à une personne"],
    ["Single point of failure", "Point de dépendance unique"],
    ["High manual workload", "Charge de travail manuelle élevée"],
    [
      "Estimated manual workload is 45 hours per month.",
      "La charge de travail manuelle estimée est de 45 heures par mois.",
    ],
    [
      "Finance carries 72.5% of manual duration.",
      "Finance concentre 72.5 % de la durée manuelle du modèle.",
    ],
    [
      "Finance performs 100% of manual steps.",
      "Finance réalise 100 % des étapes manuelles du modèle.",
    ],
    ["Add coverage and delegation.", "Prévoir un relais et définir les responsabilités déléguées."],
    [
      "Redistribute or automate the bottleneck.",
      "Examiner la répartition du travail et les tâches pouvant être assistées, sans retirer les contrôles humains.",
    ],
    ["Automate scheduled reporting", "Automatiser les rapports périodiques"],
    ["Route requests to the correct team.", "Orienter les demandes vers l’équipe concernée."],
    [
      "Synchronize governed operational data.",
      "Synchroniser les données opérationnelles selon les règles de contrôle.",
    ],
    [
      "Operations depend on manual email handling.",
      "L’activité dépend du traitement manuel des emails.",
    ],
    ["100% of steps lack documentation.", "100 % des étapes ne disposent pas de documentation."],
    [
      "Support requests require manual routing.",
      "Les demandes de support sont orientées manuellement.",
    ],
    [
      "No KPI evidence is attached to the process.",
      "Aucune preuve concernant les indicateurs de suivi n’est reliée au processus.",
    ],
  ])("translates the generated phrase %s faithfully", (original, expected) => {
    expect(customerDecisionText(original!)).toBe(expected);
  });
  it("preserves unrecognized user wording rather than inventing a translation or a benefit", () => {
    expect(customerDecisionText("Les factures sont contrôlées chaque lundi. 24 000 EUR.")).toBe(
      "Les factures sont contrôlées chaque lundi. 24 000 EUR.",
    );
    expect(customerDecisionText("Custom customer process")).toBe("Custom customer process");
  });
});
