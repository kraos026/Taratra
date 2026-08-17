import { describe, expect, it } from "vitest";
import {
  AskAutomateXService,
  type ExecutiveDecisionView,
  type StrategyComparisonReadModel,
} from "./index";
import type {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "../../brain-evaluation/ai-interpretation-gateway";

const tenantId = "northstar-tenant";
const companyId = "northstar-company";

describe("AskAutomateXService", () => {
  it("explains why mandatory exception approval should not be fully automated", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "Why shouldn't we automate exception approval?",
      context: { decisionCardId: "mandatory-exception-approval" },
    });
    expect(response.answerStatus).toBe("ANSWERED_WITH_UNCERTAINTY");
    expect(response.authoritativeDecisionState).toBe("DO_NOT_AUTOMATE");
    expect(response.answer).toContain("Do not remove the required human control");
    expect(response.answer).toContain("We still do not know");
    expect(response.answer).toContain("What would change the decision");
    expect(response.traceability.decisionRefs).toEqual(["mandatory-exception-approval"]);
  });

  it("answers what can be automated while preserving economic qualification", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "What can we automate?",
      context: { decisionCardId: "manual-reconciliation" },
    });
    expect(response.authoritativeDecisionState).toBe("AUTOMATE_NOW");
    expect(response.answer).toContain("Source-backed economics support action");
    expect(response.economicState).toBe("ECONOMICALLY_JUSTIFIED");
  });

  it("returns specific existing conditions for what would change the decision", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "What would change your mind?",
      context: { decisionCardId: "mandatory-exception-approval" },
    });
    expect(response.whatWouldChangeDecision).toContain("Approval threshold remains uncertain.");
    expect(response.whatWouldChangeDecision).toContain("Approval threshold policy evidence");
    expect(response.whatWouldChangeDecision.join(" ")).not.toContain("below X");
  });

  it("shows patron-friendly evidence references", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "Show me the evidence.",
      context: { decisionCardId: "manual-reconciliation" },
    });
    expect(response.supportingEvidence.map((item) => item.label)).toEqual([
      "ERP order export",
      "Finance cost file",
      "Operations SOP",
    ]);
    expect(response.answer).toContain("ERP order export");
    expect(response.answer).not.toContain("BrainIntegrationPipeline");
  });

  it("does not invent ROI when exact ROI does not exist", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "What's the ROI?",
      context: { decisionCardId: "manual-reconciliation" },
    });
    expect(response.answer).toContain("Economic state: ECONOMICALLY_JUSTIFIED");
    expect(response.answer).toContain("Benefit range");
    expect(response.answer).not.toContain("3.2x");
    expect(response.validation.valid).toBe(true);
  });

  it("shows only retained or conditionally valid strategy candidates", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "What other ways can we solve this?",
    });
    expect(response.relevantStrategies.map((strategy) => strategy.title)).toContain(
      "Fix approval master data",
    );
    expect(response.relevantStrategies.map((strategy) => strategy.title)).not.toContain(
      "Auto-approve exceptions",
    );
  });

  it("answers contradictions with uncertainty instead of choosing a winner", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "Are we sure approvals take two hours?",
    });
    expect(response.answerStatus).toBe("ANSWERED_WITH_UNCERTAINTY");
    expect(response.contradictions).toContain(
      "Management estimate says two hours; ERP export shows materially lower median.",
    );
    expect(response.answer).toContain("Contradictions");
  });

  it("uses the latest authoritative Brain run instead of stale conversational narrative", async () => {
    const first = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "Why?",
      context: { decisionCardId: "approval-master-data" },
    });
    expect(first.traceability.brainRunId).toBe("brain-run-a");
    const second = await service("brain-run-b").ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "Has anything changed?",
      context: { previousIntent: first.intent, previousBrainRunId: "brain-run-a" },
    });
    expect(second.traceability.brainRunId).toBe("brain-run-b");
    expect(second.answer).toContain("new evidence changed approval queue confidence");
  });

  it("hard rejects cross-company card context", async () => {
    await expect(
      service().ask({
        tenantId,
        companyId,
        userId: "user:1",
        question: "Why?",
        context: { decisionCardId: "foreign-card" },
      }),
    ).rejects.toThrow("outside the authorized company context");
  });

  it("returns out-of-scope instead of becoming a generic chatbot", async () => {
    const response = await service().ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "Who won the World Cup?",
    });
    expect(response.answerStatus).toBe("OUT_OF_SCOPE");
    expect(response.answer).toContain("only questions about this company audit");
  });

  it("falls back when provider rendering invents unsupported economics", async () => {
    const response = await service("brain-run-a", badProvider()).ask({
      tenantId,
      companyId,
      userId: "user:1",
      question: "What's the ROI?",
      context: { decisionCardId: "manual-reconciliation" },
    });
    expect(response.answerStatus).toBe("PROVIDER_FALLBACK");
    expect(response.providerMetadata).toBeNull();
    expect(response.answer).not.toContain("3.2x");
  });
});

function service(brainRunId = "brain-run-a", provider?: AIProvider) {
  return new AskAutomateXService(
    {
      read: async ({ tenantId: requestedTenant, companyId: requestedCompany }) => {
        if (requestedTenant !== tenantId || requestedCompany !== companyId) return null;
        return { view: northstarView(brainRunId), strategies: strategies() };
      },
    },
    provider,
  );
}

function badProvider(): AIProvider {
  return {
    providerId: "bad-fixture",
    interpret: async (request: AIInterpretationRequest): Promise<AIInterpretationResult> =>
      Object.freeze({
        requestId: request.requestId,
        provider: "bad-fixture",
        model: "bad-model",
        task: request.task,
        schemaVersion: request.schemaVersion,
        candidates: Object.freeze([
          {
            candidateId: "candidate:bad",
            candidateType: "SUMMARY" as const,
            statement: "This has a guaranteed 3.2x ROI and payback in 2 months.",
            sourceReference: `${request.sourceId}:1`,
            sourceExcerpt: request.sourceText.slice(0, 50),
            confidenceHint: 0.9,
            rationale: "bad fixture",
            knowledgeReferences: [],
            status: "AI_DERIVED" as const,
            review: "REQUIRED" as const,
          },
        ]),
        sourceReferences: Object.freeze([request.sourceId]),
        warnings: Object.freeze([]),
        validationIssues: Object.freeze([]),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
  };
}

function strategies(): StrategyComparisonReadModel {
  return {
    problem: "approval queue delay",
    strategies: [
      strategy(
        "strategy:data",
        "DATA_REMEDIATION",
        "Fix approval master data",
        "RETAIN_FOR_COMPARISON",
      ),
      strategy(
        "strategy:hitl",
        "HUMAN_IN_THE_LOOP_AUTOMATION",
        "Route exceptions with human approval",
        "RETAIN_FOR_COMPARISON",
      ),
      strategy(
        "strategy:api",
        "API_INTEGRATION",
        "API workflow after remediation",
        "NEEDS_MORE_EVIDENCE",
      ),
      strategy(
        "strategy:bad",
        "LOW_CODE_AUTOMATION",
        "Auto-approve exceptions",
        "CONTROL_CONFLICT",
      ),
    ],
    dependencies: [],
    aiScoreUsed: false,
    blueprintPublicationCount: 0,
    specificationPublicationCount: 0,
    aiRecommendationAuthorityCount: 0,
  };
}

function strategy(
  candidateId: string,
  family: StrategyComparisonReadModel["strategies"][number]["strategyFamily"],
  title: string,
  status: StrategyComparisonReadModel["strategies"][number]["status"],
) {
  return {
    candidateId,
    strategyFamily: family,
    title,
    fitRationale: `${title} fits the current evidence state.`,
    evidenceState: "SUPPORTED" as const,
    prerequisites:
      candidateId === "strategy:api"
        ? ["Approval threshold policy evidence"]
        : ["Existing evidence"],
    riskControlCompatibility:
      status === "CONTROL_CONFLICT" ? ("CONFLICT" as const) : ("COMPATIBLE" as const),
    economicState: "ECONOMICALLY_JUSTIFIED" as const,
    unknowns: candidateId === "strategy:api" ? ["API capability evidence"] : [],
    status,
    discoveryTargets: [],
  };
}

function northstarView(brainRunId: string): ExecutiveDecisionView {
  const traceability = {
    companyId,
    tenantId,
    brainRunId,
    knowledgeSnapshotId: "knowledge-snapshot",
    processMapIds: ["process-map-approval"],
    evidenceIds: ["erp-export", "manager-interview", "approval-sop", "finance-file"],
    claimIds: ["claim-approval-queue", "claim-threshold"],
    opportunityIds: ["manual-reconciliation"],
    economicEvidenceIds: ["finance-file"],
    executiveResultArtifactIds: {
      processMapId: "process-map-approval",
      analysisId: "analysis-approval",
    },
  };
  const explanation = {
    supportingSources: ["ERP order export", "Finance cost file", "Operations SOP"],
    conflictingSources: ["Manager interview", "Approval SOP"],
    missingEvidence: ["Approval threshold remains uncertain."],
  };
  return {
    company: { id: companyId, tenantId },
    ownership: {
      kind: "PRESENTATION_PROJECTION",
      persistedArtifactOwner: "ExecutiveResultService/ReportService",
      usesExistingExecutiveResult: true,
      usesExistingReport: true,
      createsLifecycle: false,
    },
    auditSummary: {
      status: "READY",
      loopStatus: "READY_WITH_DECLARED_UNCERTAINTY",
      topProblemCount: 2,
      opportunityCount: 3,
      economicState: "ECONOMICALLY_JUSTIFIED",
    },
    topProblems: ["Approval queue / exception approval", "Stale approval master data"],
    whatWeKnow: [
      "ERP order export confirms approval queues.",
      brainRunId === "brain-run-b"
        ? "new evidence changed approval queue confidence."
        : "Finance file confirms manual reconciliation effort.",
    ],
    whatWeBelieve: ["Management believes the approval threshold recently changed."],
    whatWeDoNotKnow: ["Approval threshold remains uncertain."],
    contradictions: [
      "Management estimate says two hours; ERP export shows materially lower median.",
    ],
    rootCausesOrHypotheses: ["Approval queue is the primary delay driver."],
    bottlenecks: ["Exception approvals wait before finance can reconcile orders."],
    criticalIssues: ["Approval master data is stale."],
    whatToFixFirst: ["Stale approval master data"],
    whatNotToAutomate: ["Mandatory exception approval"],
    whatCanBeAutomated: ["Manual reconciliation"],
    whatRequiresMoreEvidence: ["Approval threshold remains uncertain."],
    economicReadiness: "ECONOMICALLY_JUSTIFIED",
    economicPresentation: {
      state: "ECONOMICALLY_JUSTIFIED",
      benefitRange: { min: 7000, max: 9000 },
      costRange: { min: 2000, max: 4000 },
      breakEvenMonths: null,
      timeToValueMonths: null,
      costOfInaction: 9000,
      currency: "EUR",
      missingEvidence: ["Approval threshold remains uncertain."],
    },
    priorityCards: [
      card(
        "approval-master-data",
        "Approval master data",
        "FIX_BEFORE_AUTOMATING",
        explanation,
        traceability,
      ),
      card(
        "mandatory-exception-approval",
        "Mandatory exception approval",
        "DO_NOT_AUTOMATE",
        explanation,
        traceability,
      ),
      card(
        "manual-reconciliation",
        "Manual reconciliation",
        "AUTOMATE_NOW",
        explanation,
        traceability,
      ),
    ],
    nextBestActions: ["Remediate stale ERP approval data"],
    evidenceExplanation: explanation,
    traceability,
    completeness: {
      status: "YES",
      whatIsWrong: true,
      why: true,
      evidence: true,
      uncertainty: true,
      whatToFix: true,
      whatNotToAutomate: true,
      whatToAutomate: true,
      economicStatus: true,
      nextAction: true,
    },
  };
}

function card(
  id: string,
  title: string,
  state: ExecutiveDecisionView["priorityCards"][number]["recommendationState"],
  explanation: ExecutiveDecisionView["evidenceExplanation"],
  traceability: ExecutiveDecisionView["traceability"],
): ExecutiveDecisionView["priorityCards"][number] {
  return {
    id,
    title,
    executiveSummary:
      state === "DO_NOT_AUTOMATE"
        ? "Keep mandatory exception approval human-controlled."
        : state === "AUTOMATE_NOW"
          ? "Manual reconciliation can be automated after controls are preserved."
          : "Fix stale approval master data before automation.",
    priority: "HIGH",
    businessImpact:
      state === "AUTOMATE_NOW"
        ? "Source-backed economics support action."
        : "This is a control and data quality decision.",
    evidenceStrength: "MODERATE",
    uncertainty: ["Approval threshold remains uncertain."],
    problem: `${title} problem`,
    probableCause: "Approval queue is the primary delay driver.",
    recommendationState: state,
    economicState: "ECONOMICALLY_JUSTIFIED",
    whyItMatters:
      state === "AUTOMATE_NOW"
        ? "Source-backed economics support action."
        : "Automation would amplify stale routing or remove a protected control.",
    whatToDoNow:
      state === "AUTOMATE_NOW"
        ? "Approve a controlled automation design."
        : "Fix stale approval master data before automation.",
    whatNotToDo:
      state === "DO_NOT_AUTOMATE"
        ? "Do not remove the required human control."
        : state === "FIX_BEFORE_AUTOMATING"
          ? "Do not automate before remediation."
          : null,
    nextBestAction: "Remediate stale ERP approval data",
    evidenceReferences: ["erp-export", "finance-file", "approval-sop"],
    explanation,
    traceability,
  };
}
