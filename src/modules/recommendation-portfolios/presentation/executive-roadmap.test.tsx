import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveRoadmap } from "./executive-roadmap";
describe("ExecutiveRoadmap", () => {
  it("renders portfolio priority and phase", () => {
    const html = renderToStaticMarkup(
      <ExecutiveRoadmap
        status="draft"
        companyId="company-1"
        recommendations={[
          {
            id: "r",
            title: "Automate invoice processing",
            description: "Reduce repeatable invoice handling.",
            priority: "high",
            category: "quick_wins",
            roadmapPhase: "phase_1",
            priorityScore: 80,
            expectedRoi: 200.45678,
            roiSpecialValue: null,
            confidence: 90,
            implementationCost: 1000,
          },
        ]}
      />,
    );
    expect(html).toContain("Plan d’action Optivos");
    expect(html).toContain("Automatiser le traitement des factures");
    expect(html).toContain("Réduire les tâches répétitives");
    expect(html).toContain("Indice interne");
    expect(html).not.toContain("Automate invoice");
    expect(html).toContain("Feuille de route exécutive");
    expect(html).toContain("Top 3 à examiner en premier");
    expect(html).toContain("À examiner en premier");
    expect(html).not.toContain("Priorité immédiate");
    expect(html).toContain("pas par date de mise en œuvre");
    expect(html).toContain("corrections et validations requises");
    expect(html).toContain("Coût de mise en œuvre estimé");
    expect(html).toContain("formation, l’infrastructure et la maintenance");
    expect(html).not.toContain("Decision Center");
    expect(html).toContain("Conditions / prérequis");
    expect(html).toContain("200,5%");
    expect(html).not.toContain("200.45678");
    expect(html.match(/<article /g)).toHaveLength(1);
    expect(html).toContain('href="#action-r"');
    expect(html).toContain('id="action-r"');
    expect(html).toContain("Brouillon — à vérifier");
    expect(html).not.toContain("plan validé");
    expect(html).not.toContain("Aucun prérequis additionnel");
    expect(html).toContain("Score de priorité");
    expect(html).toContain("ne constituent pas une autorisation d’automatiser");
    expect(html).toContain('href="/companies/company-1/automation-audit/decision-center"');
    expect(html).toContain("Leur absence sur cette page ne signifie pas qu’ils sont satisfaits");
  });
  it.each([
    ["validated", "Validé — à publier"],
    ["published", "Publié"],
    ["archived", "Archivé"],
    ["unknown", "Non confirmé"],
  ])("renders the actual %s portfolio status without inferring approval", (status, label) => {
    const html = renderToStaticMarkup(
      <ExecutiveRoadmap recommendations={[]} status={status} companyId="company-1" />,
    );
    expect(html).toContain(label);
    expect(html).toContain("ne constituent pas une autorisation d’automatiser");
  });
});
