export type Priority = "critical" | "high" | "medium" | "low" | "future";
export type Category =
  | "quick_wins"
  | "strategic_projects"
  | "high_roi"
  | "low_investment"
  | "ai_first"
  | "automation_first"
  | "operational_excellence"
  | "compliance"
  | "risk_reduction"
  | "long_term";
export type Phase = "phase_1" | "phase_2" | "phase_3" | "phase_4";
export interface RecommendationRule {
  id: string;
  code: string;
  version: number;
  title: string;
  description: string;
  category: Category;
  precedence: number;
  dependencies: string[];
  initiativeTemplate: string;
  benefitTemplate: string;
}
export interface PriorityDefinition {
  id: string;
  code: string;
  version: number;
  formula: Record<string, number>;
  thresholds: Record<Priority, number>;
}
export interface RecommendationCandidate {
  id: string;
  identifier: string;
  title: string;
  description: string;
  businessProblem: string;
  roiEvaluationId: string;
  roiScenarioId: string;
  metricCount: number;
  roi: number | null;
  roiSpecialValue: string | null;
  implementationCost: number;
  payback: number | null;
  annualBenefit: number;
  businessImpact: number;
  feasibility: number;
  complexity: number;
  confidence: number;
  operationalRisk: number;
  automationReadiness: number;
  hasAi: boolean;
  findingCategories: string[];
  evidence: { id: string; businessFindingId: string; knowledgeFactId: string }[];
  processIds: string[];
  departmentIds: string[];
  systemIds: string[];
}
export interface RecommendationInput {
  roiSnapshotId: string;
  roiStatus: string;
  automationSnapshotId: string;
  automationStatus: string;
  aiStatus: string;
  analysisStatus: string;
  processStatus: string;
  knowledgeSnapshotId: string;
  candidates: RecommendationCandidate[];
  rules: RecommendationRule[];
  priorityDefinitions: PriorityDefinition[];
}
export interface RecommendationResult {
  candidate: RecommendationCandidate;
  rule: RecommendationRule;
  priorityDefinition: PriorityDefinition;
  identifier: string;
  category: Category;
  priority: Priority;
  priorityScore: number;
  roadmapPhase: Phase;
  dependencyIdentifiers: string[];
  contributions: {
    component: string;
    rawValue: number;
    normalizedValue: number;
    weight: number;
    weightedContribution: number;
  }[];
}
const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low", "future"];
export class RecommendationPortfolioEngine {
  generate(input: RecommendationInput) {
    const definition = input.priorityDefinitions.find((item) => item.code === "portfolio_priority");
    const median = medianValue(input.candidates.map((item) => item.implementationCost));
    const partial = definition
      ? input.candidates.map((candidate) => this.build(candidate, input.rules, definition, median))
      : [];
    const byRule = new Map(partial.map((item) => [item.rule.code, item]));
    const errors: { code: string; severity: "error" | "information"; message: string }[] = [];
    for (const item of partial) {
      item.dependencyIdentifiers = item.rule.dependencies.map(
        (code) => byRule.get(code)?.identifier ?? `missing:${code}`,
      );
    }
    const cycle = this.assignPhases(partial);
    if (cycle)
      errors.push(error("dependency_cycle", "Recommendation dependency graph contains a cycle"));
    const recommendations = partial.sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        (b.candidate.roi ?? Number.MAX_VALUE) - (a.candidate.roi ?? Number.MAX_VALUE) ||
        b.candidate.businessImpact - a.candidate.businessImpact ||
        a.identifier.localeCompare(b.identifier),
    );
    errors.push(...this.validate(input, recommendations));
    return {
      recommendations,
      validations: errors.length
        ? errors
        : [
            {
              code: "recommendation_portfolio_valid",
              severity: "information" as const,
              message: "Recommendation portfolio validation passed",
            },
          ],
      catalogVersions: {
        rules: input.rules.map(({ id, code, version }) => ({ id, code, version })),
        priorityDefinitions: input.priorityDefinitions.map(({ id, code, version }) => ({
          id,
          code,
          version,
        })),
      },
    };
  }
  rebuild(input: RecommendationInput) {
    return this.generate(input);
  }
  publish<T>(value: T) {
    return Object.freeze(value);
  }
  validate(input: RecommendationInput, items: RecommendationResult[]) {
    const values: { code: string; severity: "error"; message: string }[] = [];
    if (input.roiStatus !== "published")
      values.push(error("roi_not_published", "Source ROI must be published"));
    if (input.automationStatus !== "published")
      values.push(
        error("automation_not_published", "Source Automation Opportunity must be published"),
      );
    if (
      input.aiStatus !== "published" ||
      input.analysisStatus !== "published" ||
      input.processStatus !== "published"
    )
      values.push(error("source_unpublished", "All canonical source snapshots must be published"));
    if (!input.priorityDefinitions.length)
      values.push(error("unknown_priority_definition", "Priority definition is unavailable"));
    for (const item of items) {
      if (!item.candidate.evidence.length)
        values.push(error("missing_evidence", `${item.identifier} has no evidence`));
      if (item.candidate.roi === null && item.candidate.roiSpecialValue !== "unbounded")
        values.push(error("missing_roi", `${item.identifier} has no ROI`));
      if (item.candidate.metricCount !== 13)
        values.push(
          error(
            "incomplete_roi_metrics",
            `${item.identifier} must reference exactly 13 published ROI metrics`,
          ),
        );
      if (item.dependencyIdentifiers.some((id) => id.startsWith("missing:")))
        values.push(error("missing_dependency", `${item.identifier} has unresolved dependencies`));
    }
    return values;
  }
  private build(
    candidate: RecommendationCandidate,
    rules: RecommendationRule[],
    definition: PriorityDefinition,
    median: number,
  ): RecommendationResult {
    const rule =
      [...rules]
        .sort((a, b) => a.precedence - b.precedence)
        .find((item) => this.matches(item.category, candidate, median)) ??
      rules.find((item) => item.category === "long_term")!;
    const roiNormalized =
      candidate.roiSpecialValue === "unbounded" ? 100 : clamp(((candidate.roi ?? -100) + 100) / 4);
    const components = {
      roi: roiNormalized,
      business_impact: candidate.businessImpact,
      feasibility: candidate.feasibility,
      inverse_complexity: 100 - candidate.complexity,
      operational_risk: candidate.operationalRisk,
      confidence: candidate.confidence,
    };
    const contributions = Object.entries(components).map(([component, normalizedValue]) => {
      const weight = definition.formula[component] ?? 0;
      return {
        component,
        rawValue: component === "roi" ? (candidate.roi ?? 100) : normalizedValue,
        normalizedValue,
        weight,
        weightedContribution: normalizedValue * weight,
      };
    });
    const priorityScore = round(
      contributions.reduce((sum, item) => sum + item.weightedContribution, 0),
    );
    const priority =
      PRIORITY_ORDER.find((level) => priorityScore >= definition.thresholds[level]) ?? "future";
    return {
      candidate,
      rule,
      priorityDefinition: definition,
      identifier: `${rule.code}:${candidate.identifier}`,
      category: rule.category,
      priority,
      priorityScore,
      roadmapPhase: "phase_1",
      dependencyIdentifiers: [],
      contributions,
    };
  }
  private matches(category: Category, c: RecommendationCandidate, median: number) {
    switch (category) {
      case "quick_wins":
        return (
          (c.roiSpecialValue === "unbounded" || (c.roi ?? -Infinity) > 150) &&
          c.complexity <= 40 &&
          c.feasibility >= 60
        );
      case "compliance":
        return c.findingCategories.some((item) => item.toLowerCase().includes("compliance"));
      case "risk_reduction":
        return c.operationalRisk >= 75;
      case "ai_first":
        return c.hasAi;
      case "automation_first":
        return !c.hasAi;
      case "strategic_projects":
        return c.businessImpact >= 75 && c.complexity >= 60;
      case "high_roi":
        return c.roiSpecialValue === "unbounded" || (c.roi ?? -Infinity) > 150;
      case "low_investment":
        return c.implementationCost <= median;
      case "operational_excellence":
        return c.automationReadiness >= 70;
      case "long_term":
        return true;
    }
  }
  private assignPhases(items: RecommendationResult[]) {
    const byId = new Map(items.map((item) => [item.identifier, item]));
    const visiting = new Set<string>(),
      done = new Set<string>();
    let cycle = false;
    const visit = (item: RecommendationResult): number => {
      if (visiting.has(item.identifier)) {
        cycle = true;
        return 0;
      }
      if (done.has(item.identifier)) return Number(item.roadmapPhase.slice(-1));
      visiting.add(item.identifier);
      let depth = 0;
      for (const id of item.dependencyIdentifiers) {
        const dependency = byId.get(id);
        if (dependency) depth = Math.max(depth, visit(dependency));
      }
      visiting.delete(item.identifier);
      done.add(item.identifier);
      const phase = Math.min(depth + 1, 4);
      item.roadmapPhase = `phase_${phase}` as Phase;
      return phase;
    };
    items.forEach(visit);
    return cycle;
  }
}
function error(code: string, message: string) {
  return { code, severity: "error" as const, message };
}
function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}
function medianValue(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
