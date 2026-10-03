import { describe, expect, it } from "vitest";
import { auditLabel, auditText, analysisValidationCopy } from "./audit-readable-copy";

describe("read-only French audit copy", () => {
  it("translates known catalog labels without changing arbitrary company names", () => {
    expect(auditLabel("system_health")).toBe("Outils");
    expect(auditLabel("manual")).toBe("Manuel");
    expect(auditText("Human bottleneck")).toBe("Dépendance à une personne");
    expect(auditText("Factures Société Delta")).toBe("Factures Société Delta");
  });
  it("does not invent successful validation for missing or unknown control codes", () => {
    expect(analysisValidationCopy("missing_evidence")).toContain("pas de preuve pertinente");
    expect(analysisValidationCopy("unknown")).toContain("avant de poursuivre");
    expect(analysisValidationCopy("analysis_valid")).toContain("ne garantit ni la rentabilité");
  });
  it("translates source frequencies and workload copy while preserving quantities", () => {
    expect(auditLabel("weekly")).toBe("Chaque semaine");
    expect(auditLabel("monthly")).toBe("Chaque mois");
    expect(auditText("High manual workload")).toBe("Charge de travail manuelle élevée");
    expect(auditText("Estimated manual workload is 45 hours per month.")).toBe(
      "La charge de travail manuelle estimée est de 45 heures par mois.",
    );
    expect(auditText("Reduce high-volume manual work.")).toContain("contrôles nécessaires");
    expect(auditLabel("Fréquence propre au client")).toBe("Fréquence propre au client");
  });
});
