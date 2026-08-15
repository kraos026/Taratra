import { describe, expect, it } from "vitest";
import { DualModeBrainEvaluator, type DualModeEvaluationInput } from "./dual-mode-evaluator";
import type { IntegratedBrainResult } from "./brain-integration";
import type { ScenarioDataset, SyntheticGroundTruth } from "./synthetic-enterprise-lab";

const truth: SyntheticGroundTruth = {
  trueProcessStructure: [],
  trueMetrics: {},
  trueRootCause: "manual-reentry",
  actualBottleneck: "step-1",
  hiddenCapabilities: [],
  economicallyJustified: [],
  forbiddenRecommendations: [],
  expectedDecision: "NEED_MORE_EVIDENCE",
  expectedHumanControl: true,
  actualVolumes: {},
  actualDependencies: [],
  actualControls: [],
  failureProbabilities: {},
  dataQualityState: 0.7,
  expectedClarifications: ["root cause"],
  expectedEconomicDirection: "UNKNOWN",
};
const scenario = {
  scenarioId: "live-pilot-1",
  generatorVersion: "v1",
  seed: "seed",
  publicView: {},
  groundTruthReference: "hidden",
  evaluationExpectations: {
    expectedRootCauseIds: [],
    expectedOpportunityTypes: [],
    forbiddenOpportunityTypes: [],
    expectedDecisionClass: "NEED_MORE_EVIDENCE",
    expectedHumanControl: true,
    expectedUnknowns: [],
  },
  tags: [],
} as unknown as ScenarioDataset;
const result = (
  root?: string,
  decision: "NEED_MORE_EVIDENCE" | "RECOMMEND_CANDIDATE" = "NEED_MORE_EVIDENCE",
): IntegratedBrainResult =>
  ({
    companyId: "company",
    scenarioId: "scenario",
    evidenceSummary: { count: 1, ids: ["e1"] },
    claims: [],
    unknowns: [],
    contradictions: [],
    discoveryReadiness: {
      outcome: "BLOCKED_BY_CRITICAL_GAPS",
      rationale: "missing",
      blockingGapIds: ["gap"],
      declaredUncertaintyGapIds: [],
    },
    processConclusions: [],
    causes: root ? [{ kind: "ROOT", semanticKey: `cause:${root}` }] : [],
    bottlenecks: [],
    dependencies: {} as never,
    knowledgeMatches: [],
    opportunities: [],
    opportunityDecisions: [
      { opportunityId: "o", decision: { decision, reasons: [], rationale: "test" } },
    ],
    economicEvaluation: {} as never,
    reasoningTraces: [],
    blockingIssues: [],
    remainingUncertainty: 1,
    integrationScorecard: {},
    criticalIssues: [],
    dataQualityDecision: {} as never,
    decisionRobustness: {} as never,
    opportunityActions: [],
  }) as unknown as IntegratedBrainResult;
const input = (
  brainResult: IntegratedBrainResult,
  observable: string[],
  required: string[] = ["manual-reentry"],
): DualModeEvaluationInput => ({
  scenario,
  groundTruth: truth,
  brainResult,
  observable: { requiredSignals: observable },
  prerequisites: { rootCauseSignals: required },
});

describe("E6.3 dual-mode evaluator", () => {
  const evaluator = new DualModeBrainEvaluator();

  it("separates hidden truth miss from safe evidence-conditional abstention", () => {
    const output = evaluator.evaluate(input(result(), []));
    expect(output.truthDiagnostic.rootCauseResult).toBe("MISS");
    expect(output.truthDiagnostic.observability).toBe("NOT_YET_OBSERVABLE");
    expect(output.truthDiagnostic.classifications).toContain("OBSERVABILITY_LIMIT");
    expect(output.evidenceConditional.safeAbstention).toBe(true);
    expect(output.evidenceConditional.status).toBe("PASS_WITH_WARNINGS");
    expect(output.evidenceConditional.discoveryAction).toBe("REQUEST_MISSING_EVIDENCE");
  });

  it("does not hide a miss when sufficient causal evidence is observable", () => {
    const output = evaluator.evaluate(input(result(), ["manual-reentry"]));
    expect(output.truthDiagnostic.status).toBe("PASS_WITH_WARNINGS");
    expect(output.evidenceConditional.status).toBe("FAIL");
    expect(output.evidenceConditional.classifications).toContain("REASONING_FAILURE");
  });

  it("passes a correct decision with sufficient evidence", () => {
    const output = evaluator.evaluate(
      input(result("manual-reentry", "RECOMMEND_CANDIDATE"), ["manual-reentry"]),
    );
    expect(output.truthDiagnostic.status).toBe("PASS");
    expect(output.evidenceConditional.status).toBe("PASS");
    expect(output.evidenceConditional.decisionResult).toBe("CORRECT_DECISION");
  });

  it("flags unsafe overreach when evidence is insufficient", () => {
    const output = evaluator.evaluate(input(result("manual-reentry", "RECOMMEND_CANDIDATE"), []));
    expect(output.evidenceConditional.status).toBe("FAIL");
    expect(output.evidenceConditional.classifications).toContain("UNSAFE_OVERREACH");
  });

  it("distinguishes partial observability from hidden truth", () => {
    const output = evaluator.evaluate(
      input(result(), ["manual-reentry"], ["manual-reentry", "process"]),
    );
    expect(output.truthDiagnostic.observability).toBe("PARTIALLY_OBSERVABLE");
    expect(output.evidenceConditional.safeAbstention).toBe(true);
  });

  it("keeps historical evaluator ownership untouched", () => {
    expect(evaluator.evaluatorVersion).toBe("evaluator-v2-evidence-conditional");
    expect(evaluator.evaluateGroundTruth(input(result(), [])).mode).toBe("GROUND_TRUTH_DIAGNOSTIC");
    expect(evaluator.evaluateEvidenceConditional(input(result(), [])).mode).toBe(
      "EVIDENCE_CONDITIONAL_DECISION",
    );
  });
});
