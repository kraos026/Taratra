import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExecutiveSummary } from "./executive-summary";
describe("ExecutiveSummary", () => {
  it("renders deterministic source data", () => {
    const html = renderToStaticMarkup(
      <ExecutiveSummary
        summary={{
          strengths: ["Finance"],
          risks: ["Commercial"],
          topRecommendations: ["Installer un CRM"],
          roiText: "6 000 EUR par an",
        }}
      />,
    );
    expect(html).toContain("Finance");
    expect(html).toContain("Commercial");
    expect(html).toContain("Installer un CRM");
    expect(html).toContain("6 000 EUR par an");
  });
});
