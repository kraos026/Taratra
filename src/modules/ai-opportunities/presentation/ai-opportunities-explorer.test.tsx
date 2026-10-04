import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiOpportunitiesExplorer } from "./ai-opportunities-explorer";
import { aiOpportunityText } from "./ai-opportunity-copy";
describe("AiOpportunitiesExplorer", () => {
  it("renders deterministic opportunity metrics and capabilities", () => {
    const html = renderToStaticMarkup(
      <AiOpportunitiesExplorer
        opportunities={[
          {
            id: "o",
            title: "Invoice intelligence",
            description: "Reduce entry",
            businessProblem: "Manual invoices",
            risk: "medium",
            confidence: 85,
            feasibility: 77,
            businessImpact: 75,
            technicalComplexity: 80,
            dataReadiness: 100,
            aiReadiness: 86,
            implementationEffort: "high",
          },
        ]}
        links={[{ opportunityId: "o", capabilityId: "ocr" }]}
        capabilities={[{ id: "ocr", title: "OCR" }]}
      />,
    );
    expect(html).toContain("Assister le traitement des factures");
    expect(html).toContain("OCR");
    expect(html).toContain("Préparation aux usages IA");
    expect(html).toContain("ne sont pas des pourcentages de réussite");
    expect(html).toContain('value="medium"');
    expect(html).toContain("77/100");
    expect(html).not.toContain("AI Opportunities Explorer");
  });
  it("keeps unavailable data explicit without inventing gains", () => {
    const html = renderToStaticMarkup(
      <AiOpportunitiesExplorer
        opportunities={[
          {
            id: "o",
            title: "Email triage",
            description: "Classify and route incoming messages.",
            businessProblem: "Operational work depends on email.",
            risk: "medium",
            confidence: 100,
            feasibility: 50,
            businessImpact: 50,
            technicalComplexity: 60,
            dataReadiness: 0,
            aiReadiness: 50,
            implementationEffort: "medium",
          },
        ]}
        links={[]}
        capabilities={[]}
      />,
    );
    expect(html).toContain("Données nécessaires à compléter");
    expect(html).toContain("aucun résultat ni gain");
    expect(html).toContain("sans présumer l’existence d’un service support");
    expect(html).not.toContain("Operational work depends");
    expect(aiOpportunityText("Dossier propre à Société Delta")).toBe(
      "Dossier propre à Société Delta",
    );
  });
});
