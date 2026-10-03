import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AssistedAuditReadModel } from "../application/assisted-audit-model";
import { AutomationAuditView, customerError } from "./automation-audit-hub";

describe("AutomationAuditView", () => {
  it("explains domain refusals without leaking arbitrary backend messages", () => {
    expect(customerError(422, "password=secret")).toContain("preuves manquantes");
    expect(customerError(422, "password=secret")).not.toContain("secret");
    expect(customerError(500, "postgresql://credential")).not.toContain("postgresql");
    expect(customerError(403)).toContain("pas accès");
    expect(customerError(409)).toContain("Rechargez");
  });
  it("renders real accessible progress and readable journey descriptions without a scrolling rail", () => {
    const html = render(model());
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="11"');
    expect(html).toContain('class="journey-step-grid"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Cartographie du travail réellement observé.");
    expect(html).not.toContain("overflow-x-auto");
  });
  it("shows completed progress without implying automatic deployment", () => {
    const html = render(model({ currentStage: "COMPLETED", nextAction: "VIEW_RESULTS" }));
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain("Aucune automatisation n’est déployée par cet audit.");
  });
  it.each([
    ["PROCESS_MAP", "process-maps", "VALIDATE_PROCESS_MAP", "PUBLISH_PROCESS_MAP"],
    [
      "AI_OPPORTUNITIES",
      "ai-opportunities",
      "VALIDATE_AI_OPPORTUNITIES",
      "PUBLISH_AI_OPPORTUNITIES",
    ],
    [
      "AUTOMATION_OPPORTUNITIES",
      "automation-opportunities",
      "VALIDATE_AUTOMATION_OPPORTUNITIES",
      "PUBLISH_AUTOMATION_OPPORTUNITIES",
    ],
    ["ROI", "roi", "VALIDATE_ROI", "PUBLISH_ROI"],
    ["RECOMMENDATIONS", "recommendations", "VALIDATE_RECOMMENDATIONS", "PUBLISH_RECOMMENDATIONS"],
  ] as const)(
    "exposes the scoped %s detail before validation and publication",
    (currentStage, path, validate, publish) => {
      for (const nextAction of [validate, publish, null]) {
        const value = model({ currentStage, nextAction });
        const current = value.stages.find((stage) => stage.stage === currentStage)!;
        current.artifact = {
          id: "current-scoped-id",
          version: 1,
          status: "validated",
          lockVersion: 1,
        };
        value.stages.find((stage) => stage.stage === "DISCOVERY")!.artifact = {
          id: "unrelated-id",
          version: 1,
          status: "published",
        };
        const html = render(value);
        expect(html).toContain(`href="/${path}/current-scoped-id"`);
        expect(html).not.toContain(`href="/${path}/unrelated-id"`);
        if (nextAction)
          expect(html.indexOf(`href="/${path}/current-scoped-id"`)).toBeLessThan(
            html.indexOf("<button"),
          );
        else expect(html).not.toContain("<button");
        current.artifact = null;
        expect(render(value)).not.toContain(`href="/${path}/`);
      }
    },
  );

  it.each(["VALIDATE_ANALYSIS", "PUBLISH_ANALYSIS"] as const)(
    "exposes the canonical findings before %s without replacing the action",
    (nextAction) => {
      const value = model({ currentStage: "BUSINESS_ANALYSIS", nextAction });
      value.stages[4]!.artifact = {
        id: "scoped-analysis-id",
        version: 1,
        status: "validated",
        lockVersion: 2,
      };
      const html = render(value);
      expect(html).toContain('href="/analysis/scoped-analysis-id"');
      expect(html).toContain("Consulter les constats de l’analyse");
      expect(html.indexOf('href="/analysis/scoped-analysis-id"')).toBeLessThan(
        html.indexOf("<button"),
      );
      expect(html).toContain(
        nextAction === "VALIDATE_ANALYSIS" ? "Vérifier l’analyse" : "Approuver l’analyse",
      );
    },
  );

  it("does not invent a findings link when the analysis artifact is absent", () => {
    expect(render(model({ currentStage: "BUSINESS_ANALYSIS", nextAction: null }))).not.toContain(
      'href="/analysis/',
    );
  });

  it("allows read-only consultation without granting an approval action", () => {
    const value = model({ currentStage: "BUSINESS_ANALYSIS", nextAction: null });
    value.stages[4]!.artifact = { id: "scoped-analysis-id", version: 1, status: "draft" };
    const html = render(value);
    expect(html).toContain('href="/analysis/scoped-analysis-id"');
    expect(html).not.toContain("<button");
  });

  it("renders the real current stage, completed stages and primary action", () => {
    const html = render(model());
    expect(html).toContain("Audit");
    expect(html).toContain("Compréhension");
    expect(html).toContain("En cours");
    expect(html).toContain("Continuer l’entretien");
    expect(html).toContain("Progression validée, sans estimation");
    expect(html).toContain("De la compréhension à la décision");
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
    expect(html).toContain("Aucun processus n’est sélectionné automatiquement");
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
    expect(html).toContain("Votre accès permet la consultation uniquement.");
    expect(html).not.toContain("Continuer l’entretien</button>");
  });

  it("renders understandable blocked guidance", () => {
    const blocked = model({
      overallStatus: "BLOCKED",
      nextAction: null,
      blockingReason: "Complete and validate the Interview first",
    });
    blocked.stages[1]!.status = "BLOCKED";
    expect(render(blocked)).toContain("Terminez et validez l’entretien avant de continuer.");
    expect(render(blocked)).toContain("Informations requises");
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
    expect(render(completed)).toContain("Audit Optivos terminé");
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

  it("puts the next action before the detailed journey and explains who does what", () => {
    const html = render(model({ currentStage: "DISCOVERY", nextAction: "START_DISCOVERY" }));
    expect(html.indexOf('aria-label="Votre prochaine action"')).toBeLessThan(
      html.indexOf('aria-labelledby="audit-progress-title"'),
    );
    expect(html).toContain("Décrire mon entreprise");
    expect(html).toContain("Vous gardez la main");
    expect(html).toContain("Aucune automatisation n’est déployée par cet audit.");
    expect(html).not.toContain("Start company discovery");
    expect(html).toContain('aria-current="step"');
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
