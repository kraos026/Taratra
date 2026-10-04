import { describe, expect, it } from "vitest";
import { askDecisionLabel, askStatusLabel } from "./ask-automatex-panel";

describe("Ask Optivos customer labels", () => {
  it("does not expose technical response codes", () => {
    expect(askStatusLabel("INSUFFICIENT_EVIDENCE")).toBe("Preuves complémentaires requises");
    expect(askStatusLabel("PROVIDER_FALLBACK")).toContain("sans reformulation IA");
    expect(askStatusLabel("OUT_OF_SCOPE")).toContain("hors du périmètre");
  });
  it("preserves safety distinctions in French", () => {
    expect(askDecisionLabel("NEEDS_MORE_EVIDENCE")).toBe("Données supplémentaires requises");
    expect(askDecisionLabel("FIX_BEFORE_AUTOMATING")).toBe("Corriger avant d’automatiser");
    expect(askDecisionLabel("DO_NOT_AUTOMATE")).toBe("Ne pas automatiser");
    expect(askDecisionLabel("HUMAN_DECISION_REQUIRED")).toBe("Décision humaine requise");
  });
});
