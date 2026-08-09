export type ScenarioType = "conservative" | "expected" | "optimistic";
export type AssumptionCode =
  | "hourly_cost"
  | "working_days"
  | "working_hours"
  | "monthly_frequency"
  | "annual_frequency"
  | "hours_saved_per_occurrence"
  | "implementation_cost"
  | "maintenance_cost"
  | "training_cost"
  | "infrastructure_cost"
  | "error_cost";

export interface RoiAssumptionDefinition {
  id: string;
  code: AssumptionCode;
  version: number;
  unit: string;
  defaultValue: number | null;
  required: boolean;
}
export interface RoiModelDefinition {
  id: string;
  code: string;
  version: number;
  formula: Record<string, unknown>;
  requiredInputs: string[];
  outputs: string[];
}
export interface RoiOpportunityInput {
  id: string;
  identifier: string;
  title: string;
  description: string;
  automationCoverage: number;
  confidence: number;
  evidence: { id: string; businessFindingId: string; knowledgeFactId: string }[];
  aiOpportunityIds: string[];
}
export interface RoiInput {
  automationSnapshotId: string;
  automationStatus: string;
  aiSnapshotId: string;
  aiStatus: string;
  analysisId: string;
  analysisStatus: string;
  processMapId: string;
  processMapStatus: string;
  knowledgeSnapshotId: string;
  currency: string;
  suppliedAssumptions: Partial<Record<AssumptionCode, number>>;
  unknownAssumptions: AssumptionCode[];
  opportunities: RoiOpportunityInput[];
  models: RoiModelDefinition[];
  assumptions: RoiAssumptionDefinition[];
}
export interface RoiMetricResult {
  code: string;
  value: number | null;
  specialValue: "unbounded" | "not_recovered" | null;
  unit: string;
  calculation: Record<string, unknown>;
}
export interface RoiEvaluationResult {
  opportunity: RoiOpportunityInput;
  confidence: number;
  metrics: RoiMetricResult[];
  contributions: {
    assumption: RoiAssumptionDefinition;
    inputValue: number;
    contribution: number;
    calculation: Record<string, unknown>;
  }[];
}
export interface RoiScenarioResult {
  type: ScenarioType;
  volumeFactor: number;
  costFactor: number;
  model: RoiModelDefinition;
  assumptions: {
    definition: RoiAssumptionDefinition;
    value: number;
    source: "provided" | "catalog_default";
  }[];
  evaluations: RoiEvaluationResult[];
}

const SCENARIOS: Record<ScenarioType, { volume: number; cost: number }> = {
  conservative: { volume: 0.75, cost: 1.2 },
  expected: { volume: 1, cost: 1 },
  optimistic: { volume: 1.25, cost: 0.9 },
};

export class RoiEvaluationEngine {
  evaluate(input: RoiInput) {
    const model = input.models.find((item) => item.code === "automation_economic_impact");
    const resolved = this.resolveAssumptions(input);
    const scenarios =
      model && resolved
        ? (Object.entries(SCENARIOS) as [ScenarioType, { volume: number; cost: number }][]).map(
            ([type, factors]) => this.scenario(type, factors, model, resolved, input.opportunities),
          )
        : [];
    return {
      scenarios,
      validations: this.validate(input, scenarios),
      catalogVersions: {
        models: input.models.map(({ id, code, version }) => ({ id, code, version })),
        assumptions: input.assumptions.map(({ id, code, version }) => ({ id, code, version })),
      },
    };
  }
  rebuild(input: RoiInput) {
    return this.evaluate(input);
  }
  publish<T>(value: T) {
    return Object.freeze(value);
  }
  validate(input: RoiInput, scenarios: RoiScenarioResult[]) {
    const errors: { code: string; severity: "error" | "information"; message: string }[] = [];
    if (input.automationStatus !== "published")
      errors.push(
        error("automation_not_published", "Source Automation Opportunity must be published"),
      );
    if (input.aiStatus !== "published")
      errors.push(error("ai_not_published", "Source AI Opportunity must be published"));
    if (input.analysisStatus !== "published")
      errors.push(error("analysis_not_published", "Source Business Analysis must be published"));
    if (input.processMapStatus !== "published")
      errors.push(error("process_not_published", "Source Process Map must be published"));
    if (!input.models.some((item) => item.code === "automation_economic_impact"))
      errors.push(error("unknown_model", "ROI model is unavailable"));
    const missing = input.assumptions.filter(
      (definition) => definition.required && this.value(definition, input) === null,
    );
    if (missing.length)
      errors.push(
        error(
          "unknown_assumption",
          `Missing assumptions: ${missing.map((item) => item.code).join(", ")}`,
        ),
      );
    for (const scenario of scenarios)
      for (const evaluation of scenario.evaluations) {
        if (!evaluation.opportunity.evidence.length)
          errors.push(
            error("missing_evidence", `${evaluation.opportunity.identifier} has no evidence`),
          );
        if (evaluation.metrics.length !== 13)
          errors.push(
            error("missing_metric", `${evaluation.opportunity.identifier} has incomplete metrics`),
          );
      }
    return errors.length
      ? errors
      : [{ code: "roi_valid", severity: "information" as const, message: "ROI validation passed" }];
  }
  private resolveAssumptions(input: RoiInput) {
    const values = input.assumptions.map((definition) => {
      if (input.unknownAssumptions.includes(definition.code)) return null;
      const provided = input.suppliedAssumptions[definition.code];
      const value = provided ?? definition.defaultValue;
      return value === null || value === undefined
        ? null
        : {
            definition,
            value,
            source: provided !== undefined ? ("provided" as const) : ("catalog_default" as const),
          };
    });
    return values.some((item) => item === null)
      ? null
      : (values as NonNullable<(typeof values)[number]>[]);
  }
  private value(definition: RoiAssumptionDefinition, input: RoiInput) {
    if (input.unknownAssumptions.includes(definition.code)) return null;
    return input.suppliedAssumptions[definition.code] ?? definition.defaultValue;
  }
  private scenario(
    type: ScenarioType,
    factors: { volume: number; cost: number },
    model: RoiModelDefinition,
    assumptions: NonNullable<ReturnType<RoiEvaluationEngine["resolveAssumptions"]>>,
    opportunities: RoiOpportunityInput[],
  ): RoiScenarioResult {
    const base = Object.fromEntries(
      assumptions.map((item) => [item.definition.code, item.value]),
    ) as Record<AssumptionCode, number>;
    return {
      type,
      volumeFactor: factors.volume,
      costFactor: factors.cost,
      model,
      assumptions,
      evaluations: opportunities.map((opportunity) =>
        this.calculate(opportunity, assumptions, base, factors, model),
      ),
    };
  }
  private calculate(
    opportunity: RoiOpportunityInput,
    assumptions: RoiScenarioResult["assumptions"],
    base: Record<AssumptionCode, number>,
    factors: { volume: number; cost: number },
    model: RoiModelDefinition,
  ): RoiEvaluationResult {
    const frequency = base.annual_frequency || base.monthly_frequency * 12;
    const coverage = opportunity.automationCoverage / 100;
    const annualHoursSaved =
      base.hours_saved_per_occurrence * frequency * factors.volume * coverage;
    const monthlyHoursSaved = annualHoursSaved / 12;
    const annualCostSaved = annualHoursSaved * base.hourly_cost;
    const monthlyCostSaved = annualCostSaved / 12;
    const implementationCost = base.implementation_cost * factors.cost;
    const trainingCost = base.training_cost * factors.cost;
    const infrastructureCost = base.infrastructure_cost * factors.cost;
    const maintenanceCost = base.maintenance_cost * factors.cost;
    const avoidedErrorCost = base.error_cost * frequency * factors.volume * coverage;
    const annualBenefit = annualCostSaved + avoidedErrorCost;
    const initialCost = implementationCost + trainingCost + infrastructureCost;
    const annualNetBenefit = annualBenefit - maintenanceCost;
    const roi =
      initialCost === 0
        ? annualNetBenefit > 0
          ? null
          : 0
        : ((annualNetBenefit - initialCost) / initialCost) * 100;
    const monthlyNetBenefit = annualBenefit / 12 - maintenanceCost / 12;
    const payback = monthlyNetBenefit > 0 ? initialCost / monthlyNetBenefit : null;
    const completeness = assumptions.length ? 100 : 0;
    const evidenceConfidence = opportunity.evidence.length ? 100 : 0;
    const confidence = round(
      opportunity.confidence * 0.5 + evidenceConfidence * 0.25 + completeness * 0.25,
    );
    const values: [string, number | null, string, "unbounded" | "not_recovered" | null][] = [
      ["annual_hours_saved", annualHoursSaved, "hours/year", null],
      ["monthly_hours_saved", monthlyHoursSaved, "hours/month", null],
      ["annual_cost_saved", annualCostSaved, "currency/year", null],
      ["monthly_cost_saved", monthlyCostSaved, "currency/month", null],
      ["implementation_cost", implementationCost, "currency", null],
      ["maintenance_cost", maintenanceCost, "currency/year", null],
      ["training_cost", trainingCost, "currency", null],
      ["infrastructure_cost", infrastructureCost, "currency", null],
      ["annual_benefit", annualBenefit, "currency/year", null],
      ["annual_net_benefit", annualNetBenefit, "currency/year", null],
      ["payback_period", payback, "months", payback === null ? "not_recovered" : null],
      [
        "roi_percentage",
        roi,
        "percent",
        initialCost === 0 && annualNetBenefit > 0 ? "unbounded" : null,
      ],
      ["confidence", confidence, "percent", null],
    ];
    return {
      opportunity,
      confidence,
      metrics: values.map(([code, value, unit, specialValue]) => ({
        code,
        value: value === null ? null : roundMoney(value),
        specialValue,
        unit,
        calculation: {
          model: { id: model.id, code: model.code, version: model.version },
          factors,
          formula: model.formula,
          inputs: base,
        },
      })),
      contributions: assumptions.map((item) => ({
        assumption: item.definition,
        inputValue: item.value,
        contribution: item.value,
        calculation: { source: item.source, scenarioFactors: factors },
      })),
    };
  }
}
function error(code: string, message: string) {
  return { code, severity: "error" as const, message };
}
function round(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}
function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}
