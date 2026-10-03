import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoiExplorer } from "./roi-explorer";
describe("RoiExplorer", () => {
  it("does not substitute another scenario into an empty probable filter", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "optimistic", type: "optimistic" }]}
        evaluations={[
          {
            id: "other",
            scenarioId: "optimistic",
            title: "Other scenario",
            description: "",
            confidence: 100,
          },
        ]}
        metrics={[
          {
            evaluationId: "other",
            code: "annual_cost_saved",
            value: 99999,
            specialValue: null,
            unit: "currency/year",
          },
        ]}
      />,
    );
    expect(html).not.toContain("99 999 EUR");
    expect(html).not.toContain("Repère économique");
    expect(html).toContain("ROI non disponible pour ce filtre");
  });
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
    expect(html).toContain("1 243,5 %");
    expect(html).toContain("0,9 mois");
    expect(html).toContain("48 000 EUR");
    expect(html).toContain("hypothèse à vérifier");
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

  it("translates generated ROI copy and explains shared assumptions without changing amounts", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "s", type: "expected" }]}
        evaluations={[
          {
            id: "e",
            scenarioId: "s",
            title: "Automate support ticket routing",
            description: "Route requests to the correct team.",
            confidence: 100,
          },
        ]}
        metrics={[
          {
            evaluationId: "e",
            code: "annual_hours_saved",
            value: 480,
            specialValue: null,
            unit: "hours/year",
          },
        ]}
        traces={[
          {
            evaluationId: "e",
            sharedEvaluationCount: 5,
            sourceReferenceCount: 2,
            assumptions: [
              { code: "hourly_cost", value: 30, unit: "currency/hour", source: "provided" },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("Automatiser l’orientation des demandes de support");
    expect(html).toContain("Orienter les demandes vers l’équipe concernée.");
    expect(html).not.toContain("Automate support");
    expect(html).toContain("480 h/an");
    expect(html).toContain("partagées par 5 évaluations");
    expect(html).toContain("ne les additionnez pas");
    expect(html).toContain("30 EUR");
    expect(html).toContain("Renseignée dans l’évaluation — à vérifier");
    expect(html).toContain("2 référence(s) source distincte(s)");
    expect(html).toContain("ne constitue pas à elle seule une preuve");
    expect(html).toContain("Même à 100 %");
    expect(html).not.toContain("Confiance moyenne");
  });

  it("keeps missing trace unknown and preserves unrecognized customer wording", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "s", type: "expected" }]}
        evaluations={[
          {
            id: "e",
            scenarioId: "s",
            title: "Customer-specific activity",
            description: "",
            confidence: 0,
          },
        ]}
        metrics={[]}
      />,
    );
    expect(html).toContain("Customer-specific activity");
    expect(html).toContain("Hypothèses détaillées non disponibles");
    expect(html).not.toContain("partagées par");
    expect(html).not.toContain("0 référence(s)");
    expect(html).not.toContain("48 000 EUR");
  });

  it("never borrows another evaluation’s trace", () => {
    const html = renderToStaticMarkup(
      <RoiExplorer
        currency="EUR"
        scenarios={[{ id: "s", type: "expected" }]}
        evaluations={[
          {
            id: "e",
            scenarioId: "s",
            title: "Automate scheduled reporting",
            description: "Generate consistent scheduled reports.",
            confidence: 0,
          },
        ]}
        metrics={[]}
        traces={[
          {
            evaluationId: "other",
            sharedEvaluationCount: 5,
            sourceReferenceCount: 99,
            assumptions: [
              { code: "hourly_cost", value: 999, unit: "currency", source: "provided" },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain("Automatiser les rapports périodiques");
    expect(html).toContain("Produire des rapports périodiques cohérents.");
    expect(html).not.toContain("999 EUR");
    expect(html).not.toContain("99 référence(s)");
  });
});
