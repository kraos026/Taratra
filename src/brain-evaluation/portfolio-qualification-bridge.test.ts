import { describe, expect, it } from "vitest";
import { ReasoningTrace } from "./brain-contracts";
import {
  BrainEconomicQualificationService,
  ProductionEconomicInputAdapter,
} from "./economic-qualification-bridge";
import {
  BrainOpportunityQualificationService,
  ProductionOpportunityInputAdapter,
} from "./opportunity-qualification-bridge";
import {
  BrainPortfolioCandidateAdapter,
  PortfolioDualRunHarness,
  PrerequisiteGraphProjector,
} from "./portfolio-qualification-bridge";

const trace = ReasoningTrace.create({ source: "evidence" }, []);
const input = () => ({
  opportunityId: "op-1",
  tenantId: "tenant-a",
  companyId: "company-a",
  subject: "Intake",
  problemStatement: "Manual",
  targetOutcome: "Faster",
  currentState: "Manual",
  desiredState: "Automated",
  candidateType: "AUTOMATION" as const,
  productionConfidence: 90,
  valueSignals: { frequency: 90, volume: 800, timeConsumed: 80 },
  evidence: [
    {
      id: "e-1",
      sourceType: "OBSERVED" as const,
      sourceReference: "work:e-1",
      sourceModule: "work_intelligence" as const,
      capturedAt: new Date("2026-01-01"),
      freshness: "CURRENT" as const,
      reliability: 0.9,
      content: "repeatable",
      provenance: {},
      tenantId: "tenant-a",
    },
  ],
});
const opportunity = () => {
  const m = new ProductionOpportunityInputAdapter().map(input());
  return new BrainOpportunityQualificationService().qualify(m, {
    automationSuitability: {
      status: "SUITABLE",
      score: 0.9,
      factorBreakdown: {},
      rationale: "ok",
      blockingFactors: [],
      warnings: [],
    },
    technicalFeasibility: {
      status: "FEASIBLE",
      score: 0.9,
      factorBreakdown: {},
      rationale: "ok",
      blockingFactors: [],
      warnings: [],
    },
    processReadiness: {
      status: "READY",
      score: 0.9,
      factorBreakdown: {},
      rationale: "ok",
      blockingFactors: [],
      warnings: [],
    },
    dataReadiness: {
      status: "READY",
      score: 0.9,
      factorBreakdown: {},
      rationale: "ok",
      blockingFactors: [],
      warnings: [],
    },
    humanControl: "WASTE",
    evidenceGuard: { status: "SUFFICIENT", rationale: "ok" },
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
  });
};
const economic = () =>
  new BrainEconomicQualificationService().qualify(
    new ProductionEconomicInputAdapter().map({
      tenantId: "tenant-a",
      opportunityId: "op-1",
      reasoningTrace: trace,
      values: {
        volume: { value: 100, unit: "items", source: "company", status: "OBSERVED", confidence: 1 },
        frequency: {
          value: 12,
          unit: "year",
          source: "company",
          status: "OBSERVED",
          confidence: 1,
        },
        currentLaborTime: {
          value: 2,
          unit: "hours",
          source: "company",
          status: "OBSERVED",
          confidence: 1,
        },
        laborCost: {
          value: 50,
          unit: "currency",
          source: "company",
          status: "OBSERVED",
          confidence: 1,
        },
        implementationCost: {
          value: 100,
          unit: "currency",
          source: "estimate",
          status: "DERIVED",
          confidence: 0.8,
        },
      },
    }),
  );
const production = () => ({
  opportunityId: "op-1",
  tenantId: "tenant-a",
  title: "Intake",
  priority: "high" as const,
  priorityScore: 90,
  processIds: ["p-1"],
  evidenceIds: ["e-1"],
});

describe("portfolio qualification bridge", () => {
  it("qualifies a ready candidate", () => {
    const result = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: opportunity(),
      economic: economic(),
    });
    expect(result.eligibility).toBe("ELIGIBLE");
  });
  it("blocks high production priority when Brain is deferred", () => {
    const q = { ...opportunity(), brainDecision: "DEFER" as const };
    const result = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: q,
      economic: economic(),
    });
    expect(result.eligibility).toBe("DEFER");
    expect(
      new PortfolioDualRunHarness().compare({ priority: "high", score: 95 }, result).classification,
    ).toBe("BRAIN_HARD_GATE_CONFLICT");
  });
  it("preserves foundational and dependent sequencing", () => {
    const deps = [
      {
        id: "d1",
        description: "clean data",
        prerequisiteId: "data-cleanup",
        dependentId: "api-automation",
        blocking: true,
        reason: "required first",
      },
    ];
    const result = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: opportunity(),
      economic: economic(),
      dependencies: deps,
    });
    expect(result.initiativeClass).toBe("DEPENDENT");
    expect(new PrerequisiteGraphProjector().project(deps).edges).toHaveLength(1);
  });
  it("preserves human-assisted qualification", () => {
    const q = {
      ...opportunity(),
      brainDecision: "HUMAN_ASSISTED" as const,
      humanControl: "MANDATORY_CONTROL" as const,
    };
    const result = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: q,
      economic: economic(),
    });
    expect(result.eligibility).toBe("HUMAN_ASSISTED_ONLY");
  });
  it("preserves rejection instead of deleting candidate", () => {
    const q = { ...opportunity(), brainDecision: "REJECT" as const };
    const result = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: q,
      economic: economic(),
    });
    expect(result.eligibility).toBe("REJECT");
    expect(result.candidateId).toBe("op-1");
  });
  it("rejects tenant mismatch", () => {
    expect(() =>
      new BrainPortfolioCandidateAdapter().map({
        production: { ...production(), tenantId: "tenant-b" },
        opportunity: opportunity(),
        economic: economic(),
      }),
    ).toThrow();
  });
  it("rejects identity mismatch", () => {
    expect(() =>
      new BrainPortfolioCandidateAdapter().map({
        production: { ...production(), opportunityId: "other" },
        opportunity: opportunity(),
        economic: economic(),
      }),
    ).toThrow();
  });
  it("detects prerequisite cycles", () => {
    const graph = new PrerequisiteGraphProjector().project([
      {
        id: "a",
        description: "a",
        prerequisiteId: "x",
        dependentId: "y",
        blocking: true,
        reason: "a",
      },
      {
        id: "b",
        description: "b",
        prerequisiteId: "y",
        dependentId: "x",
        blocking: true,
        reason: "b",
      },
    ]);
    expect(graph.hasCycle).toBe(true);
  });
  it("keeps production priority and Brain qualification separate", () => {
    const result = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: opportunity(),
      economic: economic(),
    });
    const comparison = new PortfolioDualRunHarness().compare(
      { priority: "high", score: 90 },
      result,
    );
    expect(comparison.production.score).toBe(90);
    expect(comparison.brain.confidence).toBeCloseTo(0.9);
  });
  it("is deterministic", () => {
    const a = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: opportunity(),
      economic: economic(),
    });
    const b = new BrainPortfolioCandidateAdapter().map({
      production: production(),
      opportunity: opportunity(),
      economic: economic(),
    });
    expect(a).toEqual(b);
  });
});
