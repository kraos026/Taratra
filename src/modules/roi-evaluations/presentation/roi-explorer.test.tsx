import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoiExplorer } from "./roi-explorer";
describe("RoiExplorer", () => {
  it("renders scenario metrics and currency", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "s", type: "expected" }]}
        evaluations={[
          {
            id: "e",
            scenarioId: "s",
            title: "Invoice ROI",
            description: "Evaluation",
            confidence: 90,
          },
        ]}
        metrics={[
          {
            evaluationId: "e",
            code: "roi_percentage",
            value: 120,
            specialValue: null,
            unit: "percent",
          },
          {
            evaluationId: "e",
            code: "annual_cost_saved",
            value: 5000,
            specialValue: null,
            unit: "currency/year",
          },
        ]}
      />,
    );
    expect(html).toContain("ROI Explorer");
    expect(html).toContain("Invoice ROI");
    expect(html).toContain("5000.00 EUR");
  });
});
