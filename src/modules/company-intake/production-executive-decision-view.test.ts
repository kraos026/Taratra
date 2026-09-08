import { describe, expect, it } from "vitest";
import type { ExecutiveAuditResult } from "../executive-results/application/executive-result-model";
import { PatronDecisionCenterPresenter, ProductionExecutiveDecisionViewBuilder } from "./index";

describe("ProductionExecutiveDecisionViewBuilder", () => {
  it.each([-20, 0])("does not justify automation from gross savings when ROI is %s", (roi) => {
    const result = publishedResult();
    result.roi!.evaluations[0]!.roi = roi;
    const view = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result,
    }).view!;
    expect(view.economicReadiness).toBe("NOT_JUSTIFIED");
    expect(view.priorityCards.some((card) => card.recommendationState === "AUTOMATE_NOW")).toBe(
      false,
    );
  });
  it("keeps missing ROI explicit even when gross benefit is positive", () => {
    const result = publishedResult();
    result.roi!.evaluations[0]!.roi = null;
    const view = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result,
    }).view!;
    expect(view.economicReadiness).toBe("INSUFFICIENT_EVIDENCE");
    expect(view.whatRequiresMoreEvidence.length).toBeGreaterThan(0);
  });
  it("recognizes the canonical unbounded ROI representation", () => {
    const result = publishedResult();
    result.roi!.evaluations[0]!.roi = null;
    result.roi!.evaluations[0]!.roiSpecialValue = "unbounded";
    result.roi!.evaluations[0]!.annualBenefit = null;
    expect(
      new ProductionExecutiveDecisionViewBuilder().build({ tenantId: "tenant-a", result }).view
        ?.economicReadiness,
    ).toBe("ECONOMICALLY_JUSTIFIED");
  });
  it("projects a published executive result into the patron decision center contract", () => {
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: publishedResult(),
    });

    expect(projection.unavailableReason).toBeNull();
    expect(projection.view?.company).toEqual({
      id: "company-a",
      tenantId: "tenant-a",
      name: "Pilot Company",
    });
    expect(projection.view?.ownership).toMatchObject({
      persistedArtifactOwner: "ExecutiveResultService/ReportService",
      createsLifecycle: false,
    });
    expect(projection.view?.priorityCards.map((card) => card.title)).toEqual(
      expect.arrayContaining(["Manual invoice reconciliation", "Invoice approval delay"]),
    );
    expect(projection.view?.traceability.executiveResultArtifactIds).toEqual({
      processMapId: "process-map-1",
      analysisId: "analysis-1",
      automationOpportunitySnapshotId: "automation-snapshot-1",
      roiId: "roi-1",
      recommendationPortfolioId: "recommendation-portfolio-1",
    });
  });

  it("keeps unavailable reasons explicit instead of fabricating executive decisions", () => {
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: { ...publishedResult(), complete: false },
    });

    expect(projection.view).toBeNull();
    expect(projection.unavailableReason).toBe("EXECUTIVE_RESULT_NOT_PUBLISHED");
  });

  it("rejects draft process maps as non-published canonical artifacts", () => {
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: {
        ...publishedResult(),
        audit: {
          ...publishedResult().audit,
          stages: [
            {
              ...publishedResult().audit.stages[0],
              artifact: { id: "process-map-1", version: 1, status: "draft" },
            },
          ],
        },
      },
    });

    expect(projection.view).toBeNull();
    expect(projection.unavailableReason).toBe("DRAFT_PROCESS_MAP");
  });

  it("feeds the existing presenter without creating another decision center model", () => {
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: publishedResult(),
    });

    const center = PatronDecisionCenterPresenter.build(projection.view!);

    expect(center.source).toBe("EXECUTIVE_DECISION_VIEW");
    expect(center.overview.companyName).toBe("Pilot Company");
    expect(center.evidence.supportingSources).toContain("process-map-1");
    expect(center.sourceView).toBe(projection.view);
  });

  it("includes a medium finding when its authoritative decision requires remediation", () => {
    const base = publishedResult();
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: {
        ...base,
        findings: [{ ...base.findings[0]!, severity: "medium" }],
      },
    });

    expect(projection.view?.whatToFixFirst).toEqual(["Invoice approval delay"]);
    expect(projection.view?.completeness.whatToFix).toBe(true);
    expect(projection.view?.completeness.status).toBe("YES");
  });

  it("does not treat a medium opportunity without a fix-before decision as remediation", () => {
    const base = publishedResult();
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: {
        ...base,
        findings: [],
        opportunities: [{ ...base.opportunities[0]!, impact: 60 }],
      },
    });

    expect(projection.view?.priorityCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "opportunity:opportunity-1",
          priority: "MEDIUM",
          recommendationState: "AUTOMATE_NOW",
        }),
      ]),
    );
    expect(projection.view?.whatToFixFirst).toEqual([]);
    expect(projection.view?.completeness.whatToFix).toBe(false);
  });

  it("keeps high and critical findings in remediation priority order", () => {
    const base = publishedResult();
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: {
        ...base,
        findings: [
          { ...base.findings[0]!, id: "finding-high", severity: "high", title: "High issue" },
          {
            ...base.findings[0]!,
            id: "finding-critical",
            severity: "critical",
            title: "Critical issue",
          },
        ],
      },
    });

    expect(projection.view?.whatToFixFirst).toEqual(["Critical issue", "High issue"]);
  });

  it("keeps missing evidence visible and the executive result incomplete", () => {
    const base = publishedResult();
    const projection = new ProductionExecutiveDecisionViewBuilder().build({
      tenantId: "tenant-a",
      result: { ...base, roi: { ...base.roi!, evaluations: [] } },
    });

    expect(projection.view?.whatRequiresMoreEvidence).toContain(
      "Published ROI evaluation is unavailable.",
    );
    expect(projection.view?.completeness.status).toBe("NO");
  });
});

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
