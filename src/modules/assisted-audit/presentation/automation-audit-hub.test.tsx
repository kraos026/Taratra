import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AssistedAuditReadModel } from "../application/assisted-audit-model";
import { AutomationAuditView } from "./automation-audit-hub";

describe("AutomationAuditView", () => {
  it("renders the real current stage, completed stages and primary action", () => {
    const html = render(model());
    expect(html).toContain("Automation Audit");
    expect(html).toContain("Company Information");
    expect(html).toContain("Complete");
    expect(html).toContain("Interview");
    expect(html).toContain("Continue the interview");
    expect(html).toContain("1 of 9 stages complete");
  });

  it("links Discovery and Interview actions to their canonical screens", () => {
    const discovery = model({ currentStage: "DISCOVERY", nextAction: "START_DISCOVERY" });
    expect(render(discovery)).toContain('href="/companies/company-id/discovery"');
    expect(render(model())).toContain('href="/companies/company-id/interview"');
  });

  it("shows Process Map ambiguity without resolving it", () => {
    const ambiguous = model({
      currentStage: "PROCESS_MAP",
      nextAction: "SELECT_PROCESS_MAP",
      overallStatus: "AMBIGUOUS",
    });
    ambiguous.stages[3] = {
      stage: "PROCESS_MAP",
      label: "Processes",
      status: "AMBIGUOUS",
      artifact: null,
      candidateArtifacts: [
        { id: "real-candidate-a", version: 1, status: "published", lockVersion: 1 },
        { id: "real-candidate-b", version: 2, status: "draft", lockVersion: 3 },
      ],
      availableActions: ["SELECT_PROCESS_MAP"],
      blockingReason: "Select a process",
    };
    const html = render(ambiguous);
    expect(html).toContain("No process has been selected automatically");
    expect(html).toContain("/process-maps/real-candidate-a");
    expect(html).toContain("/process-maps/real-candidate-b");
  });

  it("renders viewer and consultant restrictions without enabled mutation buttons", () => {
    const restricted = model({
      nextAction: null,
      blockingReason: "This role has read-only access",
    });
    restricted.stages[1]!.availableActions = [];
    const html = render(restricted);
    expect(html).toContain("This role has read-only access");
    expect(html).not.toContain("Continue the interview</button>");
  });

  it("renders understandable blocked guidance", () => {
    const blocked = model({
      overallStatus: "BLOCKED",
      nextAction: null,
      blockingReason: "Complete and validate the Interview first",
    });
    blocked.stages[1]!.status = "BLOCKED";
    expect(render(blocked)).toContain("Complete and validate the Interview first");
    expect(render(blocked)).toContain("Waiting for a prerequisite");
  });

  it("renders the completed audit experience and real recommendation link", () => {
    const completed = model({ currentStage: "COMPLETED", nextAction: "VIEW_RESULTS" });
    completed.stages = completed.stages.map((stage) => ({ ...stage, status: "COMPLETED" }));
    completed.stages[8] = {
      stage: "RECOMMENDATIONS",
      label: "Action Plan",
      status: "COMPLETED",
      artifact: { id: "real-recommendation-id", version: 1, status: "published" },
      candidateArtifacts: [],
      availableActions: [],
      blockingReason: null,
    };
    expect(render(completed)).toContain("Automation Audit Complete");
    expect(render(completed)).toContain("/companies/company-id/automation-audit/results");
  });

  it("renders safe API errors", () => {
    const html = renderToStaticMarkup(
      <AutomationAuditView
        companyId="company-id"
        model={model()}
        busy={false}
        error="Something went wrong while updating the audit. Please try again."
        onCommand={vi.fn()}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Something went wrong while updating the audit");
  });
});

function render(value: AssistedAuditReadModel) {
  return renderToStaticMarkup(
    <AutomationAuditView
      companyId="company-id"
      model={value}
      busy={false}
      error={null}
      onCommand={vi.fn()}
    />,
  );
}

function model(overrides: Partial<AssistedAuditReadModel> = {}): AssistedAuditReadModel {
  const stages: AssistedAuditReadModel["stages"] = [
    stage("DISCOVERY", "Company Information", "COMPLETED"),
    stage("INTERVIEW", "Interview", "IN_PROGRESS"),
    stage("KNOWLEDGE", "Knowledge", "BLOCKED"),
    stage("PROCESS_MAP", "Processes", "BLOCKED"),
    stage("BUSINESS_ANALYSIS", "Analysis", "BLOCKED"),
    stage("AI_OPPORTUNITIES", "AI Opportunities", "BLOCKED"),
    stage("AUTOMATION_OPPORTUNITIES", "Automation Opportunities", "BLOCKED"),
    stage("ROI", "ROI", "BLOCKED"),
    stage("RECOMMENDATIONS", "Action Plan", "BLOCKED"),
    stage("COMPLETED", "Results", "BLOCKED"),
  ];
  return {
    company: { id: "company-id", name: "Pilot Company" },
    overallStatus: "IN_PROGRESS",
    currentStage: "INTERVIEW",
    stages,
    nextAction: "CONTINUE_INTERVIEW",
    blockingReason: null,
    ...overrides,
  };
}

function stage(
  name: AssistedAuditReadModel["stages"][number]["stage"],
  label: string,
  status: AssistedAuditReadModel["stages"][number]["status"],
): AssistedAuditReadModel["stages"][number] {
  return {
    stage: name,
    label,
    status,
    artifact: null,
    candidateArtifacts: [],
    availableActions: [],
    blockingReason: status === "BLOCKED" ? "Complete the previous stage first" : null,
  };
}
