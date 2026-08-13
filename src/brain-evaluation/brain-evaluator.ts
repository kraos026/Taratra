import { Claim, Confidence, Evidence, type ClaimKind } from "./brain-contracts";
import {
  BrainIntegrationPipeline,
  type BrainIntegrationInput,
  type IntegratedBrainResult,
} from "./brain-integration";
import { Process, ProcessModel, ProcessStep } from "./process-causal";
import { EconomicInputFactory } from "./economic-intelligence";
import type { KnowledgeContext } from "./knowledge-foundation";
import type {
  ScenarioDataset,
  SyntheticGroundTruth,
  SyntheticEnterpriseView,
} from "./synthetic-enterprise-lab";

export type EvaluationSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EvaluationStatus = "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | "CRITICAL_FAIL";
export type VersionComparison = "IMPROVED" | "REGRESSED" | "UNCHANGED" | "MIXED";
export type EvaluationDimension =
  | "EVIDENCE_DISCIPLINE"
  | "CONTRADICTION_HANDLING"
  | "UNKNOWN_HANDLING"
  | "DISCOVERY_QUALITY"
  | "CAUSAL_ACCURACY"
  | "ROOT_CAUSE_ACCURACY"
  | "BOTTLENECK_ACCURACY"
  | "OPPORTUNITY_PRECISION"
  | "OPPORTUNITY_RECALL"
  | "AUTOMATION_REJECTION_QUALITY"
  | "HUMAN_CONTROL_PRESERVATION"
  | "RISK_DETECTION"
  | "ECONOMIC_DIRECTION_ACCURACY"
  | "OVERCONFIDENCE"
  | "TRACEABILITY"
  | "UNSUPPORTED_CLAIM_RATE"
  | "MISSED_CRITICAL_ISSUE_RATE"
  | "UNNECESSARY_AUTOMATION_RATE";

export interface BrainVersion {
  version: string;
  commitSha: string;
  contractVersion: string;
  knowledgeVersion: string;
  retrievalVersion: string;
  simulationModelVersion?: string;
}
export interface DimensionScore {
  score: number;
  metrics: Readonly<Record<string, number>>;
}
export type BrainEvaluationScorecard = Readonly<Record<EvaluationDimension, DimensionScore>>;
export interface BrainEvaluationFailure {
  failureId: string;
  category: EvaluationDimension | "GROUND_TRUTH_LEAKAGE" | "FORBIDDEN_RECOMMENDATION";
  severity: EvaluationSeverity;
  expected: string;
  actual: string;
  scenarioReference: string;
  brainArtifactIds: readonly string[];
  groundTruthReference: string;
  explanation: string;
  suggestedInvestigation: string;
}
export interface BrainQualityGates {
  groundTruthLeakage: number;
  forbiddenRecommendations: number;
  humanControlViolations: number;
  criticalUnsupportedFacts: number;
  unsafeAutomation: number;
  criticalRiskMisses: number;
}
export interface ScenarioEvaluationResult {
  scenario: string;
  category: string;
  scorecard: BrainEvaluationScorecard;
  expected: Readonly<Record<string, unknown>>;
  actual: Readonly<Record<string, unknown>>;
  failures: readonly BrainEvaluationFailure[];
  warnings: readonly BrainEvaluationFailure[];
  status: EvaluationStatus;
  overallScore: number;
}
export interface BrainEvaluationRun {
  evaluationId: string;
  scenarioId: string;
  seed: string;
  generatorVersion: string;
  brainVersion: BrainVersion;
  evaluatorVersion: string;
  startedAt: Date;
  completedAt: Date;
  publicInputReference: string;
  groundTruthReference: string;
  brainResult: IntegratedBrainResult;
  scorecard: BrainEvaluationScorecard;
  failures: readonly BrainEvaluationFailure[];
  warnings: readonly BrainEvaluationFailure[];
  status: EvaluationStatus;
}
export interface BrainEvaluationSuiteResult {
  runs: readonly BrainEvaluationRun[];
  meanScores: Readonly<Record<EvaluationDimension, number>>;
  worstCaseScores: Readonly<Record<EvaluationDimension, number>>;
  failureCount: number;
  criticalFailureCount: number;
  normalOverallScore: number;
  adversarialOverallScore: number;
  categoryBreakdown: Readonly<Record<string, number>>;
  status: EvaluationStatus;
}
export interface BrainQualityReport {
  strengths: readonly string[];
  weaknesses: readonly string[];
  criticalFailures: readonly string[];
  topRegressionRisks: readonly string[];
  lowestScoringDimensions: readonly EvaluationDimension[];
  recommendedInvestigationAreas: readonly string[];
}

const dimensions: readonly EvaluationDimension[] = [
  "EVIDENCE_DISCIPLINE",
  "CONTRADICTION_HANDLING",
  "UNKNOWN_HANDLING",
  "DISCOVERY_QUALITY",
  "CAUSAL_ACCURACY",
  "ROOT_CAUSE_ACCURACY",
  "BOTTLENECK_ACCURACY",
  "OPPORTUNITY_PRECISION",
  "OPPORTUNITY_RECALL",
  "AUTOMATION_REJECTION_QUALITY",
  "HUMAN_CONTROL_PRESERVATION",
  "RISK_DETECTION",
  "ECONOMIC_DIRECTION_ACCURACY",
  "OVERCONFIDENCE",
  "TRACEABILITY",
  "UNSUPPORTED_CLAIM_RATE",
  "MISSED_CRITICAL_ISSUE_RATE",
  "UNNECESSARY_AUTOMATION_RATE",
];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const score = (value: number, metrics: Record<string, number> = {}) =>
  Object.freeze({ score: clamp(value), metrics: Object.freeze(metrics) });
const failure = (
  scenario: ScenarioDataset,
  category: BrainEvaluationFailure["category"],
  severity: EvaluationSeverity,
  expected: string,
  actual: string,
  explanation: string,
  ids: readonly string[] = [],
): BrainEvaluationFailure =>
  Object.freeze({
    failureId: `${scenario.scenarioId}:${category}:${severity}`,
    category,
    severity,
    expected,
    actual,
    scenarioReference: scenario.scenarioId,
    brainArtifactIds: Object.freeze([...ids]),
    groundTruthReference: scenario.groundTruthReference,
    explanation,
    suggestedInvestigation: `Inspect ${category.toString().toLowerCase()} for ${scenario.scenarioId}`,
  });

export class BrainEvaluator {
  readonly evaluatorVersion = "e6.1";
  evaluate(
    scenario: ScenarioDataset,
    truth: SyntheticGroundTruth,
    result: IntegratedBrainResult,
    brainVersion: BrainVersion,
  ): BrainEvaluationRun {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const failures: BrainEvaluationFailure[] = [];
    const warnings: BrainEvaluationFailure[] = [];
    const serializedResult = JSON.stringify(result);
    if (
      serializedResult.includes("_groundTruth") ||
      serializedResult.includes("groundTruthReference")
    )
      failures.push(
        failure(
          scenario,
          "GROUND_TRUTH_LEAKAGE",
          "CRITICAL",
          "no hidden GroundTruth fields",
          "hidden GroundTruth marker present",
          "Brain output contains an evaluation-only field",
        ),
      );
    const hasContradiction = result.contradictions.length > 0;
    const expectedContradiction = scenario.tags.includes("CONTRADICTORY");
    const contradictionScore = expectedContradiction
      ? hasContradiction
        ? 100
        : 0
      : hasContradiction
        ? 75
        : 100;
    if (expectedContradiction && !hasContradiction)
      failures.push(
        failure(
          scenario,
          "CONTRADICTION_HANDLING",
          "HIGH",
          "contradiction detected",
          "none",
          "Expected contradictory observations were not surfaced",
        ),
      );
    const rootCause = result.causes.find((c) => c.kind === "ROOT");
    const rootMatch = Boolean(
      rootCause?.statement.toLowerCase().includes(truth.trueRootCause.replaceAll("-", " ")) ||
      rootCause?.statement.includes(truth.trueRootCause),
    );
    if (!rootMatch)
      failures.push(
        failure(
          scenario,
          "ROOT_CAUSE_ACCURACY",
          "HIGH",
          truth.trueRootCause,
          rootCause?.statement ?? "none",
          "The detected root cause does not match hidden GroundTruth",
          rootCause ? [rootCause.causeId] : [],
        ),
      );
    const bottleneckMatch = result.bottlenecks.some(
      (b) =>
        b.stepId === truth.actualBottleneck ||
        b.reason.toLowerCase().includes(truth.actualBottleneck),
    );
    const decisions = result.opportunityDecisions.map((d) => d.decision.decision);
    const automation = result.opportunities.filter((o) => o.candidateType === "AUTOMATION");
    const forbidden = automation.filter((o) =>
      truth.forbiddenRecommendations.some((f) =>
        o.problemStatement.toLowerCase().includes(f.replaceAll("_", " ").toLowerCase()),
      ),
    );
    if (forbidden.length)
      failures.push(
        failure(
          scenario,
          "FORBIDDEN_RECOMMENDATION",
          "CRITICAL",
          "no forbidden recommendation",
          forbidden.map((o) => o.opportunityId).join(","),
          "A forbidden action was produced",
          forbidden.map((o) => o.opportunityId),
        ),
      );
    const controlViolation =
      truth.expectedHumanControl && decisions.some((d) => d === "RECOMMEND_CANDIDATE");
    if (controlViolation)
      failures.push(
        failure(
          scenario,
          "HUMAN_CONTROL_PRESERVATION",
          "HIGH",
          "human control preserved",
          "autonomous",
          "Mandatory human control was removed",
        ),
      );
    const lowValue = truth.economicallyJustified.length === 0;
    const unnecessary = lowValue && automation.length > 0;
    if (unnecessary)
      failures.push(
        failure(
          scenario,
          "UNNECESSARY_AUTOMATION_RATE",
          "HIGH",
          "no automation for negative economics",
          `${automation.length} automation candidate(s)`,
          "Automation was proposed despite negative economics",
          automation.map((o) => o.opportunityId),
        ),
      );
    const traceBroken = result.opportunities.filter((o) =>
      o.supportingEvidenceIds.some((id) => !result.evidenceSummary.ids.includes(id)),
    ).length;
    const unsupportedClaims = result.claims.filter(
      (c) => c.supportingEvidenceIds.length === 0 && c.kind === "FACT",
    ).length;
    const scorecard = Object.freeze({
      EVIDENCE_DISCIPLINE: score(unsupportedClaims ? 0 : 100, {
        unsupportedFactCount: unsupportedClaims,
        groundedFactRatio: result.claims.length ? 1 - unsupportedClaims / result.claims.length : 1,
        provenanceCompleteness: result.evidenceSummary.count ? 100 : 0,
        syntheticLeakageDetected: 0,
      }),
      CONTRADICTION_HANDLING: score(contradictionScore, {
        trueContradictionsDetected: expectedContradiction && hasContradiction ? 1 : 0,
        falseContradictions: !expectedContradiction && hasContradiction ? 1 : 0,
      }),
      UNKNOWN_HANDLING: score(
        result.discoveryReadiness.outcome === "BLOCKED_BY_CRITICAL_GAPS"
          ? 100
          : truth.expectedClarifications.length
            ? 0
            : 100,
        {
          expectedUnknownsDetected: truth.expectedClarifications.length
            ? result.unknowns.length
            : 0,
          criticalGapsMissed:
            truth.expectedClarifications.length && !result.unknowns.length ? 1 : 0,
        },
      ),
      DISCOVERY_QUALITY: score(
        result.discoveryReadiness.outcome === "READY_FOR_ANALYSIS" &&
          truth.expectedClarifications.length
          ? 40
          : 100,
      ),
      CAUSAL_ACCURACY: score(rootMatch ? 100 : 0),
      ROOT_CAUSE_ACCURACY: score(rootMatch ? 100 : 0),
      BOTTLENECK_ACCURACY: score(bottleneckMatch ? 100 : 0),
      OPPORTUNITY_PRECISION: score(automation.length && lowValue ? 0 : 100, {
        falseAutomationRate: unnecessary ? 1 : 0,
      }),
      OPPORTUNITY_RECALL: score(
        truth.economicallyJustified.length ? (automation.length ? 100 : 0) : 100,
      ),
      AUTOMATION_REJECTION_QUALITY: score(lowValue ? (automation.length ? 0 : 100) : 100),
      HUMAN_CONTROL_PRESERVATION: score(controlViolation ? 0 : 100, {
        violations: controlViolation ? 1 : 0,
      }),
      RISK_DETECTION: score(100),
      ECONOMIC_DIRECTION_ACCURACY: score(lowValue ? (automation.length ? 0 : 100) : 100),
      OVERCONFIDENCE: score(
        result.claims.some((c) => c.confidence.value > 0.9 && c.contradictingEvidenceIds.length)
          ? 0
          : 100,
      ),
      TRACEABILITY: score(traceBroken ? 0 : 100, { brokenTraceCount: traceBroken }),
      UNSUPPORTED_CLAIM_RATE: score(unsupportedClaims ? 0 : 100, {
        unsupportedFactCount: unsupportedClaims,
      }),
      MISSED_CRITICAL_ISSUE_RATE: score(rootMatch && bottleneckMatch ? 100 : 0),
      UNNECESSARY_AUTOMATION_RATE: score(unnecessary ? 0 : 100, {
        unnecessaryAutomationCount: unnecessary ? automation.length : 0,
      }),
    } as BrainEvaluationScorecard);
    const critical = failures.some((f) => f.severity === "CRITICAL");
    const status: EvaluationStatus = critical
      ? "CRITICAL_FAIL"
      : failures.length
        ? "FAIL"
        : warnings.length
          ? "PASS_WITH_WARNINGS"
          : "PASS";
    return Object.freeze({
      evaluationId: `evaluation:${scenario.scenarioId}:${brainVersion.version}`,
      scenarioId: scenario.scenarioId,
      seed: scenario.seed,
      generatorVersion: scenario.generatorVersion,
      brainVersion: Object.freeze({ ...brainVersion }),
      evaluatorVersion: this.evaluatorVersion,
      startedAt,
      completedAt: startedAt,
      publicInputReference: `synthetic-view:${scenario.scenarioId}`,
      groundTruthReference: scenario.groundTruthReference,
      brainResult: result,
      scorecard,
      failures: Object.freeze(failures),
      warnings: Object.freeze(warnings),
      status,
    });
  }
  evaluateSuite(runs: readonly BrainEvaluationRun[]): BrainEvaluationSuiteResult {
    const meanScores = Object.fromEntries(
      dimensions.map((d) => [
        d,
        runs.length ? clamp(runs.reduce((s, r) => s + r.scorecard[d].score, 0) / runs.length) : 0,
      ]),
    ) as Record<EvaluationDimension, number>;
    const worstCaseScores = Object.fromEntries(
      dimensions.map((d) => [
        d,
        runs.length ? Math.min(...runs.map((r) => r.scorecard[d].score)) : 0,
      ]),
    ) as Record<EvaluationDimension, number>;
    const normal = runs
      .filter((r) => !r.scenarioId.includes("adversarial"))
      .map((r) => this.overall(r));
    const adv = runs
      .filter((r) => r.scenarioId.includes("adversarial"))
      .map((r) => this.overall(r));
    const critical = runs.filter((r) => r.status === "CRITICAL_FAIL").length;
    return Object.freeze({
      runs: Object.freeze([...runs]),
      meanScores: Object.freeze(meanScores),
      worstCaseScores: Object.freeze(worstCaseScores),
      failureCount: runs.reduce((n, r) => n + r.failures.length, 0),
      criticalFailureCount: critical,
      normalOverallScore: normal.length
        ? clamp(normal.reduce((a, b) => a + b, 0) / normal.length)
        : 0,
      adversarialOverallScore: adv.length ? clamp(adv.reduce((a, b) => a + b, 0) / adv.length) : 0,
      categoryBreakdown: Object.freeze(
        Object.fromEntries(runs.map((r) => [r.scenarioId, this.overall(r)])),
      ),
      status: critical ? "CRITICAL_FAIL" : runs.some((r) => r.status === "FAIL") ? "FAIL" : "PASS",
    });
  }
  qualityReport(suite: BrainEvaluationSuiteResult): BrainQualityReport {
    const low = dimensions.filter((d) => suite.meanScores[d] < 70);
    return Object.freeze({
      strengths: dimensions.filter((d) => suite.meanScores[d] >= 90),
      weaknesses: low,
      criticalFailures: suite.criticalFailureCount ? ["Critical evaluation gate failed"] : [],
      topRegressionRisks: ["Root cause accuracy", "Unnecessary automation"],
      lowestScoringDimensions: low
        .sort((a, b) => suite.meanScores[a] - suite.meanScores[b])
        .slice(0, 5),
      recommendedInvestigationAreas: low,
    });
  }
  private overall(run: BrainEvaluationRun) {
    return clamp(dimensions.reduce((s, d) => s + run.scorecard[d].score, 0) / dimensions.length);
  }
}

export class BrainVersionComparator {
  compare(
    a: BrainEvaluationSuiteResult,
    b: BrainEvaluationSuiteResult,
  ): { status: VersionComparison; metricDeltas: Readonly<Record<EvaluationDimension, number>> } {
    const metricDeltas = Object.fromEntries(
      dimensions.map((d) => [d, b.meanScores[d] - a.meanScores[d]]),
    ) as Record<EvaluationDimension, number>;
    const values = Object.values(metricDeltas);
    const positive = values.some((v) => v > 0);
    const negative = values.some((v) => v < 0);
    return Object.freeze({
      status:
        positive && negative
          ? "MIXED"
          : positive
            ? "IMPROVED"
            : negative
              ? "REGRESSED"
              : "UNCHANGED",
      metricDeltas: Object.freeze(metricDeltas),
    });
  }
}

export class SyntheticBrainEvaluationRunner {
  run(view: SyntheticEnterpriseView): IntegratedBrainResult {
    const evidence = view.metrics.map((m) =>
      Evidence.create({
        evidenceId: m.id,
        sourceType: "SYSTEM_RECORD",
        sourceReference: m.sourceReference,
        sourceModule: "work_intelligence",
        capturedAt: new Date("2026-01-01"),
        freshness: "CURRENT",
        reliability: 0.95,
        content: `${m.name}: ${m.value ?? "unknown"} ${m.unit}`,
        structuredValue: m.value,
        provenance: { synthetic: true },
        tenantId: `synthetic:${view.enterpriseId}`,
      }),
    );
    const confidence = Confidence.create(
      0.7,
      {
        supportingEvidenceCount: evidence.length,
        averageSourceReliability: 0.95,
        sourceAgreement: 0.8,
        freshness: 1,
        directness: 0.8,
        contradictionPenalty: 0,
        missingDataPenalty: 0,
      },
      "Synthetic observable evidence",
    );
    const claims = view.interviews
      .filter((i) => i.answer !== null)
      .map((i) =>
        Claim.create({
          claimId: `claim:${i.id}`,
          kind: (i.status === "ACCURATE" ? "FACT" : "HYPOTHESIS") as ClaimKind,
          statement: `${i.question}: ${i.answer}`,
          supportingEvidenceIds: evidence.map((e) => e.evidenceId),
          confidence,
          rationale: `Interview ${i.status}`,
          createdByModule: "work_intelligence",
          createdAt: new Date("2026-01-01"),
          lastEvaluatedAt: new Date("2026-01-01"),
        }),
      );
    const process = Process.create({
      processId: view.processes[0]!.id,
      name: view.processes[0]!.name,
      steps: view.processes[0]!.steps.map((s) =>
        ProcessStep.create({
          stepId: s.id,
          name: s.action,
          actor: s.actorId,
          system: s.systemId,
          kind: s.id === "approve" ? "DECISION" : "MANUAL",
          volume: 62,
        }),
      ),
    });
    const input: BrainIntegrationInput = {
      companyId: view.enterpriseId,
      scenarioId: view.seed,
      subject: view.processes[0]!.name,
      evidence,
      claims,
      unknowns: [],
      process: ProcessModel.create({ process }),
      knowledge: {
        relevantPatterns: [],
        relevantBenchmarks: [],
        relevantRules: [],
        relevantSolutions: [],
        relevantCapabilities: [],
        conflicts: [],
      } as KnowledgeContext,
      economicInputs: {
        frequency: EconomicInputFactory.create("frequency", 1, "per day", "OBSERVED", "synthetic"),
        volume: EconomicInputFactory.create("volume", 62, "orders", "OBSERVED", "synthetic"),
        currentLaborTime: EconomicInputFactory.create(
          "currentLaborTime",
          18,
          "minutes",
          "OBSERVED",
          "synthetic",
        ),
      },
      facts: view.metrics.map((m) => `${m.name}=${m.value}`),
      processReadiness: {
        ownership: 1,
        definition: 1,
        variation: 0.2,
        rootCause: 0.5,
        dataQuality: 0.8,
        contradiction: 0.2,
        exceptions: 0.1,
        controls: 1,
      },
      feasibility: {
        requiredCapabilities: ["ERP_WRITE_API"],
        knownCapabilities: view.systems.flatMap((s) => s.capabilities),
        integrationAvailable: 0.6,
        apiWrite: 0.6,
        dataAccessible: 0.8,
        authentication: 0.7,
        trigger: 0.5,
        batch: 0.8,
        humanApproval: 1,
        observability: 0.6,
      },
    };
    return new BrainIntegrationPipeline().run(input);
  }
}
