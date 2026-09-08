import { describe, expect, it } from "vitest";
import type { ExecutiveAuditResult, OpportunityDecisionSafety } from "../executive-results/application/executive-result-model";
import { ProductionExecutiveDecisionViewBuilder } from "./application/production-executive-decision-view";

function input(): ExecutiveAuditResult {
  return {
    company: { id: "company", name: "Business fixture" }, complete: true,
    audit: { company: { id: "company", name: "Business fixture" }, overallStatus: "COMPLETED", currentStage: "COMPLETED", nextAction: "VIEW_RESULTS", blockingReason: null, stages: [{ stage: "PROCESS_MAP", label: "Process", status: "COMPLETED", artifact: { id: "process", version: 1, status: "published" }, candidateArtifacts: [], availableActions: [], blockingReason: null }] },
    overview: { processes: 1, findings: 1, opportunities: 1, recommendations: 1 },
    process: { id: "process", name: "Reconciliation" },
    findings: [{ id: "finding", title: "Rework", description: "Duplicated capture", severity: "medium", impact: "Delay" }],
    opportunities: [{ id: "op", title: "Reconciliation", problem: "Duplicate capture", impact: 85, readiness: 90, confidence: 95, safety: {
      organizationId: "tenant", companyId: "company", opportunityId: "op", automationSnapshotId: "automation",
      evidence: [{ id: "fact", quality: "SUPPORTED" }], observations: [], prerequisites: [],
    } }],
    roi: { id: "roi", currency: "EUR", evaluations: [{ id: "evaluation", automationOpportunityId: "op", title: "ROI", annualBenefit: 20000, roi: 120, roiSpecialValue: null, payback: 6 }] },
    recommendations: [{ id: "recommendation", title: "Reconciliation", action: "Review the design", description: "Reduce duplicated capture", priority: "high", phase: "phase_1", expectedRoi: 120, roiSpecialValue: null, payback: 6, confidence: 95 }],
    provenance: { processMapId: "process", analysisId: "analysis", automationOpportunitySnapshotId: "automation", roiId: "roi", recommendationPortfolioId: "portfolio" },
  };
}
const safety = (result: ExecutiveAuditResult) => result.opportunities[0]!.safety!;
const prerequisite = (kind: OpportunityDecisionSafety["prerequisites"][number]["kind"]) => ({ id: kind, opportunityId: "op", kind, satisfied: false, remediation: `Resolve ${kind} before deployment` });

// Expected decisions are scoring truth only. Only `result` reaches the production builder.
const cases: { name: string; change: (result: ExecutiveAuditResult) => void; expected: string }[] = [
  { name: "supported and no blocking prerequisite", change: () => {}, expected: "AUTOMATE_NOW" },
  { name: "sparse legacy read model", change: r => { delete r.opportunities[0]!.safety; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "missing evidence", change: r => { safety(r).evidence = []; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "inferred evidence", change: r => { safety(r).evidence[0]!.quality = "INFERRED"; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "assumed evidence", change: r => { safety(r).evidence[0]!.quality = "ASSUMED"; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "contradictory manual and automated evidence", change: r => { safety(r).observations = ["manual", "automated"].map((value, i) => ({ factId: `fact${i}`, key: "execution_mode", value, quality: "SUPPORTED" })); }, expected: "INVESTIGATE_FIRST" },
  { name: "high ROI compliance permission block", change: r => { safety(r).prerequisites = [prerequisite("permission")]; }, expected: "FIX_BEFORE_AUTOMATING" },
  { name: "low ROI remains non justified without invented strategic gain", change: r => { r.roi!.evaluations[0]!.roi = -20; }, expected: "NOT_ECONOMICALLY_JUSTIFIED" },
  { name: "unresolved prerequisite", change: r => { safety(r).prerequisites = [prerequisite("remediation")]; }, expected: "FIX_BEFORE_AUTOMATING" },
  { name: "human approval required", change: r => { safety(r).prerequisites = [prerequisite("human_approval")]; }, expected: "HUMAN_DECISION_REQUIRED" },
  { name: "finance sensitive approval", change: r => { r.opportunities[0]!.problem = "Finance refund"; safety(r).prerequisites = [prerequisite("human_approval")]; }, expected: "HUMAN_DECISION_REQUIRED" },
  { name: "do not automate explicit fact", change: r => { safety(r).observations = [{ factId: "policy", key: "automation_allowed", value: false, quality: "SUPPORTED" }]; }, expected: "DO_NOT_AUTOMATE" },
  { name: "medium severity with concrete remediation", change: r => { safety(r).prerequisites = [prerequisite("remediation")]; }, expected: "FIX_BEFORE_AUTOMATING" },
  { name: "unavailable connector", change: r => { safety(r).prerequisites = [prerequisite("connector")]; }, expected: "FIX_BEFORE_AUTOMATING" },
  { name: "stale opportunity lineage", change: r => { safety(r).automationSnapshotId = "old"; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "cross company prerequisite context", change: r => { safety(r).companyId = "foreign"; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "wrong opportunity prerequisite", change: r => { safety(r).prerequisites = [{ ...prerequisite("permission"), opportunityId: "other" }]; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "missing ROI despite positive gross savings", change: r => { r.roi!.evaluations[0]!.roi = null; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "ROI linked to another opportunity", change: r => { r.roi!.evaluations[0]!.automationOpportunityId = "other"; }, expected: "NEEDS_MORE_EVIDENCE" },
  { name: "conflicting comparable financial observations", change: r => { safety(r).observations = [20, 80].map((value, i) => ({ factId: `cost${i}`, key: "hourly_cost", unit: "EUR/hour", value, quality: i ? "ASSUMED" : "SUPPORTED" })); }, expected: "INVESTIGATE_FIRST" },
];

describe("production decision safety business benchmark", () => {
  it.each(cases)("$name", ({ change, expected }) => {
    const result = input(); change(result);
    const view = new ProductionExecutiveDecisionViewBuilder().build({ tenantId: "tenant", result }).view!;
    const card = view.priorityCards.find(item => item.id === "opportunity:op")!;
    expect(card.recommendationState).toBe(expected);
    if (expected === "FIX_BEFORE_AUTOMATING") expect(card.whatToDoNow).toContain("Resolve");
    if (expected === "NEEDS_MORE_EVIDENCE") expect(card.uncertainty.length).toBeGreaterThan(0);
  });
});
