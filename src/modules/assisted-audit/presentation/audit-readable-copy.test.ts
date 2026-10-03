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
});
