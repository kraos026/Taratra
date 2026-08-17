import { describe, expect, it } from "vitest";
import {
  Contradiction,
  ReasoningTrace,
  UnknownInformation,
} from "../../brain-evaluation/brain-contracts";
import {
  RealCompanyEconomicEvidenceAssembler,
  RealCompanyAuditPilot,
  createRealCompanyPilotFixture,
} from "./index";
import type { ClosedLoopDiscoveryResult } from "./application/closed-loop-discovery-orchestrator";
import type { ApproveDiscoveryActionCommand } from "./application/approved-discovery-action-write-bridge";
import type { RealCompanyBrainResult } from "./application/real-company-brain-orchestrator";

const tenantId = "pilot-tenant";
const companyId = "pilot-company";

const trace = ReasoningTrace.create(
  { "evidence:1": "Observed queue", "cause:1": "Approval queue root cause" },
  [{ fromId: "evidence:1", toId: "cause:1", relationship: "supports", rationale: "Observation" }],
);

function brainResult(overrides: Partial<RealCompanyBrainResult> = {}): RealCompanyBrainResult {
  const unknown = UnknownInformation.create({
    unknownId: "unknown:approval-threshold",
    missingField: "approval threshold evidence",
    domain: "process",
    reason: "Manager and SOP describe different approval thresholds",
    impact: "Autonomous execution cannot be justified",
    requiredFor: ["automation decision"],
    priority: "HIGH",
    suggestedClarification: "Confirm the current approval threshold from owner or SOP update",
  });
  const contradiction = Contradiction.create({
    contradictionId: "contradiction:threshold",
    kind: "STALE_VS_CURRENT",
    leftClaimId: "claim:sop",
    rightClaimId: "claim:manager",
    leftEvidenceIds: ["sop-1"],
    rightEvidenceIds: ["interview-manager"],
    materiality: "HIGH",
    impact: "Approval policy may be stale",
    requiresClarification: true,
    detectedAt: new Date("2026-01-01T00:00:00Z"),
  });
  const qualified = {
    opportunityId: "opportunity:reconcile",
    subject: "Payment reconciliation",
    problemStatement: "Manual reconciliation consumes finance capacity",
    candidateType: "AUTOMATION",
    status: "QUALIFIED",
    confidence: 0.78,
    supportingEvidenceIds: ["finance-1"],
    trace,
  };
  const remediation = {
    opportunityId: "opportunity:data-quality",
    subject: "ERP data quality",
    problemStatement: "Fix stale approval master data before automation",
    candidateType: "DATA_QUALITY",
    status: "REMEDIATION_REQUIRED",
    confidence: 0.8,
    supportingEvidenceIds: ["system-1"],
    trace,
  };
  const doNotAutomate = {
    opportunityId: "opportunity:human-approval",
    subject: "Exception approval",
    problemStatement: "Keep mandatory exception approval human-controlled",
    candidateType: "DO_NOT_AUTOMATE",
    status: "REJECTED",
    confidence: 0.9,
    supportingEvidenceIds: ["sop-1"],
    trace,
  };
  return {
    companyId,
    tenantId,
    readiness: { status: "READY_FOR_BRAIN", criticalGaps: [] } as never,
    sourceSnapshot: { companyId, knowledgeSnapshotId: "knowledge-1" },
    evidence: { count: 4, ids: ["sop-1", "system-1", "process-1", "finance-1"] },
    brainEvidence: [{ evidenceId: "evidence:1" }],
    claims: [
      { claimId: "claim:sop", kind: "INFERENCE", statement: "SOP approval threshold is stale" },
      {
        claimId: "claim:manager",
        kind: "BELIEF",
        statement: "Manager believes all exceptions must be approved",
      },
    ],
    whatWeKnow: ["Order volume is source-backed by ERP"],
    whatWeBelieve: ["Manager believes approval policy changed"],
    whatWeDoNotKnow: [unknown],
    contradictions: [contradiction],
    processFindings: [],
    rootCauseHypotheses: [
      {
        causeId: "cause:approval-queue",
        kind: "ROOT",
        statement: "Approval queue is the primary delay driver",
        confidence: 0.74,
        supportingEvidenceIds: ["process-1"],
        trace,
      },
    ],
    bottlenecks: [
      {
        stepId: "step-approval",
        reason: "Approval queue waits two hours before finance can continue",
        impact: 0.8,
        materiality: 0.8,
        severity: "HIGH",
        confidence: 0.8,
        evidenceIds: ["process-1"],
      },
    ],
    criticalIssues: [
      {
        issueId: "issue:approval",
        issueType: "MANDATORY_CONTROL_RISK",
        subject: "Exception approval",
        severity: "HIGH",
        evidence: ["sop-1"],
        reason: "Mandatory approval must remain human-controlled",
        downstreamImpact: "Automation must preserve approval",
        blockingDecision: true,
        confidence: 0.9,
      },
    ],
    detectedOpportunities: [qualified, remediation, doNotAutomate],
    qualifiedOpportunities: [qualified],
    deferredOpportunities: [],
    rejectedOpportunities: [doNotAutomate],
    remediationRequired: [remediation],
    economicState: { status: "QUALIFIED" } as never,
    nextBestActions: ["Confirm approval threshold", "Remediate stale ERP approval data"],
    traceReferences: {
      evidence: ["sop-1", "system-1", "process-1", "finance-1"],
      claims: ["claim:sop", "claim:manager"],
      processMap: ["process-map-1"],
    },
    brain: { scenarioId: "pilot-scenario" } as never,
    ...overrides,
  } as unknown as RealCompanyBrainResult;
}

function loop(
  result: RealCompanyBrainResult,
  status: ClosedLoopDiscoveryResult["loop"]["stoppingState"],
): ClosedLoopDiscoveryResult {
  return {
    loop: {
      tenantId,
      companyId,
      loopId: "pilot:pilot-company:pilot-scenario",
      initialBrainRunId: "pilot-scenario",
      currentBrainRunId: "pilot-scenario",
      iterationNumber: 1,
      materialGapIds: ["gap:approval"],
      resolvedGapIds: status === "READY_WITH_DECLARED_UNCERTAINTY" ? ["gap:approval"] : [],
      openGapIds: status === "READY_WITH_DECLARED_UNCERTAINTY" ? [] : ["gap:approval"],
      pendingRecommendedActionIds: ["question:approval"],
      approvedActionIds: [],
      executedActionIds: [],
      rejectedActionIds: [],
      stoppingState: status,
      remainingQuestionBudget: 2,
      status: status === "CONTINUE_DISCOVERY" ? "ACTIVE" : "STOPPED",
    },
    initialBrainResult: result,
    currentBrainResult: result,
    currentPlan: {} as never,
    materialGapIds: ["gap:approval"],
    resolvedGapIds: [],
    openGapIds: ["gap:approval"],
    actionsProposed: [],
    actionsApproved: [],
    actionsExecuted: [],
    actionsRejected: [],
    actionsUnsupported: [],
    stoppingReason: status,
    remainingQuestionBudget: 2,
    nextBestActions: result.nextBestActions,
    observations: [],
    traceability: { evidence: ["sop-1"] },
  };
}

describe("RealCompanyAuditPilot", () => {
  it("provides a realistic offline fixture without sector-specific engine shortcuts", () => {
    const fixture = createRealCompanyPilotFixture();
    expect(fixture.company.name).toBe("Northstar Operations");
    expect(fixture.actors.map((actor) => actor.role)).toEqual(
      expect.arrayContaining(["OWNER", "MANAGER", "OPERATOR", "FINANCE", "IT"]),
    );
    expect(fixture.discovery.status).toBe("COMPLETED");
    expect(fixture.interviews).toHaveLength(5);
    expect(fixture.knowledgeSnapshot.status).toBe("VALIDATED");
    expect(fixture.processMap.status).toBe("published");
    expect(fixture.sources.map((source) => source.sourceType)).toEqual(
      expect.arrayContaining(["DOCUMENT", "SYSTEM_RECORD", "OBSERVED", "METRIC"]),
    );
    expect(fixture.economicEvidence).toHaveLength(1);
  });

  it("runs the existing Brain, closed-loop discovery and economic bridge into an executive read model", async () => {
    const fixture = createRealCompanyPilotFixture();
    const initial = brainResult();
    const final = brainResult({
      whatWeDoNotKnow: [],
      nextBestActions: ["Remediate stale ERP approval data", "Qualify reconciliation automation"],
    });
    const calls: string[] = [];
    const pilot = new RealCompanyAuditPilot({
      brain: { run: async () => initial },
      discovery: {
        start: async () => loop(initial, "CONTINUE_DISCOVERY"),
        approve: async (_loopId, command) => {
          calls.push(command.actionId);
          return loop(initial, "CONTINUE_DISCOVERY");
        },
        processResponse: async () => loop(final, "READY_WITH_DECLARED_UNCERTAINTY"),
      },
      economics: new RealCompanyEconomicEvidenceAssembler(),
    });
    const result = await pilot.run({
      brain: {
        tenantId,
        companyId,
        knowledgeSnapshotId: "knowledge-1",
        processMapId: "process-map-1",
      },
      economic: {
        tenantId,
        companyId,
        knowledgeSnapshotId: "knowledge-1",
        opportunityId: "opportunity:reconcile",
        evidence: fixture.economicEvidence,
      },
      approvedActions: [
        approval("question:approval"),
        approval("question:economic"),
        approval("question:system"),
        approval("question:extra"),
      ],
      responseIds: ["response:approval"],
    });
    expect(calls).toEqual(["question:approval", "question:economic", "question:system"]);
    expect(result.finalLoop.loop.stoppingState).toBe("READY_WITH_DECLARED_UNCERTAINTY");
    expect(result.product.topProblems).toEqual(expect.arrayContaining(["Exception approval"]));
    expect(result.product.whatCanBeAutomated).toEqual([
      "Manual reconciliation consumes finance capacity",
    ]);
    expect(result.product.whatNotToAutomate).toContain(
      "Keep mandatory exception approval human-controlled",
    );
    expect(result.product.whatToFixFirst).toContain(
      "Fix stale approval master data before automation",
    );
    expect(result.economic.state).toBe("QUALIFIED");
    expect(result.traceability.economic).toContain("finance-1");
    expect(result.safety).toEqual({
      groundTruthLeaks: 0,
      crossCompanyLeakage: 0,
      factAutoPromotion: 0,
      unsafeRecommendations: 0,
      humanControlViolations: 0,
    });
    expect(result.executiveUsefulness.status).toBe("YES");
  });

  it("rejects approved discovery actions outside the tenant/company before any production write", async () => {
    let approvals = 0;
    const pilot = new RealCompanyAuditPilot({
      brain: { run: async () => brainResult() },
      discovery: {
        start: async () => loop(brainResult(), "CONTINUE_DISCOVERY"),
        approve: async () => {
          approvals += 1;
          return loop(brainResult(), "CONTINUE_DISCOVERY");
        },
        processResponse: async () => loop(brainResult(), "CONTINUE_DISCOVERY"),
      },
      economics: new RealCompanyEconomicEvidenceAssembler(),
    });
    await expect(
      pilot.run({
        brain: { tenantId, companyId },
        economic: {
          tenantId,
          companyId,
          knowledgeSnapshotId: "knowledge-1",
          opportunityId: "opportunity:reconcile",
          evidence: createRealCompanyPilotFixture().economicEvidence,
        },
        approvedActions: [{ ...approval("question:foreign"), tenantId: "other-tenant" }],
      }),
    ).rejects.toThrow("outside the pilot tenant/company");
    expect(approvals).toBe(0);
  });
});

function approval(actionId: string): ApproveDiscoveryActionCommand {
  return {
    tenantId,
    companyId,
    brainRunId: "pilot-scenario",
    actionId,
    approvedBy: "operator",
  };
}
