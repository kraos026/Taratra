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
            expectedRoi: 200,
            roiSpecialValue: null,
            confidence: 90,
            implementationCost: 1000,
          },
        ]}
      />,
    );
    expect(html).toContain("Executive Roadmap");
    expect(html).toContain("quick_wins");
    expect(html).toContain("phase_1");
  });
});
