import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BusinessFindingsExplorer } from "./business-findings-explorer";

describe("BusinessFindingsExplorer", () => {
  it("renders read-only findings, scores and health", () => {
    const html = renderToStaticMarkup(
      <BusinessFindingsExplorer
        findings={[
          {
            id: "finding",
            title: "Excel dependency",
            description: "The process depends on Excel.",
            severity: "medium",
            category: "systems",
            confidencePercentage: 100,
            businessImpact: "Assess a governed system.",
          },
        ]}
        scores={[{ id: "score", label: "Digitalization", score: 75 }]}
        health={[{ id: "health", dimension: "system_health", score: 80 }]}
      />,
    );
    expect(html).toContain("Excel dependency");
    expect(html).toContain("Digitalization");
    expect(html).toContain("system_health");
    expect(html).toContain("Search findings");
  });
});
