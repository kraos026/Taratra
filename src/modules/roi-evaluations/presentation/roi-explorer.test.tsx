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
    expect(html).toContain("ROI Optivos");
    expect(html).toContain("Évaluation économique");
    expect(html).toContain("Invoice ROI");
    expect(html).toContain("5 000 EUR");
  });

  it("exposes canonical hours and the benefit/cost breakdown without changing ROI", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "s", type: "expected" }]}
        evaluations={[
          {
            id: "e",
            scenarioId: "s",
            title: "Synthetic invoice ROI",
            description: "Test only",
            confidence: 100,
          },
        ]}
        metrics={[
          ["annual_hours_saved", 480, "hours/year"],
          ["annual_cost_saved", 14400, "currency/year"],
          ["annual_benefit", 62400, "currency/year"],
          ["implementation_cost", 4000, "currency"],
          ["training_cost", 400, "currency"],
          ["infrastructure_cost", 200, "currency"],
          ["maintenance_cost", 600, "currency/year"],
          ["annual_net_benefit", 61800, "currency/year"],
          ["roi_percentage", 1243.4783, "percent"],
          ["payback_period", 0.8932, "months"],
        ].map(([code, value, unit]) => ({
          evaluationId: "e",
          code: String(code),
          value: Number(value),
          unit: String(unit),
          specialValue: null,
        }))}
      />,
    );
    expect(html).toContain("480 h/an");
    expect(html).toContain("62 400 EUR");
    expect(html).toContain("61 800 EUR");
    expect(html).toContain("1243.5 %");
    expect(html).toContain("0.9 mois");
    expect(html).toContain("Coût de formation");
    expect(html).toContain("Coût d’infrastructure");
    expect(html).toContain("ne constituent pas une autorisation");
    expect(html).toContain("doubles comptes");
    expect(html).not.toContain("Les scénarios validés");
  });

  it("keeps absent canonical hours unknown instead of substituting a different metric", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "s", type: "expected" }]}
        evaluations={[
          { id: "e", scenarioId: "s", title: "Incomplete", description: "", confidence: 0 },
        ]}
        metrics={[
          {
            evaluationId: "e",
            code: "annual_time_saved",
            value: 999,
            specialValue: null,
            unit: "hours/year",
          },
        ]}
      />,
    );
    expect(html).not.toContain("999 h/an");
    expect(html).toContain("Données complémentaires requises");
  });
});
