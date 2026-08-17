import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PatronDecisionCenterPresenter,
  ProductionExecutiveDecisionViewBuilder,
  type ExecutiveDecisionView,
} from "../index";
import type { ExecutiveAuditResult } from "../../executive-results/application/executive-result-model";
import { PatronDecisionCenterView } from "./patron-decision-center-view";

describe("PatronDecisionCenterView", () => {
  it("renders the Northstar executive acceptance view without internal jargon", () => {
    const html = renderToStaticMarkup(
      <PatronDecisionCenterView center={PatronDecisionCenterPresenter.build(northstarView())} />,
    );

    expect(html).toContain("Approval queue / exception approval");
    expect(html).toContain("Stale approval master data");
    expect(html).toContain("Mandatory exception approval");
    expect(html).toContain("Manual reconciliation");
    expect(html).toContain("Economically justified");
    expect(html).toContain("Approval threshold remains uncertain");
    expect(html).toContain("Remediate stale ERP approval data");
    expect(html).toContain("What we know");
    expect(html).toContain("What we believe");
    expect(html).toContain("What we don&#x27;t know");
    expect(html).toContain("Why?");
    expect(html).toContain("Ask AutomateX");
    expect(html).toContain("What would change this decision?");
    expect(html).not.toContain("BrainIntegrationPipeline");
    expect(html).not.toContain("InformationGapDetector");
    expect(html).not.toContain("ClaimType");
    expect(html).not.toContain("EVIDENCE_CONDITIONAL_DECISION");
  });

  it("renders missing economic fields as not yet available", () => {
    const html = renderToStaticMarkup(
      <PatronDecisionCenterView center={PatronDecisionCenterPresenter.build(northstarView())} />,
    );
    expect(html).toContain("Break-even");
    expect(html).toContain("Not yet available");
    expect(html).not.toContain(">0 EUR<");
  });

  it("renders decision cards with keyboard-accessible Why drill-downs", () => {
    const html = renderToStaticMarkup(
      <PatronDecisionCenterView center={PatronDecisionCenterPresenter.build(northstarView())} />,
    );
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Supporting evidence");
    expect(html).toContain("Unknowns and contradictions");
  });

  it("renders production-published executive results without the unavailable fallback", () => {
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: publishedResult(),
    });
    const html = renderToStaticMarkup(
      <PatronDecisionCenterView center={PatronDecisionCenterPresenter.build(projection.view!)} />,
    );

    expect(html).toContain("Pilot Company");
    expect(html).toContain("Invoice approval delay");
    expect(html).toContain("Manual invoice reconciliation");
    expect(html).not.toContain("decision center is not available yet");
  });
});

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
      opportunityCount: 3,
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

function publishedResult(): ExecutiveAuditResult {
  return {
    company: { id: "company-a", name: "Pilot Company" },
    complete: true,
    audit: {
      company: { id: "company-a", name: "Pilot Company" },
      overallStatus: "COMPLETED",
      currentStage: "COMPLETED",
      nextAction: "VIEW_RESULTS",
      blockingReason: null,
      stages: [
        {
          stage: "PROCESS_MAP",
          label: "Process Map",
          status: "COMPLETED",
          artifact: { id: "process-map-1", version: 1, status: "published" },
          candidateArtifacts: [],
          availableActions: [],
          blockingReason: null,
        },
      ],
    },
    overview: { processes: 1, findings: 1, opportunities: 1, recommendations: 1 },
    process: { id: "process-map-1", name: "Invoice handling" },
    findings: [
      {
        id: "finding-1",
        title: "Invoice approval delay",
        description: "Manual handoff creates waiting time before invoice processing.",
        severity: "high",
        impact: "Invoices wait before finance can reconcile them.",
      },
    ],
    opportunities: [
      {
        id: "opportunity-1",
        title: "Manual invoice reconciliation",
        problem: "Manual invoice reconciliation consumes finance capacity.",
        impact: 90,
        readiness: 85,
        confidence: 82,
      },
    ],
    roi: {
      id: "roi-1",
      currency: "EUR",
      evaluations: [
        {
          id: "roi-evaluation-1",
          title: "Invoice reconciliation ROI",
          annualBenefit: 24000,
          roi: 3.2,
          roiSpecialValue: null,
          payback: 4,
        },
      ],
    },
    recommendations: [
      {
        id: "recommendation-1",
        title: "Manual invoice reconciliation",
        action: "Approve a controlled invoice reconciliation automation design.",
        description: "Automate reconciliation after preserving approval controls.",
        priority: "high",
        phase: "Phase 1",
        expectedRoi: 3.2,
        roiSpecialValue: null,
        payback: 4,
        confidence: 82,
      },
    ],
    provenance: {
      processMapId: "process-map-1",
      analysisId: "analysis-1",
      automationOpportunitySnapshotId: "automation-snapshot-1",
      roiId: "roi-1",
      recommendationPortfolioId: "recommendation-portfolio-1",
    },
  };
}
