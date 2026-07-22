import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportCharts } from "./report-charts";
describe("ReportCharts", () => {
  it("exposes accessible names for four charts", () => {
    const html = renderToStaticMarkup(
      <ReportCharts
        charts={{
          domainScores: [],
          hoursByCategory: [],
          priorityDistribution: [],
          roiByRecommendation: [],
        }}
      />,
    );
    for (const title of [
      "Scores par domaine",
      "Temps économisé par catégorie",
      "Répartition des priorités",
      "ROI par recommandation",
    ])
      expect(html).toContain(`aria-label="${title}"`);
  });
});
