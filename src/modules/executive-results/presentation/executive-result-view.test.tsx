import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExecutiveAuditResult } from "../application/executive-result-model";
import { ExecutiveResultView } from "./executive-result-view";
import { attributableEvaluation, repeatedEstimates } from "./result-economics";

describe("Executive Result", () => {
  it.each([
    ["Factures fournisseurs", "Le contrôle des montants bloque la validation."],
    ["Demandes clients", "Les demandes attendent une affectation à une équipe."],
    ["Suivi des stocks", "Les quantités déclarées ne correspondent pas au relevé."],
  ])("grounds the brief in the current dossier for %s, not a shared example", (title, problem) => {
    const value = result();
    value.findings = [
      {
        id: "current-finding",
        title,
        description: problem,
        severity: "critical",
        impact: "Vérifier la source et les contrôles",
      },
    ];
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    const brief = html.split('aria-labelledby="decision-brief-title"')[1]!.split("</section>")[0]!;
    expect(brief).toContain(title);
    expect(brief).toContain(problem);
    expect(brief).toContain("Corriger avant d’automatiser");
    const heading = brief.split('id="decision-brief-title"')[1]!.split("</h2>")[0]!;
    expect(heading).toContain(title);
    expect(heading).not.toContain("First canonical opportunity");
    // Dossier-wide warnings remain visible, including other opportunities in this audit.
    expect(brief).toContain("Les preuves et prérequis doivent être reliés");
    expect(brief).not.toContain("1200");
    expect(brief).toContain("/analysis/analysis");
  });
  it("does not attribute economics by matching titles or duplicate opportunity associations", () => {
    const value = result();
    const evaluation = value.roi!.evaluations[0]!;
    expect(attributableEvaluation(value, evaluation)).toBe(true);
    delete evaluation.automationOpportunityId;
    expect(attributableEvaluation(value, evaluation)).toBe(false);
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    expect(html).toContain("Estimation non attribuable");
    expect(html).not.toContain(`${(1200).toLocaleString("fr-FR")} EUR`);
    evaluation.automationOpportunityId = "other-company-opportunity";
    expect(attributableEvaluation(value, evaluation)).toBe(false);
    evaluation.automationOpportunityId = "first";
    value.roi!.evaluations.push({ ...evaluation, id: "duplicate" });
    expect(attributableEvaluation(value, evaluation)).toBe(false);
  });

  it("flags identical estimates without changing them or concluding they are independent savings", () => {
    const value = result();
    expect(repeatedEstimates(value)).toBe(false);
    value.roi!.evaluations.push({
      ...value.roi!.evaluations[0]!,
      id: "second-evaluation",
      automationOpportunityId: "second",
    });
    const before = structuredClone(value);
    expect(repeatedEstimates(value)).toBe(true);
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    expect(html).toContain("Plusieurs pistes affichent les mêmes estimations");
    expect(html).toContain("ni une erreur de calcul");
    expect(value).toEqual(before);
    value.roi!.evaluations[1]!.annualBenefit = 3000;
    expect(repeatedEstimates(value)).toBe(false);
  });

  it("keeps special economic states and invalid numbers readable without inventing values", () => {
    const value = result();
    value.roi!.evaluations[0]!.roiSpecialValue = "unbounded";
    value.roi!.evaluations[0]!.annualBenefit = Number.NaN;
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    expect(html).toContain("Ratio non borné");
    expect(html).not.toContain("unbounded");
    expect(html).not.toContain("NaN");
    expect(html).toContain("Données complémentaires requises");
  });
  it("separates a risk description from the proposed treatment", () => {
    const value = result();
    value.findings = [
      {
        id: "f",
        title: "Manual invoice processing",
        severity: "high",
        description: "Invoices are processed manually.",
        impact: "Automate invoice processing",
      },
    ];
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    expect(html).toContain("Les factures sont traitées manuellement.");
    expect(html).toContain("Piste de traitement à examiner");
    expect(html).not.toContain("Automate invoice processing");
  });
  it("uses canonical safety states rather than recommendation titles", () => {
    const html = renderToStaticMarkup(<ExecutiveResultView result={result()} />);
    expect(html).toContain("Données supplémentaires requises");
    expect(html).toContain("Même état canonique que le centre de décision");
    expect(html).not.toContain("Top 3 décisions");
    expect(html).not.toContain("Automatiser maintenant");
    expect(html).toContain("ne doivent pas être additionnés");
  });
  it("offers real feedback and keeps supplementary detail collapsed", () => {
    const html = renderToStaticMarkup(<ExecutiveResultView result={result()} />);
    expect(html).toContain("Donner mon avis");
    expect(html).not.toContain("Aucun stockage feedback");
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Plan d’action recommandé/);
    expect(html).not.toMatch(/<details[^>]*open/);
    expect(html).toContain("L’audit ne déploie aucune automatisation");
  });
  it("renders only published canonical facts and preserves their order and provenance", () => {
    const html = renderToStaticMarkup(<ExecutiveResultView result={result()} />);
    expect(html).toContain("Canonical Company");
    expect(html.indexOf("First canonical opportunity")).toBeLessThan(
      html.indexOf("Second canonical opportunity"),
    );
    expect(html).toContain("Published recommendation");
    expect(html).toContain(`${(1200).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} EUR`);
    expect(html).toContain("Retour sur investissement");
    expect(html).toContain("Délai estimé de rentabilité");
    expect(html).toContain("/process-maps/process-map");
    expect(html).toContain("/roi/roi");
    expect(html).toContain("/recommendations/recommendations");
    expect(html).toContain("gains garantis");
  });

  it("renders unavailable ROI as unavailable rather than zero", () => {
    const value = result();
    value.roi!.evaluations[0]!.annualBenefit = null;
    value.roi!.evaluations[0]!.roi = null;
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    expect(html).toContain("Données complémentaires requises");
    expect(html).not.toContain("0.00 EUR");
  });

  it("does not expose final results for an incomplete audit", () => {
    const value = result();
    value.complete = false;
    const html = renderToStaticMarkup(<ExecutiveResultView result={value} />);
    expect(html).toContain("Résultats Optivos non disponibles");
    expect(html).not.toContain("Published recommendation");
    expect(html).toContain("/companies/company/automation-audit");
  });
});

function result(): ExecutiveAuditResult {
  const artifact = (id: string) => ({ id, version: 1, status: "published", lockVersion: 2 });
  return {
    company: { id: "company", name: "Canonical Company" },
    complete: true,
    audit: {
      company: { id: "company", name: "Canonical Company" },
      overallStatus: "COMPLETED",
      currentStage: "COMPLETED",
      nextAction: "VIEW_RESULTS",
      blockingReason: null,
      stages: [
        {
          stage: "PROCESS_MAP",
          label: "Processus",
          status: "COMPLETED",
          artifact: artifact("process-map"),
          candidateArtifacts: [],
          availableActions: [],
          blockingReason: null,
        },
      ],
    },
    overview: { processes: 1, findings: 2, opportunities: 2, recommendations: 1 },
    process: { id: "process-map", name: "Order processing" },
    findings: [],
    opportunities: [
      {
        id: "first",
        title: "First canonical opportunity",
        problem: "Manual work",
        impact: 80,
        readiness: 70,
        confidence: 90,
      },
      {
        id: "second",
        title: "Second canonical opportunity",
        problem: "Waiting",
        impact: 60,
        readiness: 50,
        confidence: 80,
      },
    ],
    roi: {
      id: "roi",
      currency: "EUR",
      evaluations: [
        {
          id: "evaluation",
          automationOpportunityId: "first",
          title: "First canonical opportunity",
          annualBenefit: 1200,
          roi: 150,
          roiSpecialValue: null,
          payback: 4,
        },
      ],
    },
    recommendations: [
      {
        id: "recommendation",
        title: "Published recommendation",
        action: "Automate the approved process",
        description: "Based on published evidence",
        priority: "high",
        phase: "now",
        expectedRoi: 150,
        roiSpecialValue: null,
        payback: 4,
        confidence: 90,
      },
    ],
    provenance: {
      processMapId: artifact("process-map").id,
      analysisId: "analysis",
      automationOpportunitySnapshotId: "automation",
      roiId: "roi",
      recommendationPortfolioId: "recommendations",
    },
  };
}
