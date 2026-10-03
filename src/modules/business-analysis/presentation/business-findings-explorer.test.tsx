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
    expect(html).toContain("Dépendance aux tableaux Excel");
    expect(html).toContain("Usage des outils numériques");
    expect(html).toContain("Outils");
    expect(html).toContain("Rechercher un constat");
    expect(html).not.toContain("system_health");
    expect(html).toContain("pas des gains financiers");
  });

  it("shows missing evidence without fabricating references or granting approval", () => {
    const html = renderToStaticMarkup(
      <BusinessFindingsExplorer
        findings={[
          {
            id: "f",
            title: "Missing KPI",
            description: "No KPI evidence is attached to the process.",
            severity: "medium",
            category: "measurement",
            confidencePercentage: 100,
            businessImpact: "Define a measurable KPI.",
            evidenceCount: 0,
          },
        ]}
        scores={[]}
        health={[]}
        companyId="scoped-company"
        validations={[{ id: "v", code: "missing_evidence", severity: "error" }]}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Au moins un constat n’a pas de preuve pertinente reliée");
    expect(html).toContain("Aucune référence source reliée");
    expect(html).toContain('href="/companies/scoped-company/interview"');
    expect(html).toContain("ce n’est pas une certitude");
    expect(html).not.toContain("Missing KPI");
    expect(html).not.toContain("Valider l’analyse");
  });
});
