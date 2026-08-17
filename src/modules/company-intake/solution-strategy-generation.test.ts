import { describe, expect, it } from "vitest";
import { Evidence } from "../../brain-evaluation/brain-contracts";
import type {
  AICandidate,
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "../../brain-evaluation/ai-interpretation-gateway";
import {
  SolutionStrategyGenerationService,
  type SolutionStrategyInput,
} from "./application/solution-strategy-generation";

const tenantId = "tenant-a";
const companyId = "company-a";

describe("SolutionStrategyGenerationService", () => {
  it("generates diverse approval strategies without auto-approving mandatory exceptions", async () => {
    const result = await new SolutionStrategyGenerationService().generate(
      approvalInput({
        remediationRequirements: ["Fix stale approval master data"],
        doNotAutomateConstraints: ["Final exception approval must remain human"],
      }),
    );
    expect(result.metrics.strategyFamiliesRepresented).toBeGreaterThanOrEqual(3);
    expect(result.candidates.map((candidate) => candidate.strategyFamily)).toContain(
      "DATA_REMEDIATION",
    );
    expect(result.candidates.map((candidate) => candidate.strategyFamily)).toContain(
      "HUMAN_IN_THE_LOOP_AUTOMATION",
    );
    expect(
      [...result.candidates, ...result.rejectedCandidates].some((candidate) =>
        JSON.stringify(candidate).toLowerCase().includes("auto-approve"),
      ),
    ).toBe(false);
    expect(result.metrics.directBlueprintPublication).toBe(0);
    expect(result.metrics.aiRecommendationAuthority).toBe(0);
  });

  it("retains data remediation before pure automation for manual reconciliation data quality", async () => {
    const result = await new SolutionStrategyGenerationService().generate(
      approvalInput({
        problem: "manual reconciliation takes too long",
        rootCauseOrHypothesis: "duplicate and missing customer IDs create rework",
        remediationRequirements: ["Clean duplicate customer IDs"],
        doNotAutomateConstraints: [],
        economicState: {
          state: "POTENTIALLY_JUSTIFIED",
          signal: "POSITIVE_VALUE",
          evidenceRefs: ["economic:1"],
          missingEvidence: [],
        },
      }),
    );
    const data = result.comparison.strategies.find(
      (candidate) => candidate.strategyFamily === "DATA_REMEDIATION",
    );
    const api = result.comparison.strategies.find(
      (candidate) => candidate.strategyFamily === "API_INTEGRATION",
    );
    expect(data?.status).toBe("RETAIN_FOR_COMPARISON");
    expect(api?.status).toBe("BLOCKED_BY_REMEDIATION");
    expect(
      result.comparison.dependencies.some((edge) => edge.dependentCandidateId === api?.candidateId),
    ).toBe(true);
  });

  it("keeps manual/defer strategy valid for low-volume economically weak work", async () => {
    const result = await new SolutionStrategyGenerationService().generate(
      approvalInput({
        problem: "low-volume exception check is manual",
        rootCauseOrHypothesis: "low frequency task",
        doNotAutomateConstraints: [],
        economicState: {
          state: "NOT_JUSTIFIED",
          signal: "NEGATIVE_VALUE",
          evidenceRefs: ["economic:low-volume"],
          missingEvidence: [],
        },
      }),
    );
    expect(result.comparison.strategies.some((item) => item.strategyFamily === "DEFER")).toBe(true);
    expect(result.metrics.nonAutomationStrategiesRetained).toBeGreaterThan(0);
    expect(
      result.comparison.strategies.some(
        (item) => item.strategyFamily === "API_INTEGRATION" && item.status === "ECONOMICALLY_WEAK",
      ),
    ).toBe(true);
  });

  it("marks invented system capability as needing evidence and routes Adaptive Discovery", async () => {
    const result = await new SolutionStrategyGenerationService(
      provider([
        aiCandidate("strategy:erp-ai", {
          strategyFamily: "NATIVE_SYSTEM_CONFIGURATION",
          title: "Use ERP native AI workflow",
          summary: "Configure the ERP native AI workflow to automate triage.",
          requiredSystems: ["ERP"],
          requiredData: ["ERP native AI workflow capability"],
          prerequisites: ["ERP native AI workflow capability"],
          noveltyKey: "erp-native-ai",
        }),
      ]),
    ).generate(approvalInput({ doNotAutomateConstraints: [], controlRequirements: [] }));
    const item = result.comparison.strategies[0]!;
    expect(item.status).toBe("NEEDS_MORE_EVIDENCE");
    expect(item.discoveryTargets[0]?.targetSource).toBe("IT_INTERVIEW");
    expect(result.metrics.inventedSystemCapabilitiesAccepted).toBe(0);
  });

  it("rejects autonomous strategies that bypass protected human control", async () => {
    const result = await new SolutionStrategyGenerationService(
      provider([
        aiCandidate("strategy:auto-approve", {
          strategyFamily: "LOW_CODE_AUTOMATION",
          title: "Fully autonomous exception workflow",
          summary: "Auto-approve exceptions and skip human approval.",
          preservedHumanControls: [],
          noveltyKey: "auto-approval",
        }),
      ]),
    ).generate(
      approvalInput({
        doNotAutomateConstraints: ["Mandatory final exception approval cannot be automated"],
      }),
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.rejectedCandidates[0]?.reason).toBe("CONTROL_CONFLICT");
    expect(result.metrics.controlBypassAccepted).toBe(0);
  });

  it("rejects invented economics and never converts provider ranking into AI score", async () => {
    const result = await new SolutionStrategyGenerationService(
      provider([
        aiCandidate("strategy:fake-roi", {
          strategyFamily: "LOW_CODE_AUTOMATION",
          title: "Automate with 4.2x ROI",
          summary: "This will pay back in 3 months.",
          noveltyKey: "fake-roi",
        }),
      ]),
    ).generate(approvalInput({ doNotAutomateConstraints: [] }));
    expect(result.candidates).toHaveLength(0);
    expect(result.rejectedCandidates[0]?.reason).toBe("REJECTED");
    expect(result.comparison.aiScoreUsed).toBe(false);
    expect(result.metrics.inventedEconomicsAccepted).toBe(0);
  });

  it("rejects cross-company evidence before strategy prompt construction", async () => {
    await expect(
      new SolutionStrategyGenerationService(provider([])).generate(
        approvalInput({
          evidence: [evidence("evidence:foreign", "tenant-a", "company-b", "foreign")],
        }),
      ),
    ).rejects.toThrow("Cross-company evidence");
  });
});

function approvalInput(overrides: Partial<SolutionStrategyInput> = {}): SolutionStrategyInput {
  const baseEvidence = [
    evidence("evidence:approval", tenantId, companyId, "Approval queue waits when Marc is away"),
    evidence("economic:1", tenantId, companyId, "Observed manual delay cost evidence exists"),
  ];
  return {
    tenantId,
    companyId,
    brainRunId: "brain:strategy:1",
    problem: "approval queue delay",
    rootCauseOrHypothesis: "stale approval master data and single-person approval dependency",
    bottleneck: "approval queue",
    criticalIssue: "mandatory exception approval must remain controlled",
    opportunity: {
      opportunityId: "opportunity:approval",
      subject: "approval queue",
      candidateType: "HUMAN_ASSISTED",
      status: "REMEDIATION_REQUIRED",
      supportingEvidenceIds: ["evidence:approval"],
      processStepIds: ["node:approval"],
      solutionPatternIds: ["pattern:hitl"],
      prerequisites: [
        {
          id: "prereq:data",
          description: "Clean approver data",
          reason: "stale data",
          blocking: true,
        },
      ],
    },
    remediationRequirements: [],
    doNotAutomateConstraints: ["Final exception approval must remain human"],
    economicState: {
      state: "POTENTIALLY_JUSTIFIED",
      signal: "POSITIVE_VALUE",
      evidenceRefs: ["economic:1"],
      missingEvidence: [],
    },
    processContext: [
      {
        nodeId: "node:approval",
        name: "Exception approval",
        systems: ["ERP"],
        controls: ["human exception approval"],
        humanDecision: true,
      },
    ],
    systemsContext: [
      {
        systemId: "system:erp",
        name: "ERP",
        capabilities: [],
        evidenceRefs: ["evidence:approval"],
      },
    ],
    controlRequirements: [
      {
        controlId: "control:exception-approval",
        description: "Mandatory human exception approval",
        mandatory: true,
        humanApprovalRequired: true,
        evidenceRefs: ["evidence:approval"],
      },
    ],
    knownCompanyConstraints: ["Use existing ERP where possible"],
    evidence: baseEvidence,
    knowledgePatternIds: ["pattern:hitl", "pattern:data-quality"],
    strategyBudget: 8,
    ...overrides,
  };
}

function evidence(id: string, tenant: string, company: string, content: string) {
  return Evidence.create({
    evidenceId: id,
    sourceType: id.startsWith("economic") ? "METRIC" : "INTERVIEW",
    sourceReference: `source:${id}`,
    sourceModule: "brain_evaluation",
    capturedAt: new Date("2026-01-01T00:00:00Z"),
    freshness: "CURRENT",
    reliability: 0.8,
    content,
    provenance: { id },
    tenantId: tenant,
    companyId: company,
  });
}

function provider(candidates: readonly AICandidate[]): AIProvider {
  return {
    providerId: "fixture-provider",
    interpret: async (request: AIInterpretationRequest): Promise<AIInterpretationResult> =>
      Object.freeze({
        requestId: request.requestId,
        provider: "fixture-provider",
        model: "fixture-model",
        task: request.task,
        schemaVersion: request.schemaVersion,
        candidates: Object.freeze(
          candidates.map((candidate) => ({
            ...candidate,
            sourceReference: `${request.sourceId}:1`,
          })),
        ),
        sourceReferences: Object.freeze([request.sourceId]),
        warnings: Object.freeze([]),
        validationIssues: Object.freeze([]),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
  };
}

function aiCandidate(candidateId: string, value: Record<string, unknown>): AICandidate {
  return {
    candidateId,
    candidateType: "SUMMARY",
    statement: String(value.title ?? candidateId),
    value,
    sourceReference: "opportunity:approval:1",
    sourceExcerpt: String(value.summary ?? value.title ?? candidateId),
    confidenceHint: 0.8,
    rationale: "fixture",
    knowledgeReferences: [],
    status: "AI_DERIVED",
    review: "REQUIRED",
  };
}
