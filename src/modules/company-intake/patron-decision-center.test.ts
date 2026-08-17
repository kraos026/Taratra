import { describe, expect, it } from "vitest";
import {
  ExecutiveExplanationService,
  PatronDecisionCenterPresenter,
  PatronDecisionCenterService,
  unavailablePatronDecisionCenter,
  type ExecutiveDecisionView,
  type ExecutiveExplanationProvider,
  type PatronDecisionCenterReadModelPort,
} from "./index";

describe("PatronDecisionCenterPresenter", () => {
  it("projects the overview from ExecutiveDecisionView without recalculating decisions", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.overview.topProblemsCount).toBe(2);
    expect(center.overview.automationReadyCount).toBe(1);
    expect(center.overview.fixBeforeAutomationCount).toBe(1);
    expect(center.overview.doNotAutomateCount).toBe(1);
    expect(center.overview.needsMoreEvidenceCount).toBe(1);
    expect(center.overview.economicReadiness).toBe("ECONOMICALLY_JUSTIFIED");
    expect(center.priorityCards.map((card) => card.decisionState)).toEqual(
      northstarView().priorityCards.map((card) => card.recommendationState),
    );
  });

  it("keeps fix-before-automating as a first-class section", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.fixBeforeAutomating).toHaveLength(1);
    expect(center.fixBeforeAutomating[0]?.title).toBe("Approval master data");
    expect(center.fixBeforeAutomating[0]?.whatToDoNow).toContain("Fix");
  });

  it("keeps do-not-automate decisions visible", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.doNotAutomate).toHaveLength(1);
    expect(center.doNotAutomate[0]?.title).toBe("Mandatory exception approval");
    expect(center.doNotAutomate[0]?.whatNotToDo).toContain("human control");
  });

  it("only shows qualified automation opportunities as automation-ready", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.automationOpportunities).toHaveLength(1);
    expect(center.automationOpportunities[0]?.title).toBe("Manual reconciliation");
    expect(center.automationOpportunities[0]?.decisionState).toBe("AUTOMATE_NOW");
  });

  it("preserves know, believe and unknown as separate executive concepts", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.knowledge.whatWeKnow).toContain("ERP order export confirms approval queues.");
    expect(center.knowledge.whatWeBelieve).toContain(
      "Management believes the approval threshold recently changed.",
    );
    expect(center.knowledge.whatWeDoNotKnow).toContain("Approval threshold remains uncertain.");
  });

  it("keeps material contradictions visible", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.evidence.contradictions).toContain(
      "Management estimate conflicts with stale ERP approval policy.",
    );
    expect(center.overview.uncertaintyIndicator).toBe("MATERIAL");
  });

  it("shows economics as unavailable instead of fabricated when values are missing", () => {
    const center = PatronDecisionCenterPresenter.build({
      ...northstarView(),
      economicPresentation: {
        ...northstarView().economicPresentation,
        benefitRange: { min: null, max: null },
        costRange: { min: null, max: null },
        breakEvenMonths: null,
        timeToValueMonths: null,
        costOfInaction: null,
      },
    });
    expect(center.economics.benefitRange).toEqual([null, null]);
    expect(center.economics.breakEvenMonths).toBeNull();
    expect(center.economics.timeToValueMonths).toBeNull();
  });

  it("derives next action categories from existing action labels only", () => {
    const center = PatronDecisionCenterPresenter.build(northstarView());
    expect(center.nextActions[0]).toEqual({
      label: "Remediate stale ERP approval data",
      category: "IMPORT_SYSTEM_DATA",
    });
  });

  it("supports deterministic explanation fallback when AI is unavailable", async () => {
    const service = new ExecutiveExplanationService(failingProvider());
    const map = new Map([
      [
        "approval-master-data",
        await service.explain({
          view: northstarView(),
          cardId: "approval-master-data",
        }),
      ],
    ]);
    const center = PatronDecisionCenterPresenter.build(northstarView(), map);
    expect(center.priorityCards[0]?.explanation?.source).toBe("FALLBACK");
    expect(center.executiveSummary).toContain("Fix stale approval master data");
  });

  it("creates a truthful unavailable state when no authoritative decision view exists", () => {
    const center = unavailablePatronDecisionCenter("company-1", "Pilot Company");
    expect(center.status).toBe("UNAVAILABLE");
    expect(center.sourceView).toBeNull();
    expect(center.executiveSummary).toContain("will not invent executive decisions");
  });
});

describe("PatronDecisionCenterService", () => {
  it("hard rejects read models returned for another company", async () => {
    const readModel: PatronDecisionCenterReadModelPort = {
      read: async () => northstarView(),
    };
    const service = new PatronDecisionCenterService(readModel);
    await expect(service.get({ userId: "user-1", companyId: "other-company" })).rejects.toThrow(
      "does not belong",
    );
  });

  it("returns unavailable when the authoritative read model is absent", async () => {
    const readModel: PatronDecisionCenterReadModelPort = {
      read: async () => null,
    };
    const center = await new PatronDecisionCenterService(readModel).get({
      userId: "user-1",
      companyId: "company-1",
    });
    expect(center.status).toBe("UNAVAILABLE");
  });
});

function failingProvider(): ExecutiveExplanationProvider {
  return {
    explain: async () => {
      throw new Error("provider unavailable");
    },
  };
}

function northstarView(): ExecutiveDecisionView {
  const traceability = {
    companyId: "northstar-company",
    tenantId: "northstar-tenant",
    brainRunId: "northstar-run",
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
    company: { id: "northstar-company", tenantId: "northstar-tenant" },
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
      opportunityCount: 4,
      economicState: "ECONOMICALLY_JUSTIFIED",
    },
    topProblems: ["Approval queue / exception approval", "Stale approval master data"],
    whatWeKnow: ["ERP order export confirms approval queues."],
    whatWeBelieve: ["Management believes the approval threshold recently changed."],
    whatWeDoNotKnow: ["Approval threshold remains uncertain."],
    contradictions: ["Management estimate conflicts with stale ERP approval policy."],
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
      {
        id: "approval-master-data",
        title: "Approval master data",
        executiveSummary: "Fix stale approval master data before automation.",
        priority: "HIGH",
        businessImpact: "Automation would amplify stale routing and approval thresholds.",
        evidenceStrength: "MODERATE",
        uncertainty: ["Approval threshold remains uncertain."],
        problem: "Stale approval master data blocks safe automation.",
        probableCause: "Approval queue is the primary delay driver.",
        recommendationState: "FIX_BEFORE_AUTOMATING",
        economicState: "ECONOMICALLY_JUSTIFIED",
        whyItMatters: "Automation would amplify stale routing and approval thresholds.",
        whatToDoNow: "Fix stale approval master data before automation.",
        whatNotToDo: "Do not automate before remediation.",
        nextBestAction: "Remediate stale ERP approval data",
        evidenceReferences: ["erp-export", "approval-sop"],
        explanation,
        traceability,
      },
      {
        id: "mandatory-exception-approval",
        title: "Mandatory exception approval",
        executiveSummary: "Keep mandatory exception approval human-controlled.",
        priority: "HIGH",
        businessImpact: "This is a control decision, not an automation shortcut.",
        evidenceStrength: "MODERATE",
        uncertainty: ["Approval threshold remains uncertain."],
        problem: "Mandatory exception approval is a human control.",
        probableCause: "Approval queue is the primary delay driver.",
        recommendationState: "DO_NOT_AUTOMATE",
        economicState: "ECONOMICALLY_JUSTIFIED",
        whyItMatters: "This is a control decision, not an automation shortcut.",
        whatToDoNow: "Keep mandatory exception approval human-controlled.",
        whatNotToDo: "Do not remove the required human control.",
        nextBestAction: "Remediate stale ERP approval data",
        evidenceReferences: ["approval-sop"],
        explanation,
        traceability,
      },
      {
        id: "manual-reconciliation",
        title: "Manual reconciliation",
        executiveSummary: "Manual reconciliation can be automated after controls are preserved.",
        priority: "HIGH",
        businessImpact: "Source-backed economics support action.",
        evidenceStrength: "STRONG",
        uncertainty: [],
        problem: "Manual reconciliation consumes finance capacity.",
        probableCause: "Approval queue is the primary delay driver.",
        recommendationState: "AUTOMATE_NOW",
        economicState: "ECONOMICALLY_JUSTIFIED",
        whyItMatters: "Source-backed economics support action.",
        whatToDoNow: "Approve a controlled automation design.",
        whatNotToDo: null,
        nextBestAction: "Remediate stale ERP approval data",
        evidenceReferences: ["erp-export", "finance-file", "process-map-approval"],
        explanation,
        traceability,
      },
      {
        id: "approval-threshold",
        title: "Approval threshold",
        executiveSummary: "More evidence is needed before changing approval thresholds.",
        priority: "MEDIUM",
        businessImpact: "More evidence is required before a confident economic decision.",
        evidenceStrength: "LIMITED",
        uncertainty: ["Approval threshold remains uncertain."],
        problem: "Approval threshold is not confirmed.",
        probableCause: "Policy evidence may be stale.",
        recommendationState: "NEEDS_MORE_EVIDENCE",
        economicState: "ECONOMICALLY_JUSTIFIED",
        whyItMatters: "More evidence is required before a confident economic decision.",
        whatToDoNow: "Provide the missing evidence.",
        whatNotToDo: "Do not manufacture missing ROI or process facts.",
        nextBestAction: "Upload current approval policy",
        evidenceReferences: ["manager-interview"],
        explanation,
        traceability,
      },
    ],
    nextBestActions: ["Remediate stale ERP approval data", "Upload current approval policy"],
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
