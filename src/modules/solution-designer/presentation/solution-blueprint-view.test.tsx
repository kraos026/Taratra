import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SolutionBlueprintView } from "./solution-blueprint-view";
describe("SolutionBlueprintView", () => {
  it("renders an abstract technical cost index and architecture", () => {
    const html = renderToStaticMarkup(
      <SolutionBlueprintView
        blueprint={{
          name: "Blueprint",
          description: "Abstract",
          architecture: "Simple Automation",
          status: "published",
          complexityScore: 36,
          estimatedTechnicalCostIndex: 108,
          finalRisk: 50,
          componentsJson: [],
          capabilitiesJson: [],
          constraintsJson: [],
          topologyJson: [],
          risksJson: [],
          dependenciesJson: [],
        }}
      />,
    );
    expect(html).toContain("Indice coût technique");
    expect(html).toContain("Simple Automation");
  });
});
