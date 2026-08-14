import { describe, expect, it } from "vitest";
import { Contradiction } from "./brain-contracts";
import { DataQualityDecisionGuard, DecisionRobustnessGuard } from "./decision-robustness";
import { EconomicInputFactory } from "./economic-intelligence";

describe("C3 decision robustness", () => {
  it("requires remediation for broken master data", () => {
    const result = new DataQualityDecisionGuard().assess({
      score: 0.3,
      invalidValueCount: 1,
      masterDataFragmentation: 0.8,
      reconciliationFailures: 1,
    });
    expect(result.status).toBe("REMEDIATE_FIRST");
    expect(result.requiredMasterDataCleanup.length).toBeGreaterThan(0);
  });

  it("rejects negative economics without inventing a positive value", () => {
    const result = new DecisionRobustnessGuard().evaluate({
      dataQuality: new DataQualityDecisionGuard().assess({ score: 1 }),
      economicSignal: "NEGATIVE_VALUE",
      economicInputs: [EconomicInputFactory.create("value", -10, "currency", "OBSERVED", "ledger")],
      contradictions: [],
      evidence: [],
      unknowns: [],
    });
    expect(result.decision).toBe("REJECT");
  });

  it("allows a clean, evidenced positive economic case", () => {
    const result = new DecisionRobustnessGuard().evaluate({
      dataQuality: new DataQualityDecisionGuard().assess({ score: 1 }),
      economicSignal: "POSITIVE_VALUE",
      economicInputs: [
        ...[
          "implementationCost",
          "maintenanceCost",
          "expectedTimeReduction",
          "expectedAutomationCoverage",
          "expectedAdoptionRate",
        ].map((name) => EconomicInputFactory.create(name, 1, "unit", "OBSERVED", "ledger")),
      ],
      contradictions: [],
      evidence: [],
      unknowns: [],
    });
    expect(result.decision).toBe("ALLOW");
  });

  it("retains strategic control benefit when financial value is marginal", () => {
    const result = new DecisionRobustnessGuard().evaluate({
      dataQuality: new DataQualityDecisionGuard().assess({ score: 1 }),
      economicSignal: "MARGINAL",
      economicInputs: [
        ...[
          "implementationCost",
          "maintenanceCost",
          "expectedTimeReduction",
          "expectedAutomationCoverage",
          "expectedAdoptionRate",
        ].map((name) => EconomicInputFactory.create(name, 1, "unit", "OBSERVED", "ledger")),
      ],
      contradictions: [],
      evidence: [],
      unknowns: [],
      strategicControlBenefit: true,
    });
    expect(result.decision).toBe("ALLOW");
  });

  it("does not silently resolve a material contradiction", () => {
    const contradiction = Contradiction.create({
      contradictionId: "contradiction:test",
      kind: "QUANTITATIVE",
      leftClaimId: "claim:left",
      rightClaimId: "claim:right",
      leftEvidenceIds: ["e:left"],
      rightEvidenceIds: ["e:right"],
      materiality: "HIGH",
      impact: "volume affects ROI",
      requiresClarification: true,
      detectedAt: new Date("2026-01-01"),
    });
    const result = new DecisionRobustnessGuard().evaluate({
      dataQuality: new DataQualityDecisionGuard().assess({ score: 1 }),
      economicSignal: "POSITIVE_VALUE",
      economicInputs: [],
      contradictions: [contradiction],
      evidence: [
        { evidenceId: "e:left", reliability: 0.7, sourceType: "INTERVIEW" },
        { evidenceId: "e:right", reliability: 0.72, sourceType: "INTERVIEW" },
      ],
      unknowns: [],
    });
    expect(result.decision).toBe("NEED_MORE_EVIDENCE");
    expect(result.contradictionResolution[0]?.state).toBe("UNRESOLVED_MATERIAL");
  });
});
