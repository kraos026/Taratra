import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AutomationOpportunitiesExplorer } from "./automation-opportunities-explorer";

const opportunity = (
  overrides: Partial<
    Parameters<typeof AutomationOpportunitiesExplorer>[0]["opportunities"][number]
  > = {},
) => ({
  id: overrides.id ?? "o",
  title: overrides.title ?? "Invoice processing",
  description: overrides.description ?? "Reduce manual handling before finance review.",
  businessProblem: overrides.businessProblem ?? "Manual invoice checks delay payment decisions.",
  patternId: overrides.patternId ?? "p",
  triggerType: overrides.triggerType ?? "file_uploaded",
  implementationEffort: overrides.implementationEffort ?? "medium",
  businessImpact: overrides.businessImpact ?? 75,
  automationCoverage: overrides.automationCoverage ?? 80,
  technicalFeasibility: overrides.technicalFeasibility ?? 80,
  connectorAvailability: overrides.connectorAvailability ?? 100,
  automationReadiness: overrides.automationReadiness ?? 88,
  complexityScore: overrides.complexityScore ?? 60,
  confidence: overrides.confidence ?? 85,
  decisionState: overrides.decisionState,
  actions: overrides.actions ?? ["finance approval"],
  outputs: overrides.outputs ?? ["review queue"],
});

describe("AutomationOpportunitiesExplorer", () => {
  it("renders an Optivos executive opportunity page without legacy internal wording", () => {
    const html = renderToStaticMarkup(
      <AutomationOpportunitiesExplorer
        opportunities={[
          opportunity({ id: "o1", decisionState: "AUTOMATE_NOW" }),
          opportunity({ id: "o2", title: "Customer updates", decisionState: "DEFER" }),
          opportunity({ id: "o3", title: "Exception routing", decisionState: "DO_NOT_AUTOMATE" }),
          opportunity({
            id: "o4",
            title: "Evidence intake",
            decisionState: "AUTOMATE_AFTER_REMEDIATION",
          }),
        ]}
        connectors={[{ opportunityId: "o1", connectorId: "c", available: true }]}
        evidence={[{ opportunityId: "o1" }]}
        patterns={[{ id: "p", title: "Invoice Processing" }]}
      />,
    );

    expect(html).toContain("Opportunités");
    expect(html).toContain("Top 3 recommandé");
    expect(html).toContain("Toutes les opportunités");
    expect(html).toContain("Automatiser maintenant");
    expect(html).toContain("Reporter");
    expect(html).toContain("Ne pas automatiser");
    expect(html).toContain("Automatiser après correction");
    expect(html).toContain("ROI estimé");
    expect(html).toContain("Validation humaine requise");
    expect(html).not.toContain("Automation Opportunities Explorer");
    expect(html).not.toContain("Deterministic Automation Opportunity Engine");
  });

  it("uses a safe empty state without fake values", () => {
    const html = renderToStaticMarkup(
      <AutomationOpportunitiesExplorer opportunities={[]} connectors={[]} patterns={[]} />,
    );

    expect(html).toContain("Votre analyse n’a pas encore généré d’opportunités.");
    expect(html).toContain("Continuer l’audit");
    expect(html).not.toContain("0 €");
  });
});
