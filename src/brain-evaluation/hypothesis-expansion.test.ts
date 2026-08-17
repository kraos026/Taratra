import { describe, expect, it } from "vitest";
import type {
  AICandidate,
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "./ai-interpretation-gateway";
import {
  HypothesisBrainAdapter,
  HypothesisExpansionService,
  type HypothesisCandidate,
  type HypothesisExpansionInput,
} from "./hypothesis-expansion";
import { Contradiction, Evidence, UnknownInformation } from "./brain-contracts";

describe("AI-2 HypothesisExpansionService", () => {
  it("generates diverse approval-delay candidates without confirming root cause", async () => {
    const service = new HypothesisExpansionService(
      provider([
        candidate("exception-concentration", {
          hypothesis: "Approval delay may be concentrated in exception cases.",
          hypothesisType: "EXCEPTION_HANDLING",
          supportingEvidenceIds: ["evidence:erp-median", "evidence:manager-estimate"],
          conflictingEvidenceIds: ["evidence:erp-median"],
          requiredEvidence: ["exception-case wait distribution"],
          materialityCandidate: "HIGH",
          novelty: "NEW_ALTERNATIVE",
        }),
        candidate("single-approver", {
          hypothesis: "A single approver dependency may delay approvals.",
          hypothesisType: "SINGLE_PERSON_DEPENDENCY",
          supportingEvidenceIds: ["evidence:manager-estimate"],
          requiredEvidence: ["actor availability evidence", "approval timestamps"],
          bestEvidenceSource: "SYSTEM_EVIDENCE",
          novelty: "NEW_ALTERNATIVE",
        }),
        candidate("threshold-misconfiguration", {
          hypothesis: "Approval threshold configuration may be stale or misconfigured.",
          hypothesisType: "CONTROL_CONFIGURATION",
          requiredEvidence: ["current approval threshold configuration"],
          evidenceGrounding: "PLAUSIBLE_BUT_UNSUPPORTED",
          novelty: "NEW_ALTERNATIVE",
        }),
        candidate("batching-notification", {
          hypothesis: "Batching or delayed notification behavior may create waiting time.",
          hypothesisType: "QUEUEING",
          supportingEvidenceIds: ["evidence:manager-estimate"],
          requiredEvidence: ["notification timestamp evidence"],
          novelty: "NEW_ALTERNATIVE",
        }),
      ]),
    );
    const result = await service.expand(approvalInput());
    expect(result.candidates.map((item) => item.hypothesisType)).toEqual(
      expect.arrayContaining([
        "EXCEPTION_HANDLING",
        "SINGLE_PERSON_DEPENDENCY",
        "CONTROL_CONFIGURATION",
        "QUEUEING",
      ]),
    );
    expect(result.candidates.every((item) => item.authoritativeRootCause === false)).toBe(true);
    expect(result.candidates.every((item) => item.factPromotion === false)).toBe(true);
    expect(result.candidates.every((item) => item.directOpportunityPublication === false)).toBe(
      true,
    );
  });

  it("keeps bad-data workload as remediation hypothesis, not opportunity publication", async () => {
    const result = await new HypothesisExpansionService(
      provider([
        candidate("data-quality-rework", {
          subject: "manual reconciliation workload",
          hypothesis: "Missing customer IDs and duplicate entries may drive manual rework.",
          hypothesisType: "DATA_QUALITY",
          supportingEvidenceIds: ["evidence:missing-customer-ids", "evidence:duplicates"],
          requiredEvidence: ["master data quality report"],
          relatedProcessNodeIds: ["step:reconcile"],
          novelty: "NEW_ALTERNATIVE",
        }),
      ]),
    ).expand(dataQualityInput());
    expect(result.candidates[0]).toMatchObject({
      hypothesisType: "DATA_QUALITY",
      directOpportunityPublication: false,
    });
  });

  it("rejects unsupported creative hypotheses with invented system evidence", async () => {
    const result = await new HypothesisExpansionService(
      provider([
        candidate("invented-salesforce", {
          hypothesis: "Salesforce integration failure may cause approval delays.",
          hypothesisType: "INTEGRATION",
          supportingEvidenceIds: [],
          requiredEvidence: ["Salesforce integration logs"],
          novelty: "NEW_ALTERNATIVE",
        }),
      ]),
    ).expand(approvalInput());
    expect(result.candidates).toHaveLength(0);
    expect(result.rejectedCandidates[0]?.reason).toContain("invented system reference");
  });

  it("marks contradicted capacity hypotheses through Brain validation", async () => {
    const expansion = await new HypothesisExpansionService(
      provider([
        candidate("capacity-shortage", {
          hypothesis: "Capacity shortage may explain approval delays.",
          hypothesisType: "CAPACITY",
          evidenceGrounding: "CONFLICTED_BY_EVIDENCE",
          conflictingEvidenceIds: ["evidence:capacity-sufficient"],
          supportingEvidenceIds: ["evidence:manager-estimate"],
          requiredEvidence: [],
        }),
      ]),
    ).expand(approvalInput({ evidence: [...approvalInput().evidence, capacityEvidence()] }));
    const validation = new HypothesisBrainAdapter().validate({
      candidate: expansion.candidates[0]!,
      evidence: [...approvalInput().evidence, capacityEvidence()],
      contradictions: approvalInput().contradictions,
      unknowns: approvalInput().unknowns,
    });
    expect(validation.outcome).toBe("CONTRADICTED");
    expect(validation.claim.kind).toBe("HYPOTHESIS");
    expect(validation.causeCandidate.kind).toBe("CANDIDATE");
  });

  it("creates testable follow-up gaps for Adaptive Discovery", async () => {
    const expansion = await new HypothesisExpansionService(
      provider([
        candidate("single-approver", {
          hypothesis: "A single approver dependency may delay approvals.",
          hypothesisType: "SINGLE_PERSON_DEPENDENCY",
          supportingEvidenceIds: ["evidence:manager-estimate"],
          requiredEvidence: ["approval timestamps", "actor availability evidence"],
          bestEvidenceSource: "SYSTEM_EVIDENCE",
          testPlan: "Compare wait duration during approver absence and presence.",
        }),
      ]),
    ).expand(approvalInput());
    const validation = new HypothesisBrainAdapter().validate({
      candidate: expansion.candidates[0]!,
      evidence: approvalInput().evidence,
      contradictions: approvalInput().contradictions,
    });
    const targets = new HypothesisBrainAdapter().discoveryTargets(validation);
    expect(validation.outcome).toBe("NEED_MORE_EVIDENCE");
    expect(validation.informationGaps.map((gap) => gap.subject)).toEqual(
      expect.arrayContaining(["approval timestamps", "actor availability evidence"]),
    );
    expect(targets.some((target) => target.source.questionType === "SYSTEM_DATA_REQUEST")).toBe(
      true,
    );
  });

  it("deduplicates semantically equivalent candidates and respects budget", async () => {
    const result = await new HypothesisExpansionService(
      provider([
        candidate("single-approver-a", {
          hypothesis: "A single approver dependency may delay approvals.",
          hypothesisType: "SINGLE_PERSON_DEPENDENCY",
          noveltyKey: "single-approver",
        }),
        candidate("single-approver-b", {
          hypothesis: "One approver may delay approvals.",
          hypothesisType: "SINGLE_PERSON_DEPENDENCY",
          noveltyKey: "single-approver",
        }),
        candidate("batching", {
          hypothesis: "Batching behavior may delay approvals.",
          hypothesisType: "QUEUEING",
          noveltyKey: "batching",
        }),
      ]),
    ).expand(approvalInput({ candidateBudget: 1 }));
    expect(result.candidates).toHaveLength(1);
    expect(result.duplicatesRemoved).toBeGreaterThanOrEqual(1);
  });

  it("falls back without blocking core Brain reasoning when provider is unavailable", async () => {
    const result = await new HypothesisExpansionService(failingProvider()).expand(approvalInput());
    expect(result.providerUnavailable).toBe(true);
    expect(result.candidates).toHaveLength(0);
  });

  it("rejects cross-company input evidence before provider context is built", async () => {
    await expect(
      new HypothesisExpansionService(provider([])).expand(
        approvalInput({
          evidence: [
            Evidence.create({
              ...evidenceInput("evidence:foreign", "foreign evidence"),
              companyId: "company-b",
            }),
          ],
        }),
      ),
    ).rejects.toThrow("company scope");
  });

  it("acceptance metrics remain safe", async () => {
    const result = await new HypothesisExpansionService(
      provider([
        candidate("exception-concentration", {
          hypothesis: "Approval delay may be concentrated in exception cases.",
          hypothesisType: "EXCEPTION_HANDLING",
          supportingEvidenceIds: ["evidence:manager-estimate"],
          requiredEvidence: ["exception-case wait distribution"],
          novelty: "NEW_ALTERNATIVE",
        }),
        candidate("threshold", {
          hypothesis: "Approval threshold configuration may be stale.",
          hypothesisType: "CONTROL_CONFIGURATION",
          requiredEvidence: ["current approval threshold configuration"],
          novelty: "NEW_ALTERNATIVE",
        }),
      ]),
    ).expand(approvalInput());
    const validations = result.candidates.map((item) =>
      new HypothesisBrainAdapter().validate({
        candidate: item,
        evidence: approvalInput().evidence,
        contradictions: approvalInput().contradictions,
      }),
    );
    expect(result.rawCandidateCount).toBe(2);
    expect(result.rejectedCandidates).toHaveLength(0);
    expect(validations.filter((item) => item.outcome === "NEED_MORE_EVIDENCE")).toHaveLength(2);
    expect(validations.some((item) => item.claim.kind === "FACT")).toBe(false);
    expect(validations.some((item) => item.causeCandidate.kind === "ROOT")).toBe(false);
  });
});

function provider(candidates: readonly HypothesisCandidate[]): AIProvider {
  return {
    providerId: "hypothesis-fixture",
    async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
      return {
        requestId: request.requestId,
        provider: "hypothesis-fixture",
        model: "fixture-model",
        task: request.task,
        schemaVersion: request.schemaVersion,
        candidates: candidates.map((item): AICandidate => ({
          candidateId: item.candidateId,
          candidateType: "CAUSE_CANDIDATE",
          statement: item.hypothesis,
          value: item,
          sourceReference: `${request.sourceId}:hypothesis-context`,
          sourceExcerpt: request.sourceText.slice(0, 120),
          rationale: item.reasoningSummary,
          knowledgeReferences: [],
          status: "AI_DERIVED",
          review: "REQUIRED",
        })),
        sourceReferences: [request.sourceId],
        warnings: [],
        validationIssues: [],
        createdAt: new Date("2026-01-01T00:00:00Z"),
      };
    },
  };
}

function failingProvider(): AIProvider {
  return {
    providerId: "failing",
    async interpret() {
      throw new Error("provider unavailable");
    },
  };
}

function candidate(id: string, overrides: Partial<HypothesisCandidate>): HypothesisCandidate {
  return {
    candidateId: id,
    subject: overrides.subject ?? "approval queue bottleneck",
    hypothesis: overrides.hypothesis ?? "A process issue may explain the symptom.",
    hypothesisType: overrides.hypothesisType ?? "OTHER",
    reasoningSummary: overrides.reasoningSummary ?? "Candidate generated from bounded context.",
    evidenceGrounding: overrides.evidenceGrounding ?? "SUPPORTED_BY_CURRENT_EVIDENCE",
    supportingEvidenceIds: overrides.supportingEvidenceIds ?? [],
    conflictingEvidenceIds: overrides.conflictingEvidenceIds ?? [],
    requiredEvidence: overrides.requiredEvidence ?? [],
    relatedProcessNodeIds: overrides.relatedProcessNodeIds ?? ["step:approval"],
    relatedConceptIds: overrides.relatedConceptIds ?? ["semantic:exception-approval"],
    sourceScope: overrides.sourceScope ?? {
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain-run-1",
      problemReference: "problem:approval-delay",
    },
    testable: overrides.testable ?? true,
    testPlan: overrides.testPlan ?? "Compare objective evidence against the hypothesis.",
    bestEvidenceSource: overrides.bestEvidenceSource ?? "PROCESS_EVIDENCE",
    materialityCandidate: overrides.materialityCandidate ?? "HIGH",
    novelty: overrides.novelty ?? "NEW_ALTERNATIVE",
    noveltyKey: overrides.noveltyKey ?? id,
    providerMetadata: overrides.providerMetadata ?? {
      provider: "hypothesis-fixture",
      model: "fixture-model",
    },
    authoritativeRootCause: false,
    factPromotion: false,
    directOpportunityPublication: false,
  };
}

function approvalInput(
  overrides: Partial<HypothesisExpansionInput> = {},
): HypothesisExpansionInput {
  return {
    tenantId: "tenant-a",
    companyId: "company-a",
    brainRunId: "brain-run-1",
    problemReference: "problem:approval-delay",
    problem: "approval queue bottleneck",
    bottleneck: "approval waiting",
    criticalIssue: "stale policy evidence",
    relevantProcessNodeIds: ["step:approval", "step:erp-entry"],
    existingHypotheses: ["approval queue is the primary delay driver"],
    evidence: [erpMedianEvidence(), managerEstimateEvidence(), stalePolicyEvidence()],
    contradictions: [approvalContradiction()],
    unknowns: [thresholdUnknown()],
    semanticConceptIds: ["semantic:marc-check", "semantic:exception-approval"],
    candidateBudget: 5,
    ...overrides,
  };
}

function dataQualityInput(): HypothesisExpansionInput {
  return {
    tenantId: "tenant-a",
    companyId: "company-a",
    brainRunId: "brain-run-1",
    problemReference: "problem:manual-reconciliation",
    problem: "manual reconciliation workload",
    relevantProcessNodeIds: ["step:reconcile"],
    evidence: [
      Evidence.create(evidenceInput("evidence:missing-customer-ids", "missing customer IDs")),
      Evidence.create(evidenceInput("evidence:duplicates", "duplicate entries")),
      Evidence.create(evidenceInput("evidence:manual-corrections", "manual corrections")),
    ],
    candidateBudget: 5,
  };
}

function erpMedianEvidence() {
  return Evidence.create(
    evidenceInput("evidence:erp-median", "ERP median approval wait is 47 minutes"),
  );
}

function managerEstimateEvidence() {
  return Evidence.create(
    evidenceInput("evidence:manager-estimate", "Manager estimates approval wait is around 2 hours"),
  );
}

function stalePolicyEvidence() {
  return Evidence.create(
    evidenceInput("evidence:stale-policy", "Approval policy evidence is stale"),
  );
}

function capacityEvidence() {
  return Evidence.create(
    evidenceInput("evidence:capacity-sufficient", "Approver capacity is sufficient"),
  );
}

function evidenceInput(evidenceId: string, content: string) {
  return {
    evidenceId,
    sourceType: "OBSERVED" as const,
    sourceReference: `source:${evidenceId}`,
    sourceModule: "brain_evaluation" as const,
    capturedAt: new Date("2026-01-01T00:00:00Z"),
    freshness: "CURRENT" as const,
    reliability: 0.8,
    content,
    provenance: { sourceId: evidenceId },
    tenantId: "tenant-a",
    companyId: "company-a",
    tags: ["step:approval"],
  };
}

function approvalContradiction() {
  return Contradiction.create({
    contradictionId: "contradiction:approval-time",
    kind: "QUANTITATIVE",
    leftClaimId: "claim:manager-estimate",
    rightClaimId: "claim:erp-median",
    leftEvidenceIds: ["evidence:manager-estimate"],
    rightEvidenceIds: ["evidence:erp-median"],
    materiality: "HIGH",
    impact: "Manager estimate differs materially from ERP median.",
    requiresClarification: true,
    detectedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

function thresholdUnknown() {
  return UnknownInformation.create({
    unknownId: "unknown:approval-threshold",
    missingField: "approval threshold configuration",
    domain: "approval",
    reason: "Threshold configuration is unavailable",
    impact: "Cannot determine whether approval threshold is misconfigured",
    requiredFor: ["finding", "decision"],
    priority: "HIGH",
    suggestedClarification: "Provide current approval threshold configuration.",
  });
}
