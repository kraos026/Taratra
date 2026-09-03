import { describe, expect, it } from "vitest";
import type { AssistedAuditReadModel } from "../application/assisted-audit-model";
import {
  buildCustomerJourney,
  customerJourneyRoutes,
  customerStageLabel,
  journeyProgress,
} from "./canonical-journey";

describe("canonical customer journey", () => {
  it("projects engine stages into one stable seven-step customer journey", () => {
    const audit = model("BUSINESS_ANALYSIS");
    const journey = buildCustomerJourney(audit);

    expect(journey.map((step) => step.label)).toEqual([
      "Compréhension",
      "Processus",
      "Analyse",
      "Automatisation",
      "ROI",
      "Plan d’action",
      "Résultats",
    ]);
    expect(journey.find((step) => step.current)?.label).toBe("Analyse");
    expect(customerStageLabel("BUSINESS_ANALYSIS")).toBe("Analyse métier");
  });

  it("reports real progress instead of treating any existing audit as complete", () => {
    expect(journeyProgress(model("DISCOVERY"))).toBe(0);
    expect(journeyProgress(model("BUSINESS_ANALYSIS"))).toBe(44);
    expect(journeyProgress(model("COMPLETED"))).toBe(100);
  });

  it("presents sequenced future stages as upcoming rather than customer-facing errors", () => {
    const audit = model("DISCOVERY");
    for (const stage of audit.stages.slice(3)) stage.status = "BLOCKED";

    const journey = buildCustomerJourney(audit);

    expect(journey[0]?.status).toBe("IN_PROGRESS");
    expect(journey.slice(1).every((step) => step.status === "NOT_STARTED")).toBe(true);
  });

  it("links only to published artifacts and otherwise returns to the audit", () => {
    const audit = model("RECOMMENDATIONS");
    audit.stages.find((stage) => stage.stage === "AUTOMATION_OPPORTUNITIES")!.artifact = {
      id: "automation-id",
      version: 1,
      status: "published",
    };
    audit.stages.find((stage) => stage.stage === "ROI")!.artifact = {
      id: "roi-id",
      version: 1,
      status: "published",
    };

    expect(customerJourneyRoutes("company-id", audit)).toEqual({
      audit: "/companies/company-id/automation-audit",
      opportunities: "/automation-opportunities/automation-id",
      roi: "/roi/roi-id",
      actionPlan: "/companies/company-id/automation-audit",
      results: "/companies/company-id/automation-audit",
    });
  });
});

function model(currentStage: AssistedAuditReadModel["currentStage"]): AssistedAuditReadModel {
  const stages: AssistedAuditReadModel["stages"] = [
    "DISCOVERY",
    "INTERVIEW",
    "KNOWLEDGE",
    "PROCESS_MAP",
    "BUSINESS_ANALYSIS",
    "AI_OPPORTUNITIES",
    "AUTOMATION_OPPORTUNITIES",
    "ROI",
    "RECOMMENDATIONS",
    "COMPLETED",
  ].map((stage) => ({
    stage: stage as AssistedAuditReadModel["currentStage"],
    label: stage,
    status:
      currentStage === "COMPLETED" || stageIndex(stage) < stageIndex(currentStage)
        ? "COMPLETED"
        : stage === currentStage
          ? "IN_PROGRESS"
          : "NOT_STARTED",
    artifact: null,
    candidateArtifacts: [],
    availableActions: [],
    blockingReason: null,
  }));
  return {
    company: { id: "company-id", name: "Company" },
    overallStatus: currentStage === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    currentStage,
    stages,
    nextAction: null,
    blockingReason: null,
  };
}

function stageIndex(stage: string): number {
  return [
    "DISCOVERY",
    "INTERVIEW",
    "KNOWLEDGE",
    "PROCESS_MAP",
    "BUSINESS_ANALYSIS",
    "AI_OPPORTUNITIES",
    "AUTOMATION_OPPORTUNITIES",
    "ROI",
    "RECOMMENDATIONS",
    "COMPLETED",
  ].indexOf(stage);
}
