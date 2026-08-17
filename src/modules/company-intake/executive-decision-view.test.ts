import { describe, expect, it } from "vitest";
import {
  Contradiction,
  ReasoningTrace,
  UnknownInformation,
} from "../../brain-evaluation/brain-contracts";
import { ExecutiveDecisionViewBuilder } from "./index";
import type { ExecutiveAuditResult } from "../executive-results/application/executive-result-model";
import type { RealCompanyAuditPilotResult } from "./application/real-company-audit-pilot";
import type { RealCompanyBrainResult } from "./application/real-company-brain-orchestrator";

const trace = ReasoningTrace.create(
  { "process-1": "Process observation", "opportunity:reconcile": "Reconciliation opportunity" },
  [
    {
      fromId: "process-1",
      toId: "opportunity:reconcile",
      relationship: "supports",
      rationale: "Observed delay supports the opportunity",
    },
  ],
);

describe("ExecutiveDecisionViewBuilder", () => {
  it("projects the Northstar pilot into patron-facing executive sections", () => {
    const view = new ExecutiveDecisionViewBuilder().build({
      pilot: pilotResult(),
      executiveResult: executiveResult(),
    });
    expect(view.auditSummary.economicState).toBe("ECONOMICALLY_JUSTIFIED");
    expect(view.topProblems).toContain("Exception approval");
    expect(view.whatWeKnow).toEqual(["Order volume is source-backed by ERP"]);
    expect(view.whatWeBelieve).toEqual(["Manager believes approval policy changed"]);
    expect(view.whatWeDoNotKnow).toEqual(["approval threshold evidence"]);
    expect(view.contradictions).toEqual(["Approval policy may be stale"]);
    expect(view.rootCausesOrHypotheses).toContain("Approval queue is the primary delay driver");
    expect(view.bottlenecks).toContain(
      "Approval queue waits two hours before finance can continue",
    );
    expect(view.nextBestActions).toContain("Remediate stale ERP approval data");
  });

  it("maps production and Brain states to executive decision cards without raw engine ownership", () => {
    const view = new ExecutiveDecisionViewBuilder().build({
      pilot: pilotResult(),
      executiveResult: executiveResult(),
    });
    expect(view.priorityCards.map((card) => card.recommendationState)).toEqual(
      expect.arrayContaining([
        "HUMAN_DECISION_REQUIRED",
        "AUTOMATE_NOW",
        "FIX_BEFORE_AUTOMATING",
        "DO_NOT_AUTOMATE",
      ]),
    );
    expect(view.ownership).toEqual({
      kind: "PRESENTATION_PROJECTION",
      persistedArtifactOwner: "ExecutiveResultService/ReportService",
      usesExistingExecutiveResult: true,
      usesExistingReport: false,
      createsLifecycle: false,
    });
  });

  it("keeps do-not-automate and remediation first-class with concrete next actions", () => {
    const view = new ExecutiveDecisionViewBuilder().build({ pilot: pilotResult() });
    const doNotAutomate = view.priorityCards.find(
      (card) => card.recommendationState === "DO_NOT_AUTOMATE",
    );
    const remediation = view.priorityCards.find(
      (card) => card.recommendationState === "FIX_BEFORE_AUTOMATING",
    );
    expect(doNotAutomate?.whatToDoNow).toBe("Do not automate this item.");
    expect(doNotAutomate?.whatNotToDo).toBe("Do not remove the required human control.");
    expect(remediation?.whatToDoNow).toBe(
      "Fix the process or data prerequisite before automation.",
    );
    expect(remediation?.nextBestAction).toBe("Fix stale approval master data before automation");
  });

  it("explains evidence, conflicts and missing evidence without orphan statements", () => {
    const view = new ExecutiveDecisionViewBuilder().build({ pilot: pilotResult() });
    expect(view.evidenceExplanation.supportingSources).toEqual(
      expect.arrayContaining(["finance-1", "process-1", "sop-1", "system-1"]),
    );
    expect(view.evidenceExplanation.conflictingSources).toEqual(
      expect.arrayContaining(["interview-manager", "sop-1"]),
    );
    expect(view.evidenceExplanation.missingEvidence).toContain("approval threshold evidence");
    expect(view.priorityCards.every((card) => card.evidenceReferences.length > 0)).toBe(true);
    expect(
      view.priorityCards.every((card) => card.traceability.companyId === "pilot-company"),
    ).toBe(true);
  });

  it("does not manufacture friendly economic values when report values are unavailable", () => {
    const view = new ExecutiveDecisionViewBuilder().build({ pilot: pilotResult() });
    expect(view.economicPresentation.state).toBe("ECONOMICALLY_JUSTIFIED");
    expect(view.economicPresentation.breakEvenMonths).toBeNull();
    expect(view.economicPresentation.timeToValueMonths).toBeNull();
    expect(view.economicPresentation.currency).toBe("EUR");
    expect(view.economicPresentation.costRange).toEqual({ min: 12000, max: 12000 });
    expect(view.economicPresentation.benefitRange.max).toBe(7800);
  });

  it("answers the executive completeness checklist", () => {
    const view = new ExecutiveDecisionViewBuilder().build({
      pilot: pilotResult(),
      executiveResult: executiveResult(),
    });
    expect(view.completeness).toMatchObject({
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
    });
  });
});

function pilotResult(): RealCompanyAuditPilotResult {
  const brain = brainResult();
  return {
    initialBrainResult: brain,
    finalBrainResult: brain,
    initialLoop: { loop: { stoppingState: "CONTINUE_DISCOVERY" } } as never,
    finalLoop: { loop: { stoppingState: "READY_WITH_DECLARED_UNCERTAINTY" } } as never,
    economic: {
      state: "QUALIFIED",
      values: [
        value("finance-1", "TRANSACTION_VOLUME", 7800, "transactions/month"),
        value("finance-1", "TASK_DURATION", 20, "minutes"),
        value("finance-1", "LABOR_COST", 35, "EUR/hour", "EUR"),
        value("finance-1", "IMPLEMENTATION_COST", 12000, "EUR", "EUR"),
      ],
      gaps: [],
      currencies: ["EUR"],
    } as never,
    product: {
      topProblems: [
        "Exception approval",
        "Approval queue waits two hours before finance can continue",
      ],
      whatWeKnow: ["Order volume is source-backed by ERP"],
      whatWeBelieve: ["Manager believes approval policy changed"],
      whatWeDoNotKnow: ["approval threshold evidence"],
      contradictions: ["Approval policy may be stale"],
      rootCausesHypotheses: ["Approval queue is the primary delay driver"],
      bottlenecks: ["Approval queue waits two hours before finance can continue"],
      criticalIssues: ["Exception approval"],
      whatToFixFirst: ["Fix stale approval master data before automation", "Exception approval"],
      whatNotToAutomate: ["Keep mandatory exception approval human-controlled"],
      whatCanBeAutomated: ["Manual reconciliation consumes finance capacity"],
      whatNeedsMoreEvidence: ["approval threshold evidence"],
      economicReadiness: "QUALIFIED",
      nextBestActions: ["Remediate stale ERP approval data", "Qualify reconciliation automation"],
    },
    executiveUsefulness: { status: "YES" } as never,
    traceability: {
      evidence: ["sop-1", "system-1", "process-1", "finance-1"],
      claims: ["claim:sop", "claim:manager"],
      processMap: ["process-map-1"],
      economic: ["finance-1"],
      opportunity: [
        "opportunity:reconcile",
        "opportunity:data-quality",
        "opportunity:human-approval",
      ],
    },
    safety: {
      groundTruthLeaks: 0,
      crossCompanyLeakage: 0,
      factAutoPromotion: 0,
      unsafeRecommendations: 0,
      humanControlViolations: 0,
    },
  };
}

function brainResult(): RealCompanyBrainResult {
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
  const qualified = opportunity(
    "opportunity:reconcile",
    "Payment reconciliation",
    "Manual reconciliation consumes finance capacity",
    "AUTOMATION",
    "QUALIFIED",
    ["finance-1"],
  );
  const remediation = opportunity(
    "opportunity:data-quality",
    "ERP data quality",
    "Fix stale approval master data before automation",
    "DATA_QUALITY",
    "REMEDIATION_REQUIRED",
    ["system-1"],
  );
  const doNot = opportunity(
    "opportunity:human-approval",
    "Exception approval",
    "Keep mandatory exception approval human-controlled",
    "DO_NOT_AUTOMATE",
    "REJECTED",
    ["sop-1"],
  );
  return {
    companyId: "pilot-company",
    tenantId: "pilot-tenant",
    readiness: { status: "READY_FOR_BRAIN" } as never,
    sourceSnapshot: { companyId: "pilot-company", knowledgeSnapshotId: "knowledge-1" },
    evidence: { count: 4, ids: ["sop-1", "system-1", "process-1", "finance-1"] },
    brainEvidence: [{ evidenceId: "process-1" }],
    claims: [
      { claimId: "claim:sop", kind: "INFERENCE", statement: "SOP approval threshold is stale" },
      {
        claimId: "claim:manager",
        kind: "BELIEF",
        statement: "Manager believes approval policy changed",
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
    detectedOpportunities: [qualified, remediation, doNot],
    qualifiedOpportunities: [qualified],
    deferredOpportunities: [],
    rejectedOpportunities: [doNot],
    remediationRequired: [remediation],
    economicState: { status: "QUALIFIED" } as never,
    nextBestActions: ["Remediate stale ERP approval data", "Qualify reconciliation automation"],
    traceReferences: {
      evidence: ["sop-1", "system-1", "process-1", "finance-1"],
      claims: ["claim:sop", "claim:manager"],
      processMap: ["process-map-1"],
    },
    brain: { scenarioId: "pilot-scenario" } as never,
  } as unknown as RealCompanyBrainResult;
}

function opportunity(
  opportunityId: string,
  subject: string,
  problemStatement: string,
  candidateType: string,
  status: string,
  supportingEvidenceIds: readonly string[],
) {
  return {
    opportunityId,
    subject,
    problemStatement,
    candidateType,
    status,
    confidence: 0.8,
    supportingEvidenceIds,
    trace,
  };
}

function value(
  evidenceId: string,
  concept: string,
  amount: number,
  unit: string,
  currency?: string,
) {
  return {
    evidenceId,
    concept,
    value: amount,
    unit,
    currency,
  };
}

function executiveResult(): ExecutiveAuditResult {
  return {
    company: { id: "pilot-company", name: "Northstar Operations" },
    complete: true,
    audit: {} as never,
    overview: { processes: 1, findings: 3, opportunities: 3, recommendations: 1 },
    process: { id: "process-map-1", name: "Order fulfilment" },
    findings: [],
    opportunities: [],
    roi: null,
    recommendations: [],
    provenance: {
      processMapId: "process-map-1",
      analysisId: "analysis-1",
      automationOpportunitySnapshotId: "automation-snapshot-1",
      roiId: "roi-1",
      recommendationPortfolioId: "recommendations-1",
    },
  };
}
