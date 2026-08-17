import { describe, expect, it } from "vitest";
import {
  ExecutiveExplanationService,
  type ExecutiveDecisionView,
  type ExecutiveExplanationDraft,
  type ExecutiveExplanationProvider,
} from "./index";

describe("ExecutiveExplanationService", () => {
  it("creates a bounded Northstar explanation without changing authoritative fields", async () => {
    const service = new ExecutiveExplanationService(
      provider({
        headline: "Fix the approval data before automation",
        executiveSummary:
          "The stale approval master data should be fixed before automation is approved.",
        whyThisMatters:
          "The approval queue delays finance work and the mandatory approval control must remain visible.",
        whyAutomateXThinksThis:
          "AutomateX sees supporting sources and a stale/current contradiction, so the magnitude remains uncertain.",
        whatWeKnow: ["Order volume is source-backed by ERP."],
        whatIsUncertain: ["The approval threshold evidence is still missing."],
        whatNotToDo: "Do not remove the human approval control.",
        recommendedNextStep: "Remediate stale ERP approval data.",
        economicExplanation:
          "Economic state: ECONOMICALLY_JUSTIFIED. Existing evidence supports direction, without inventing break-even.",
        whatWouldChangeThisDecision: "A current approval policy and clean master data.",
      }),
    );
    const explanation = await service.explain({
      view: view(),
      cardId: "opportunity:data-quality",
      language: "en",
    });
    expect(explanation.source).toBe("PROVIDER");
    expect(explanation.decisionState).toBe("FIX_BEFORE_AUTOMATING");
    expect(explanation.economicState).toBe("ECONOMICALLY_JUSTIFIED");
    expect(explanation.evidenceStrength).toBe("MODERATE");
    expect(explanation.validation.valid).toBe(true);
    expect(explanation.content.whatIsUncertain).toContain(
      "The approval threshold evidence is still missing.",
    );
    expect(explanation.brainRunId).toBe("pilot-scenario");
  });

  it("rejects a decision reversal and returns deterministic fallback", async () => {
    const service = new ExecutiveExplanationService(
      provider({
        headline: "Automate approval immediately",
        executiveSummary: "Automate the mandatory approval immediately.",
        whyThisMatters: "This will speed up the workflow.",
        whyAutomateXThinksThis: "Evidence confirms it.",
        whatWeKnow: ["Everything is known."],
        whatIsUncertain: [],
        whatNotToDo: null,
        recommendedNextStep: "Automate now.",
        economicExplanation: "Economically justified.",
      }),
    );
    const explanation = await service.explain({
      view: view(),
      cardId: "opportunity:human-approval",
    });
    expect(explanation.source).toBe("FALLBACK");
    expect(explanation.decisionState).toBe("DO_NOT_AUTOMATE");
    expect(explanation.content.whatNotToDo).toBe("Do not remove the required human control.");
  });

  it("rejects fabricated economics when deterministic inputs do not contain them", async () => {
    const service = new ExecutiveExplanationService(
      provider({
        ...validDraft(),
        economicExplanation: "ROI = 240% and break-even = 2 months.",
      }),
    );
    const explanation = await service.explain({
      view: view(),
      cardId: "opportunity:data-quality",
    });
    expect(explanation.source).toBe("FALLBACK");
    expect(explanation.validation.valid).toBe(true);
  });

  it("rejects uncertainty erasure", async () => {
    const service = new ExecutiveExplanationService(
      provider({
        ...validDraft(),
        whatIsUncertain: [],
        whyAutomateXThinksThis: "AutomateX confirms the threshold is definitely incorrect.",
      }),
    );
    const explanation = await service.explain({
      view: view(),
      cardId: "opportunity:data-quality",
    });
    expect(explanation.source).toBe("FALLBACK");
    expect(explanation.content.whatIsUncertain.join(" ")).toContain("approval threshold evidence");
  });

  it("rejects contradiction erasure", async () => {
    const service = new ExecutiveExplanationService(
      provider({
        ...validDraft(),
        executiveSummary: "Fix the approval data before automation.",
        whyAutomateXThinksThis: "Evidence confirms the approval issue.",
        whatIsUncertain: ["approval threshold evidence is missing"],
        recommendedNextStep: "Fix approval data.",
      }),
    );
    const explanation = await service.explain({
      view: view(),
      cardId: "opportunity:data-quality",
    });
    expect(explanation.source).toBe("FALLBACK");
    expect(explanation.content.whatIsUncertain.join(" ")).toContain("Approval policy may be stale");
  });

  it("supports French fallback without business mutation", async () => {
    const explanation = await new ExecutiveExplanationService().explain({
      view: view(),
      cardId: "opportunity:data-quality",
      language: "fr",
    });
    expect(explanation.source).toBe("FALLBACK");
    expect(explanation.language).toBe("fr");
    expect(explanation.decisionState).toBe("FIX_BEFORE_AUTOMATING");
    expect(explanation.providerMetadata).toBeNull();
  });
});

function provider(content: ExecutiveExplanationDraft): ExecutiveExplanationProvider {
  return {
    explain: async () => ({
      content,
      provider: "fixture-provider",
      model: "fixture-model",
    }),
  };
}

function validDraft(): ExecutiveExplanationDraft {
  return {
    headline: "Fix approval master data",
    executiveSummary:
      "Fix stale approval master data before automation because the approval threshold remains uncertain.",
    whyThisMatters: "The approval queue delays finance work.",
    whyAutomateXThinksThis:
      "Supporting sources exist, but management and SOP evidence differs and remains uncertain.",
    whatWeKnow: ["Order volume is source-backed by ERP."],
    whatIsUncertain: ["approval threshold evidence is missing", "Approval policy may be stale"],
    whatNotToDo: "Do not automate before remediation.",
    recommendedNextStep: "Remediate stale ERP approval data.",
    economicExplanation: "Economic state: ECONOMICALLY_JUSTIFIED. No break-even value is provided.",
    whatWouldChangeThisDecision: "Current approval policy evidence.",
  };
}

function view(): ExecutiveDecisionView {
  const traceability = {
    companyId: "pilot-company",
    tenantId: "pilot-tenant",
    brainRunId: "pilot-scenario",
    knowledgeSnapshotId: "knowledge-1",
    processMapIds: ["process-map-1"],
    evidenceIds: ["sop-1", "system-1", "process-1", "finance-1"],
    claimIds: ["claim:sop", "claim:manager"],
    opportunityIds: ["opportunity:data-quality", "opportunity:human-approval"],
    economicEvidenceIds: ["finance-1"],
    executiveResultArtifactIds: {},
  };
  const explanation = {
    supportingSources: ["finance-1", "process-1", "sop-1", "system-1"],
    conflictingSources: ["interview-manager", "sop-1"],
    missingEvidence: ["approval threshold evidence"],
  };
  return {
    company: { id: "pilot-company", tenantId: "pilot-tenant" },
    ownership: {
      kind: "PRESENTATION_PROJECTION",
      persistedArtifactOwner: "ExecutiveResultService/ReportService",
      usesExistingExecutiveResult: false,
      usesExistingReport: false,
      createsLifecycle: false,
    },
    auditSummary: {
      status: "READY_FOR_BRAIN",
      loopStatus: "READY_WITH_DECLARED_UNCERTAINTY",
      topProblemCount: 2,
      opportunityCount: 2,
      economicState: "ECONOMICALLY_JUSTIFIED",
    },
    topProblems: ["Exception approval"],
    whatWeKnow: ["Order volume is source-backed by ERP"],
    whatWeBelieve: ["Manager believes approval policy changed"],
    whatWeDoNotKnow: ["approval threshold evidence"],
    contradictions: ["Approval policy may be stale"],
    rootCausesOrHypotheses: ["Approval queue is the primary delay driver"],
    bottlenecks: ["Approval queue waits two hours before finance can continue"],
    criticalIssues: ["Exception approval"],
    whatToFixFirst: ["Fix stale approval master data before automation"],
    whatNotToAutomate: ["Keep mandatory exception approval human-controlled"],
    whatCanBeAutomated: ["Manual reconciliation consumes finance capacity"],
    whatRequiresMoreEvidence: ["approval threshold evidence"],
    economicReadiness: "ECONOMICALLY_JUSTIFIED",
    economicPresentation: {
      state: "ECONOMICALLY_JUSTIFIED",
      benefitRange: { min: 20, max: 7800 },
      costRange: { min: 12000, max: 12000 },
      breakEvenMonths: null,
      timeToValueMonths: null,
      costOfInaction: 7800,
      currency: "EUR",
      missingEvidence: [],
    },
    priorityCards: [
      {
        id: "opportunity:data-quality",
        title: "ERP data quality",
        executiveSummary: "Fix stale approval master data before automation.",
        priority: "HIGH",
        businessImpact: "Source-backed economics support action.",
        evidenceStrength: "MODERATE",
        uncertainty: ["approval threshold evidence", "Approval policy may be stale"],
        problem: "Fix stale approval master data before automation",
        probableCause: "Approval queue is the primary delay driver",
        recommendationState: "FIX_BEFORE_AUTOMATING",
        economicState: "ECONOMICALLY_JUSTIFIED",
        whyItMatters: "Source-backed economics support action.",
        whatToDoNow: "Fix the process or data prerequisite before automation.",
        whatNotToDo: "Do not automate before remediation.",
        nextBestAction: "Fix stale approval master data before automation",
        evidenceReferences: ["system-1"],
        explanation,
        traceability,
      },
      {
        id: "opportunity:human-approval",
        title: "Exception approval",
        executiveSummary: "Keep mandatory exception approval human-controlled.",
        priority: "HIGH",
        businessImpact: "This is a control decision, not an automation shortcut.",
        evidenceStrength: "MODERATE",
        uncertainty: ["approval threshold evidence", "Approval policy may be stale"],
        problem: "Keep mandatory exception approval human-controlled",
        probableCause: "Approval queue is the primary delay driver",
        recommendationState: "DO_NOT_AUTOMATE",
        economicState: "ECONOMICALLY_JUSTIFIED",
        whyItMatters: "This is a control decision, not an automation shortcut.",
        whatToDoNow: "Do not automate this item.",
        whatNotToDo: "Do not remove the required human control.",
        nextBestAction: "Remediate stale ERP approval data",
        evidenceReferences: ["sop-1"],
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
