import { describe, expect, it } from "vitest";
import {
  RecommendationPortfolioEngine,
  type RecommendationInput,
  type RecommendationRule,
} from "./recommendation-engine";
const rules: RecommendationRule[] = [
  "quick_wins",
  "compliance",
  "risk_reduction",
  "ai_first",
  "automation_first",
  "strategic_projects",
  "high_roi",
  "low_investment",
  "operational_excellence",
  "long_term",
].map((category, index) => ({
  id: category,
  code: category,
  version: 1,
  title: category,
  description: category,
  category: category as RecommendationRule["category"],
  precedence: index + 1,
  dependencies: [],
  initiativeTemplate: "Implement",
  benefitTemplate: "Benefit",
}));
const input = (): RecommendationInput => ({
  roiSnapshotId: "roi",
  roiStatus: "published",
  automationSnapshotId: "automation",
  automationStatus: "published",
  aiStatus: "published",
  analysisStatus: "published",
  processStatus: "published",
  knowledgeSnapshotId: "knowledge",
  rules,
  priorityDefinitions: [
    {
      id: "priority",
      code: "portfolio_priority",
      version: 1,
      formula: {
        roi: 0.3,
        business_impact: 0.25,
        feasibility: 0.15,
        inverse_complexity: 0.1,
        operational_risk: 0.1,
        confidence: 0.1,
      },
      thresholds: { critical: 85, high: 70, medium: 50, low: 30, future: 0 },
    },
  ],
  candidates: [
    {
      id: "o",
      identifier: "invoice",
      title: "Invoice",
      description: "Automate",
      businessProblem: "Manual",
      roiEvaluationId: "evaluation",
      roiScenarioId: "scenario",
      metricCount: 13,
      roi: 200,
      roiSpecialValue: null,
      implementationCost: 1000,
      payback: 3,
      annualBenefit: 5000,
      businessImpact: 80,
      feasibility: 80,
      complexity: 30,
      confidence: 90,
      operationalRisk: 50,
      automationReadiness: 85,
      hasAi: false,
      findingCategories: ["operations"],
      evidence: [{ id: "e", businessFindingId: "f", knowledgeFactId: "k" }],
      processIds: [],
      departmentIds: [],
      systemIds: [],
    },
  ],
});
describe("RecommendationPortfolioEngine", () => {
  const engine = new RecommendationPortfolioEngine();
  it("classifies quick wins and calculates explicit priority", () => {
    const item = engine.generate(input()).recommendations[0]!;
    expect(item.category).toBe("quick_wins");
    expect(item.priorityScore).toBe(75.5);
    expect(item.priority).toBe("high");
    expect(item.roadmapPhase).toBe("phase_1");
    expect(item.contributions).toHaveLength(6);
  });
  it("uses unbounded ROI as normalized 100", () => {
    const value = input();
    value.candidates[0]!.roi = null;
    value.candidates[0]!.roiSpecialValue = "unbounded";
    expect(engine.generate(value).recommendations[0]?.contributions[0]?.normalizedValue).toBe(100);
  });
  it("blocks unpublished sources", () => {
    const value = input();
    value.roiStatus = "draft";
    expect(engine.generate(value).validations[0]?.code).toBe("roi_not_published");
  });
  it("blocks incomplete ROI metric sets", () => {
    const value = input();
    value.candidates[0]!.metricCount = 12;
    expect(engine.generate(value).validations).toContainEqual(
      expect.objectContaining({ code: "incomplete_roi_metrics" }),
    );
  });
  it("assigns roadmap phases from catalog dependencies", () => {
    const value = input();
    value.rules = value.rules.map((rule) =>
      rule.code === "quick_wins" ? { ...rule, dependencies: ["automation_first"] } : rule,
    );
    value.candidates.push({
      ...value.candidates[0]!,
      id: "o2",
      identifier: "archive",
      roiEvaluationId: "evaluation2",
      roi: 10,
      complexity: 60,
    });
    const result = engine.generate(value);
    expect(
      result.recommendations.find((item) => item.candidate.identifier === "invoice")?.roadmapPhase,
    ).toBe("phase_2");
    expect(
      result.recommendations.find((item) => item.candidate.identifier === "archive")?.roadmapPhase,
    ).toBe("phase_1");
  });
  it("rejects cyclic catalog dependencies", () => {
    const value = input();
    value.rules = value.rules.map((rule) => {
      if (rule.code === "quick_wins") return { ...rule, dependencies: ["automation_first"] };
      if (rule.code === "automation_first") return { ...rule, dependencies: ["quick_wins"] };
      return rule;
    });
    value.candidates.push({
      ...value.candidates[0]!,
      id: "o2",
      identifier: "archive",
      roiEvaluationId: "evaluation2",
      roi: 10,
      complexity: 60,
    });
    expect(engine.generate(value).validations).toContainEqual(
      expect.objectContaining({ code: "dependency_cycle" }),
    );
  });
  it("is deterministic on rebuild", () =>
    expect(engine.rebuild(input())).toEqual(engine.generate(input())));
});
