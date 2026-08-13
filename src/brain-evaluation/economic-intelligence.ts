export type EconomicStatus = "OBSERVED" | "DERIVED" | "ASSUMED" | "BENCHMARK_PRIOR" | "UNKNOWN";
export type EconomicSignal =
  | "STRONG_VALUE"
  | "POSITIVE_VALUE"
  | "MARGINAL"
  | "ECONOMICALLY_UNCERTAIN"
  | "NEGATIVE_VALUE"
  | "INSUFFICIENT_EVIDENCE";
export type ScenarioKind = "PESSIMISTIC" | "BASE" | "OPTIMISTIC" | "STRESS";
export interface EconomicInput {
  name: string;
  value: number | null;
  unit: string;
  source: string;
  confidence: number;
  status: EconomicStatus;
  supportingEvidenceIds: readonly string[];
  uncertaintyRange?: { min: number; max: number };
}
const bounded = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const input = (
  name: string,
  value: number | null,
  unit: string,
  status: EconomicStatus,
  source: string,
  confidence = 1,
  ids: readonly string[] = [],
  range?: { min: number; max: number },
): EconomicInput =>
  Object.freeze({
    name,
    value,
    unit,
    source,
    confidence: bounded(confidence),
    status,
    supportingEvidenceIds: Object.freeze([...ids]),
    ...(range ? { uncertaintyRange: Object.freeze(range) } : {}),
  });
export class EconomicInputFactory {
  static create(
    name: string,
    value: number | null,
    unit: string,
    status: EconomicStatus,
    source: string,
    confidence = 1,
    ids: readonly string[] = [],
    range?: { min: number; max: number },
  ) {
    if (value !== null && !Number.isFinite(value)) throw new Error("Economic value must be finite");
    return input(name, value, unit, status, source, confidence, ids, range);
  }
}
export interface BaselineResult {
  annualLaborCost: number | null;
  annualErrorCost: number | null;
  annualDelayCost: number | null;
  annualOperationalCost: number | null;
  capacityConsumed: number | null;
  avoidableCost: number | null;
  missingInputs: readonly string[];
  confidence: number;
}
export class BaselineEconomicModel {
  calculate(i: Record<string, EconomicInput>): BaselineResult {
    const get = (n: string) => i[n]?.value ?? null;
    const missing = Object.keys(i).filter((k) => i[k]!.value === null);
    const labor = mul(get("currentLaborTime"), get("laborCost"), get("frequency"), get("volume"));
    const errors = mul(get("errorRate"), get("errorCost"), get("frequency"), get("volume"));
    const delay = mul(get("delayCost"), get("frequency"), get("volume"));
    const op = sum(labor, errors, delay);
    return Object.freeze({
      annualLaborCost: labor,
      annualErrorCost: errors,
      annualDelayCost: delay,
      annualOperationalCost: op,
      capacityConsumed: mul(get("currentLaborTime"), get("frequency"), get("volume")),
      avoidableCost: sum(labor, errors),
      missingInputs: missing,
      confidence: confidence(i),
    });
  }
}
export interface TransformationCost {
  initialImplementationCost: number | null;
  integrationCost: number | null;
  migrationCost: number | null;
  trainingCost: number | null;
  changeManagementCost: number | null;
  securityComplianceCost: number | null;
  recurringCost: number | null;
  infrastructureCost: number | null;
  maintenanceCost: number | null;
  supportCost: number | null;
  monitoringCost: number | null;
  residualHumanValidationCost: number | null;
  totalInitial: number | null;
  totalAnnual: number | null;
}
export class TransformationCostModel {
  calculate(i: Record<string, EconomicInput>): TransformationCost {
    const g = (n: string) => i[n]?.value ?? null;
    const initial = sumKnown(
      g("implementationCost"),
      g("integrationCost"),
      g("migrationCost"),
      g("trainingCost"),
      g("changeManagementCost"),
      g("securityComplianceCost"),
    );
    const annual = sumKnown(
      g("recurringCost"),
      g("infrastructureCost"),
      g("maintenanceCost"),
      g("supportCost"),
      g("monitoringCost"),
      g("residualHumanValidationCost"),
    );
    return Object.freeze({
      initialImplementationCost: g("implementationCost"),
      integrationCost: g("integrationCost"),
      migrationCost: g("migrationCost"),
      trainingCost: g("trainingCost"),
      changeManagementCost: g("changeManagementCost"),
      securityComplianceCost: g("securityComplianceCost"),
      recurringCost: g("recurringCost"),
      infrastructureCost: g("infrastructureCost"),
      maintenanceCost: g("maintenanceCost"),
      supportCost: g("supportCost"),
      monitoringCost: g("monitoringCost"),
      residualHumanValidationCost: g("residualHumanValidationCost"),
      totalInitial: initial,
      totalAnnual: annual,
    });
  }
}
export interface BenefitResult {
  hardSavings: number | null;
  softBenefits: number | null;
  capacityBenefits: number | null;
  riskAvoidance: number | null;
  annualBenefit: number | null;
}
export class BenefitModel {
  calculate(i: Record<string, EconomicInput>): BenefitResult {
    const g = (n: string) => i[n]?.value ?? null;
    const labor = mul(
      g("currentLaborTime"),
      g("laborCost"),
      g("frequency"),
      g("volume"),
      g("expectedTimeReduction"),
      g("expectedAutomationCoverage"),
      g("expectedAdoptionRate"),
    );
    const errors = mul(
      g("errorRate"),
      g("errorCost"),
      g("frequency"),
      g("volume"),
      g("expectedErrorReduction"),
      g("expectedAdoptionRate"),
    );
    const revenue = sum(g("revenueImpact"));
    return Object.freeze({
      hardSavings: sumKnown(labor, errors),
      softBenefits: null,
      capacityBenefits: mul(g("capacityImpact"), g("expectedAdoptionRate")),
      riskAvoidance: revenue,
      annualBenefit: sumKnown(labor, errors, revenue),
    });
  }
}
export interface Evaluation {
  status: "COMPLETE" | "PARTIAL" | "NEED_MORE_EVIDENCE";
  netAnnualBenefit: number | null;
  paybackMonths: number | null;
  roi12: number | null;
  roi24: number | null;
  roi36: number | null;
  confidence: number;
  missingInputs: readonly string[];
  signal: EconomicSignal;
  rationale: string;
}
export class EconomicEvaluation {
  evaluate(
    benefit: BenefitResult,
    cost: TransformationCost,
    confidenceValue: number,
    missing: readonly string[],
  ): Evaluation {
    const net = sum(benefit.annualBenefit, -(cost.totalAnnual ?? 0));
    const payback =
      net !== null && cost.totalInitial !== null && net > 0 ? (cost.totalInitial / net) * 12 : null;
    const roi12 =
      net !== null && cost.totalInitial !== null && cost.totalInitial > 0
        ? (net * 12 - cost.totalInitial) / cost.totalInitial
        : null;
    const status = missing.length
      ? "NEED_MORE_EVIDENCE"
      : net === null || roi12 === null
        ? "PARTIAL"
        : "COMPLETE";
    const signal =
      net === null
        ? "INSUFFICIENT_EVIDENCE"
        : net < 0
          ? "NEGATIVE_VALUE"
          : confidenceValue < 0.5
            ? "ECONOMICALLY_UNCERTAIN"
            : roi12 !== null && roi12 < 0.2
              ? "MARGINAL"
              : roi12 !== null && roi12 > 1
                ? "STRONG_VALUE"
                : "POSITIVE_VALUE";
    return Object.freeze({
      status,
      netAnnualBenefit: net,
      paybackMonths: payback,
      roi12,
      roi24:
        roi12 === null || net === null
          ? null
          : (net * 24 - (cost.totalInitial ?? 0)) / (cost.totalInitial ?? 1),
      roi36:
        roi12 === null || net === null
          ? null
          : (net * 36 - (cost.totalInitial ?? 0)) / (cost.totalInitial ?? 1),
      confidence: bounded(confidenceValue),
      missingInputs: Object.freeze([...missing]),
      signal,
      rationale: missing.length
        ? "Missing inputs prevent precise economic evaluation"
        : "Deterministic economic evaluation",
    });
  }
}
export interface Scenario {
  kind: ScenarioKind;
  adoption: number;
  coverage: number;
  volumeMultiplier: number;
  errorReduction: number;
  implementationMultiplier: number;
  maintenanceMultiplier: number;
  growth: number;
  failureRate: number;
}
export class ScenarioEvaluator {
  evaluate(base: Evaluation, scenario: Scenario): Evaluation {
    const factor =
      scenario.adoption *
      scenario.coverage *
      scenario.volumeMultiplier *
      (1 - scenario.failureRate);
    const net = base.netAnnualBenefit === null ? null : base.netAnnualBenefit * factor;
    return Object.freeze({
      ...base,
      netAnnualBenefit: net,
      signal:
        net === null
          ? "INSUFFICIENT_EVIDENCE"
          : net < 0
            ? "NEGATIVE_VALUE"
            : net < base.netAnnualBenefit! * 0.2
              ? "MARGINAL"
              : base.signal,
    });
  }
}
export interface SensitivityResult {
  variable: string;
  breakEven: number | null;
  impact: number;
  fragile: boolean;
}
export class SensitivityAnalyzer {
  analyze(
    base: Evaluation,
    variables: Record<string, { current: number; down: number; up: number }>,
  ): readonly SensitivityResult[] {
    return Object.freeze(
      Object.entries(variables)
        .map(([variable, v]) => ({
          variable,
          breakEven:
            base.netAnnualBenefit && base.netAnnualBenefit > 0
              ? v.current *
                (base.netAnnualBenefit / (base.netAnnualBenefit + Math.abs(v.down - v.current)))
              : null,
          impact: bounded(Math.abs(v.up - v.down)),
          fragile: Math.abs(v.up - v.down) > 0.4,
        }))
        .sort((a, b) => b.impact - a.impact),
    );
  }
}
export class BreakEvenAnalyzer {
  minimumVolume(current: number, benefit: number, cost: number) {
    return benefit > 0 ? (cost / benefit) * current : null;
  }
  minimumAdoption(benefit: number, cost: number) {
    return benefit > 0 ? bounded(cost / benefit) : null;
  }
  maximumImplementationCost(annualBenefit: number, paybackMonths: number) {
    return (annualBenefit * paybackMonths) / 12;
  }
}
export interface EconomicGuard {
  status: "SUFFICIENT" | "SUFFICIENT_WITH_ASSUMPTIONS" | "PARTIAL" | "INSUFFICIENT" | "BLOCKED";
  rationale: string;
}
export class EconomicEvidenceGuard {
  assess(inputs: readonly EconomicInput[], contradiction = false): EconomicGuard {
    if (contradiction)
      return { status: "BLOCKED", rationale: "Material economic contradiction unresolved" };
    const unknown = inputs.filter((i) => i.value === null);
    if (unknown.length)
      return { status: "INSUFFICIENT", rationale: "Required economic inputs are unknown" };
    const assumptions = inputs.filter(
      (i) => i.status === "ASSUMED" || i.status === "BENCHMARK_PRIOR",
    );
    return assumptions.length
      ? {
          status: "SUFFICIENT_WITH_ASSUMPTIONS",
          rationale: "Benchmark or assumed inputs disclosed",
        }
      : { status: "SUFFICIENT", rationale: "Inputs supported" };
  }
}
export interface InactionResult {
  annualWaste: number | null;
  growthCost: number | null;
  capacityConstraint: number | null;
  errorExposure: number | null;
  revenueLeakage: number | null;
  operationalRisk: number | null;
}
export class CostOfInaction {
  calculate(i: Record<string, EconomicInput>): InactionResult {
    const g = (n: string) => i[n]?.value ?? null;
    return Object.freeze({
      annualWaste: sum(g("currentAnnualWaste")),
      growthCost: mul(g("currentAnnualWaste"), g("expectedGrowthRate")),
      capacityConstraint: g("capacityConstraint"),
      errorExposure: g("errorImpact"),
      revenueLeakage: g("revenueImpact"),
      operationalRisk: g("operationalRiskExposure"),
    });
  }
}
export interface TimeToValue {
  minimumMonths: number | null;
  maximumMonths: number | null;
  rationale: string;
}
export class TimeToValueEstimate {
  estimate(i: {
    implementationMonths: number | null;
    integrationMonths: number | null;
    trainingMonths: number | null;
    adoptionRampMonths: number | null;
    prerequisiteMonths: number | null;
  }): TimeToValue {
    const vals = Object.values(i);
    if (vals.some((v) => v === null))
      return { minimumMonths: null, maximumMonths: null, rationale: "Time inputs incomplete" };
    const min = (vals as (number | null)[]).reduce<number>((a, b) => a + (b ?? 0), 0);
    return {
      minimumMonths: min,
      maximumMonths: min * 1.8,
      rationale: "Range includes adoption and dependency uncertainty",
    };
  }
}
export class RiskAdjustedValue {
  assess(
    gross: number | null,
    risk: {
      operationalRisk: number;
      dataRisk: number;
      securityRisk: number;
      complianceRisk: number;
      financialRisk: number;
      vendorDependencyRisk: number;
      changeManagementRisk: number;
    },
  ) {
    if (gross === null)
      return {
        grossBenefit: null,
        riskDeduction: null,
        riskAdjustedBenefit: null,
        rationale: "Gross benefit unknown",
      };
    const deduction =
      gross * bounded(Object.values(risk).reduce((a, b) => a + b, 0) / Object.keys(risk).length);
    return {
      grossBenefit: gross,
      riskDeduction: deduction,
      riskAdjustedBenefit: gross - deduction,
      rationale: "Explicit average risk deduction",
    };
  }
}
function sum(...values: (number | null | undefined)[]) {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  return present.length === values.length ? present.reduce((a, b) => a + b, 0) : null;
}
function sumKnown(...values: (number | null | undefined)[]) {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}
function mul(...values: (number | null | undefined)[]) {
  return sum(...values);
}
function confidence(i: Record<string, EconomicInput>) {
  const v = Object.values(i);
  return v.length ? v.reduce((a, x) => a + x.confidence, 0) / v.length : 0;
}
