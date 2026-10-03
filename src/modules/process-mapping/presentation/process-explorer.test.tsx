import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProcessMapView, type ProcessMapDetail } from "./process-explorer";

function fixture(): ProcessMapDetail {
  return {
    map: {
      id: "map",
      name: "Traitement des factures",
      status: "draft",
      versionNumber: 1,
      processPatternVersion: 1,
      completenessPercentage: "90",
      confidencePercentage: "100",
      coveragePercentage: "100",
      readyForBusinessIntelligence: true,
      createdAt: "2026-10-03",
    },
    nodes: [
      {
        id: "a",
        nodeKey: "internal-a",
        nodeType: "step",
        name: "Recevoir la facture",
        description: null,
        sequence: 0,
        executionMode: "manual",
        estimatedDurationMinutes: "6",
        actorKnowledgeNodeId: null,
        frequency: null,
        knowledgeFactIds: ["fact"],
        attributesJson: null,
      },
      {
        id: "b",
        nodeKey: "internal-b",
        nodeType: "decision",
        name: "Approuver",
        description: null,
        sequence: 1,
        executionMode: null,
        estimatedDurationMinutes: null,
        actorKnowledgeNodeId: null,
        frequency: null,
        knowledgeFactIds: [],
        attributesJson: { executionMetadataProjection: { requiresHumanValidation: true } },
      },
    ],
    edges: [],
    ownership: null,
    validations: [
      {
        id: "v",
        code: "valid",
        severity: "information",
        message: "Graph validation passed",
        nodeKey: null,
      },
    ],
    factUsage: [],
  };
}

describe("ProcessMapView", () => {
  it("separates the process total from unknown individual step durations", () => {
    const detail = fixture();
    detail.nodes[0]!.estimatedDurationMinutes = null;
    detail.nodes[0]!.attributesJson = {
      executionMetadataProjection: {
        processDurationMinutes: 12,
        durationSemantic: "process_total_minutes_not_step_measurement",
      },
    };
    const html = renderToStaticMarkup(
      <ProcessMapView detail={detail} selected="a" onSelect={() => {}} />,
    );
    expect(html).toContain("Durée de cette étape");
    expect(html).toContain("Inconnue");
    expect(html).toContain("12 min — pas une mesure de chaque étape");
  });
  it("uses readable French responsive cards without an invented graph or readiness claim", () => {
    const detail = fixture();
    const before = JSON.stringify(detail);
    const html = renderToStaticMarkup(
      <ProcessMapView detail={detail} selected="a" onSelect={() => {}} />,
    );
    expect(html).toContain("Brouillon");
    expect(html).toContain("Les étapes de votre processus");
    expect(html).toContain("Validation humaine requise");
    expect(html).toContain("aucune automatisation");
    expect(html).toContain("pas une probabilité de réussite");
    expect(html).toContain("Aucune transition sortante enregistrée");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("Graph view");
    expect(html).toContain("Détails techniques de traçabilité");
    expect(JSON.stringify(detail)).toBe(before);
  });
  it("displays only actual outgoing edges and does not infer a human requirement", () => {
    const detail = fixture();
    detail.edges = [{ id: "e", fromNodeId: "b", toNodeId: "a", edgeType: "flow" }];
    detail.nodes[1]!.attributesJson = null;
    const html = renderToStaticMarkup(
      <ProcessMapView detail={detail} selected="b" onSelect={() => {}} />,
    );
    expect(html).toContain("Vers Recevoir la facture");
    expect(html).toContain("Non renseignée");
    expect(html).not.toContain("Validation humaine requise");
  });
});
