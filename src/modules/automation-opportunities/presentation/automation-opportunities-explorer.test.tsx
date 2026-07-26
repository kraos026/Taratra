import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AutomationOpportunitiesExplorer } from "./automation-opportunities-explorer";
describe("AutomationOpportunitiesExplorer", () => {
  it("renders deterministic scores and evidence", () => {
    const html = renderToStaticMarkup(
      <AutomationOpportunitiesExplorer
        opportunities={[
          {
            id: "o",
            title: "Invoice",
            description: "Automate",
            businessProblem: "Manual",
            patternId: "p",
            triggerType: "File Uploaded",
            implementationEffort: "medium",
            businessImpact: 75,
            automationCoverage: 100,
            technicalFeasibility: 80,
            connectorAvailability: 100,
            automationReadiness: 88,
            complexityScore: 60,
            confidence: 85,
          },
        ]}
        connectors={[{ opportunityId: "o", connectorId: "c", available: true }]}
        patterns={[{ id: "p", title: "Invoice Processing" }]}
      />,
    );
    expect(html).toContain("Automation Opportunities Explorer");
    expect(html).toContain("Invoice Processing");
    expect(html).toContain("1 evidenced connectors");
  });
});
