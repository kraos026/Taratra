import { describe, expect, it } from "vitest";
import { ClosedLoopDiscoveryOrchestrator } from "./index";
import type { AdaptiveDiscoveryPlan } from "./application/adaptive-discovery-production-bridge";
import type { RealCompanyBrainResult } from "./application/real-company-brain-orchestrator";

const brain = (scenarioId = "brain:1"): RealCompanyBrainResult =>
  ({
    companyId: "company-a",
    tenantId: "tenant-a",
    readiness: {} as never,
    sourceSnapshot: { companyId: "company-a" },
    evidence: { count: 0, ids: [] },
    brainEvidence: [],
    claims: [],
    whatWeKnow: [],
    whatWeBelieve: [],
    whatWeDoNotKnow: [],
    contradictions: [],
    processFindings: [],
    rootCauseHypotheses: [],
    bottlenecks: [],
    criticalIssues: [],
    detectedOpportunities: [],
    qualifiedOpportunities: [],
    deferredOpportunities: [],
    rejectedOpportunities: [],
    remediationRequired: [],
    economicState: {} as never,
    nextBestActions: [],
    traceReferences: {},
    brain: { scenarioId },
  }) as unknown as RealCompanyBrainResult;

const action = {
  questionId: "question:1",
  targetSource: "MANAGER_INTERVIEW" as const,
  questionIntent: {
    gapId: "gap:1",
    targetSource: "MANAGER_INTERVIEW" as const,
    businessConcept: "approval delay",
    reason: "contradiction",
    expectedEvidenceType: "INTERVIEW" as const,
    materiality: "HIGH" as const,
    decisionBlocked: true,
    traceability: {
      companyId: "company-a",
      tenantId: "tenant-a",
      unknownIds: [],
      contradictionIds: [],
      evidenceIds: [],
      affectedDecisionIds: ["decision:1"],
    },
  },
  whyThisMatters: "Resolve contradiction",
  decisionUnlocked: ["decision:1"],
  priority: "HIGH" as const,
  evidenceRequested: "INTERVIEW" as const,
  valueScore: 0.9,
};

const plan = (
  outcome: AdaptiveDiscoveryPlan["readiness"]["outcome"] = "CONTINUE_DISCOVERY",
): AdaptiveDiscoveryPlan => ({
  companyId: "company-a",
  tenantId: "tenant-a",
  brainRunReference: "brain:1",
  contextReferences: {},
  materialGaps: [
    {
      gapId: "gap:1",
      subject: "approval",
      domain: "process",
      description: "contradiction",
      reasonMissing: "contradiction",
      affectedClaimIds: [],
      affectedDecisionIds: ["decision:1"],
      affectedTargets: ["decision"],
      materiality: "HIGH",
      urgency: "HIGH",
      confidenceImpact: 0.8,
      requiredEvidenceType: "INTERVIEW",
      preferredSourceType: "manager",
      candidateRespondentRole: "manager",
      resolutionStatus: "OPEN",
    },
  ],
  recommendedActions: outcome === "READY_FOR_ANALYSIS" ? [] : [action],
  stoppingReason: outcome,
  readiness: { outcome, rationale: outcome, blockingGapIds: [], declaredUncertaintyGapIds: [] },
  remainingQuestionBudget: outcome === "READY_FOR_ANALYSIS" ? 10 : 3,
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    discovery: { plan: async () => plan() },
    writes: {
      approve: async () => ({ status: "EXECUTED" as const }),
      reject: async () => ({ status: "REJECTED" as const }),
    },
    responses: {
      process: async () => {
        throw new Error("not used");
      },
    },
    ...overrides,
  };
}

describe("ClosedLoopDiscoveryOrchestrator", () => {
  it("starts with proposed actions and never auto-writes", async () => {
    let writes = 0;
    const result = await new ClosedLoopDiscoveryOrchestrator(
      dependencies({
        writes: {
          approve: async () => {
            writes += 1;
            return { status: "EXECUTED" as const };
          },
          reject: async () => ({ status: "REJECTED" as const }),
        },
      }),
    ).start({ loopId: "loop:1", result: brain() });
    expect(result.actionsProposed).toHaveLength(1);
    expect(writes).toBe(0);
    expect(result.loop.stoppingState).toBe("CONTINUE_DISCOVERY");
  });

  it("requires approval and remembers rejection", async () => {
    const orchestrator = new ClosedLoopDiscoveryOrchestrator(dependencies());
    await orchestrator.start({ loopId: "loop:2", result: brain() });
    const rejected = await orchestrator.reject("loop:2", {
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain:1",
      actionId: "question:1",
      rejectedBy: "user",
      reasonCode: "ALREADY_KNOWN",
    });
    expect(rejected.actionsRejected).toEqual(["question:1"]);
    expect(rejected.actionsProposed).toHaveLength(0);
  });

  it("stops immediately when analysis is ready", async () => {
    const ready = new ClosedLoopDiscoveryOrchestrator({
      ...dependencies(),
      discovery: { plan: async () => plan("READY_FOR_ANALYSIS") },
    });
    const result = await ready.start({ loopId: "loop:3", result: brain() });
    expect(result.loop.status).toBe("STOPPED");
    expect(result.actionsProposed).toHaveLength(0);
    expect(result.loop.stoppingState).toBe("READY_FOR_ANALYSIS");
  });
});
