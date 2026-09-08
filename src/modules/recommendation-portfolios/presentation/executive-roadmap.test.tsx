import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveRoadmap } from "./executive-roadmap";
describe("ExecutiveRoadmap", () => {
  it("renders portfolio priority and phase", () => {
    const html = renderToStaticMarkup(
      <ExecutiveRoadmap
        recommendations={[
          {
            id: "r",
            title: "Invoice",
            description: "Automate",
            priority: "high",
            category: "quick_wins",
            roadmapPhase: "phase_1",
            priorityScore: 80,
            expectedRoi: 200.45678,
            roiSpecialValue: null,
            confidence: 90,
            implementationCost: 1000,
          },
        ]}
      />,
    );
    expect(html).toContain("Plan d’action Optivos");
    expect(html).toContain("Feuille de route exécutive");
    expect(html).toContain("Top 3 à traiter en premier");
    expect(html).toContain("Priorité immédiate");
    expect(html).toContain("Conditions / prérequis");
    expect(html).toContain("200,5%");
    expect(html).not.toContain("200.45678");
  });
});
