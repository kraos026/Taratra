import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiOpportunitiesExplorer } from "./ai-opportunities-explorer";
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
    expect(html).toContain("Invoice intelligence");
    expect(html).toContain("OCR");
    expect(html).toContain("AI readiness");
  });
});
