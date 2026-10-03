import { describe, expect, it } from "vitest";
import { customerDecisionText } from "./customer-decision-copy";

describe("Customer decision copy", () => {
  it.each([
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
