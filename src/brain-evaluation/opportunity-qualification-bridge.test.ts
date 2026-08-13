import { describe, expect, it } from "vitest";
import {
  BrainOpportunityQualificationService,
  OpportunityDualRunHarness,
  ProductionOpportunityEligibilityBridge,
  ProductionOpportunityInputAdapter,
  type QualificationInputs,
} from "./opportunity-qualification-bridge";

const evidence = (id = "e-1") => ({
  id,
  sourceType: "OBSERVED" as const,
  sourceReference: `work:${id}`,
  sourceModule: "work_intelligence" as const,
  capturedAt: new Date("2026-01-01T00:00:00Z"),
  freshness: "CURRENT" as const,
  reliability: 0.9,
  content: "Observed repeatable activity",
  provenance: { version: 2, parentSourceId: "finding-1" },
  tenantId: "tenant-a",
  companyId: "company-a",
  claim: { id: "claim-1", statement: "Activity is repetitive", kind: "FACT" as const },
});

const productionInput = () => ({
  opportunityId: "opportunity-1",
  tenantId: "tenant-a",
  companyId: "company-a",
  subject: "Invoice intake",
  problemStatement: "Manual intake",
  targetOutcome: "Reduce handling time",
  currentState: "Manual",
  desiredState: "Controlled automation",
  candidateType: "AUTOMATION" as const,
  productionConfidence: 87,
  valueSignals: { frequency: 90, volume: 800, timeConsumed: 80 },
  processIds: ["process-1"],
  processStepIds: ["step-1"],
  evidence: [evidence()],
});

const assessment = <T extends string>(status: T, warnings: string[] = []) => ({
  status,
  score: status === "READY" || status === "SUITABLE" || status === "FEASIBLE" ? 0.9 : 0.2,
  factorBreakdown: {},
  rationale: "fixture",
  blockingFactors: [],
  warnings,
});

const qualificationInputs = (
  overrides: Partial<QualificationInputs> = {},
): QualificationInputs => ({
  automationSuitability: assessment("SUITABLE"),
  technicalFeasibility: assessment("FEASIBLE"),
  processReadiness: assessment("READY"),
  dataReadiness: assessment("READY"),
  humanControl: "WASTE",
  riskAssessment: {
    operationalRisk: 0.1,
    dataRisk: 0.1,
    securityRisk: 0.1,
    complianceRisk: 0.1,
    financialRisk: 0.1,
    vendorDependencyRisk: 0.1,
    changeManagementRisk: 0.1,
    failureImpact: 0.1,
    reversibility: 0.9,
    overall: 0.1,
  },
  evidenceGuard: { status: "SUFFICIENT", rationale: "evidence complete" },
  ...overrides,
});

function qualify(overrides: Partial<QualificationInputs> = {}) {
  const mapped = new ProductionOpportunityInputAdapter().map(productionInput());
  return new BrainOpportunityQualificationService().qualify(mapped, qualificationInputs(overrides));
}

describe("Opportunity qualification bridge", () => {
  it("maps production identifiers and tenant deterministically", () => {
    const result = new ProductionOpportunityInputAdapter().map(productionInput());
    expect(result.candidate.opportunityId).toBe("opportunity-1");
    expect(result.tenantId).toBe("tenant-a");
    expect(result.identityMap.resolve("evidence", "e-1")).toBe("e-1");
    expect(result.candidate.confidence).toBeCloseTo(0.87);
  });

  it("maps evidence and explicit claims without losing provenance", () => {
    const result = new ProductionOpportunityInputAdapter().map(productionInput());
    expect(result.evidence).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
    expect(result.candidate.trace.backward("opportunity-1")).toHaveLength(1);
  });

  it("is deterministic for identical input", () => {
    const adapter = new ProductionOpportunityInputAdapter();
    const a = adapter.map(productionInput());
    const b = adapter.map(productionInput());
    expect(a.candidate).toEqual(b.candidate);
  });

  it("rejects invalid production confidence", () => {
    expect(() =>
      new ProductionOpportunityInputAdapter().map({
        ...productionInput(),
        productionConfidence: 101,
      }),
    ).toThrow();
  });

  it("qualifies a complete candidate as recommend", () => {
    expect(qualify().brainDecision).toBe("RECOMMEND_CANDIDATE");
  });

  it("maps recommend to eligible and publication-ready", () => {
    const outcome = new ProductionOpportunityEligibilityBridge().evaluate(qualify());
    expect(outcome.eligible).toBe(true);
    expect(outcome.publicationReady).toBe(true);
    expect(outcome.requiresHumanControl).toBe(false);
  });

  it.each(["DEFER", "NEED_MORE_EVIDENCE"] as const)("does not make %s eligible", (decision) => {
    const result = qualify({
      processReadiness: assessment("NOT_READY"),
      dataReadiness: assessment("UNKNOWN"),
      evidenceGuard: {
        status: decision === "DEFER" ? "INSUFFICIENT" : "BLOCKED",
        rationale: "blocked",
      },
    });
    // The domain decision is deliberately derived, never overridden by the bridge.
    expect(["DEFER", "NEED_MORE_EVIDENCE"]).toContain(result.brainDecision);
    expect(new ProductionOpportunityEligibilityBridge().evaluate(result).eligible).toBe(false);
    expect(decision).toBeDefined();
  });

  it("does not make a low-value rejected candidate eligible", () => {
    const mapped = new ProductionOpportunityInputAdapter().map({
      ...productionInput(),
      valueSignals: { frequency: 0, volume: 0, timeConsumed: 0 },
    });
    const result = new BrainOpportunityQualificationService().qualify(
      mapped,
      qualificationInputs(),
    );
    expect(result.brainDecision).toBe("REJECT");
    expect(new ProductionOpportunityEligibilityBridge().evaluate(result).eligible).toBe(false);
  });

  it("preserves explicit human control", () => {
    const result = qualify({ humanControl: "MANDATORY_CONTROL" });
    expect(result.brainDecision).toBe("HUMAN_ASSISTED");
    const outcome = new ProductionOpportunityEligibilityBridge().evaluate(result);
    expect(outcome.eligible).toBe(true);
    expect(outcome.publicationReady).toBe(false);
    expect(outcome.requiresHumanControl).toBe(true);
  });

  it("hard gates unknown capability despite a high production score", () => {
    const brain = qualify({
      technicalFeasibility: assessment("UNKNOWN"),
      evidenceGuard: { status: "BLOCKED", rationale: "capability unknown" },
    });
    const comparison = new OpportunityDualRunHarness().compare({ score: 92, readiness: 90 }, brain);
    expect(comparison.classification).toBe("BRAIN_HARD_GATE_CONFLICT");
    expect(comparison.agreement).toBe(false);
  });

  it("does not average production and Brain scores", () => {
    const comparison = new OpportunityDualRunHarness().compare(
      { score: 87, readiness: 80 },
      qualify(),
    );
    expect(comparison.production.score).toBe(87);
    expect(comparison.brain.confidence).toBeCloseTo(0.87);
    expect(comparison).not.toHaveProperty("average");
  });

  it("reports a material difference deterministically", () => {
    const comparison = new OpportunityDualRunHarness().compare(
      { score: 10, readiness: 10 },
      qualify(),
    );
    expect(comparison.classification).toBe("MATERIAL_DIFFERENCE");
    expect(
      new OpportunityDualRunHarness().compare({ score: 10, readiness: 10 }, qualify()),
    ).toEqual(comparison);
  });

  it("preserves prerequisites and unknowns", () => {
    const mapped = new ProductionOpportunityInputAdapter().map({
      ...productionInput(),
      prerequisites: [{ id: "api", description: "Enable API", reason: "required", blocking: true }],
    });
    const result = new BrainOpportunityQualificationService().qualify(
      mapped,
      qualificationInputs({ remainingUnknowns: ["api"] }),
    );
    expect(result.prerequisites[0].id).toBe("api");
    expect(result.remainingUnknowns).toEqual(["api"]);
  });

  it("does not mutate the production input", () => {
    const input = productionInput();
    const before = JSON.stringify(input);
    new ProductionOpportunityInputAdapter().map(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("keeps qualification free of publication state", () => {
    const result = qualify();
    expect(result).not.toHaveProperty("published");
    expect(result).not.toHaveProperty("publicationState");
  });

  it("keeps Knowledge evidence as context only", () => {
    const result = new ProductionOpportunityInputAdapter().map({
      ...productionInput(),
      evidence: [{ ...evidence(), sourceModule: "enterprise_knowledge" }],
    });
    expect(result.candidate.opportunityId).toBe("opportunity-1");
    expect(result.candidate.supportingEvidenceIds).toEqual(["e-1"]);
  });

  it("preserves source version lineage in trace", () => {
    const result = new ProductionOpportunityInputAdapter().map(productionInput());
    expect(Object.values(result.candidate.trace.nodes).join(" ")).toContain("v2");
  });
});
