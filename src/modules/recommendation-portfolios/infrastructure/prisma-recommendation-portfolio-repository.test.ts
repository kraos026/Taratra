import { describe, expect, it, vi } from "vitest";
import { PrismaRecommendationPortfolioRepository } from "./prisma-recommendation-portfolio-repository";
import type { RecommendationInput } from "../domain/recommendation-engine";

const input = (): RecommendationInput => ({
  roiSnapshotId: "roi-1",
  roiStatus: "published",
  automationSnapshotId: "automation-1",
  automationStatus: "published",
  aiSnapshotId: "ai-1",
  analysisId: "analysis-1",
  processMapId: "process-1",
  aiStatus: "published",
  analysisStatus: "published",
  processStatus: "published",
  knowledgeSnapshotId: "knowledge-1",
  candidates: [],
  rules: [],
  priorityDefinitions: [],
});

const recommendation = (identifier: string, dependencyIdentifiers: string[] = []) => ({
  identifier,
  category: "quick_wins" as const,
  priority: "high" as const,
  priorityScore: identifier === "invoice" ? 91 : 82,
  roadmapPhase: "phase_1" as const,
  dependencyIdentifiers,
  rule: {
    id: `rule-${identifier}`,
    code: `rule_${identifier}`,
    version: 1,
    title: "Rule",
    description: "Rule",
    category: "quick_wins" as const,
    precedence: 1,
    dependencies: [],
    initiativeTemplate: "Implement safely",
    benefitTemplate: "Reduce manual work",
  },
  priorityDefinition: {
    id: "priority-1",
    code: "portfolio_priority",
    version: 1,
    formula: { roi: 1 },
    thresholds: { critical: 90, high: 70, medium: 50, low: 30, future: 0 },
  },
  candidate: {
    id: `candidate-${identifier}`,
    identifier,
    title: identifier,
    description: "Candidate",
    businessProblem: "Manual work",
    roiEvaluationId: `evaluation-${identifier}`,
    roiScenarioId: "scenario-1",
    metricCount: 13,
    roi: 120,
    roiSpecialValue: null,
    implementationCost: 1000,
    payback: 3,
    annualBenefit: 5000,
    businessImpact: 80,
    feasibility: 75,
    complexity: 25,
    confidence: 70,
    operationalRisk: 50,
    automationReadiness: 85,
    hasAi: false,
    findingCategories: ["operations"],
    evidence: [
      {
        id: `roi-evidence-${identifier}`,
        businessFindingId: `finding-${identifier}`,
        knowledgeFactId: `fact-${identifier}`,
      },
    ],
    processIds: [`process-${identifier}`],
    departmentIds: [`department-${identifier}`],
    systemIds: [`system-${identifier}`],
  },
  contributions: [
    {
      component: "roi",
      rawValue: 120,
      normalizedValue: 100,
      weight: 1,
      weightedContribution: 100,
    },
  ],
});

describe("PrismaRecommendationPortfolioRepository", () => {
  it("persists recommendation portfolios with batched children and no ROI reread", async () => {
    const db = {
      $executeRaw: vi.fn(),
      roiEvaluationSnapshot: { findFirst: vi.fn() },
      recommendationPortfolioSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ versionNumber: 1 }),
        create: vi.fn().mockResolvedValue({ id: "snapshot-2", versionNumber: 2 }),
      },
      transformationRecommendation: {
        create: vi.fn(),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      transformationRecommendationContribution: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      transformationRecommendationEvidence: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      transformationRecommendationDependency: {
        create: vi.fn(),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      recommendationPortfolioValidation: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const repo = new PrismaRecommendationPortfolioRepository(db as never);
    await repo.persist(
      "org-1",
      "company-1",
      "user-1",
      input(),
      {
        recommendations: [recommendation("invoice"), recommendation("archive", ["invoice"])],
        validations: [
          {
            code: "recommendations_generated",
            severity: "information",
            message: "Portfolio generated",
          },
        ],
        catalogVersions: {
          rules: [{ id: "rule-1", code: "rule_invoice", version: 1 }],
          priorityDefinitions: [{ id: "priority-1", code: "portfolio_priority", version: 1 }],
        },
      },
      null,
    );

    expect(db.roiEvaluationSnapshot.findFirst).not.toHaveBeenCalled();
    expect(db.transformationRecommendation.create).not.toHaveBeenCalled();
    expect(db.transformationRecommendation.createMany).toHaveBeenCalledTimes(1);
    expect(db.transformationRecommendationContribution.createMany).toHaveBeenCalledTimes(1);
    expect(db.transformationRecommendationEvidence.createMany).toHaveBeenCalledTimes(1);
    expect(db.transformationRecommendationDependency.create).not.toHaveBeenCalled();
    expect(db.transformationRecommendationDependency.createMany).toHaveBeenCalledTimes(1);

    const recommendationRows = db.transformationRecommendation.createMany.mock.calls[0]?.[0].data;
    expect(recommendationRows.map((row: { identifier: string }) => row.identifier)).toEqual([
      "invoice",
      "archive",
    ]);
    expect(new Set(recommendationRows.map((row: { id: string }) => row.id)).size).toBe(2);

    const dependencyRows =
      db.transformationRecommendationDependency.createMany.mock.calls[0]?.[0].data;
    expect(dependencyRows).toHaveLength(1);
    expect(dependencyRows[0].recommendationId).toBe(recommendationRows[1].id);
    expect(dependencyRows[0].dependsOnId).toBe(recommendationRows[0].id);
  });
});
