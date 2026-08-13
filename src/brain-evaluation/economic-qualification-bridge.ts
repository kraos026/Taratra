import {
  BaselineEconomicModel,
  BreakEvenAnalyzer,
  CostOfInaction,
  EconomicEvaluation,
  EconomicEvidenceGuard,
  EconomicInputFactory,
  RiskAdjustedValue,
  SensitivityAnalyzer,
  TimeToValueEstimate,
  TransformationCostModel,
  BenefitModel,
  type EconomicInput,
  type EconomicSignal,
  type EconomicStatus,
  type EconomicGuard,
  type ScenarioKind,
} from "./economic-intelligence";
import type { ReasoningTrace } from "./brain-contracts";

export type EconomicField =
  | "volume"
  | "frequency"
  | "currentLaborTime"
  | "laborCost"
  | "errorRate"
  | "errorCost"
  | "delayCost"
  | "implementationCost"
  | "integrationCost"
  | "migrationCost"
  | "trainingCost"
  | "changeManagementCost"
  | "securityComplianceCost"
  | "recurringCost"
  | "infrastructureCost"
  | "maintenanceCost"
  | "supportCost"
  | "monitoringCost"
  | "expectedTimeReduction"
  | "expectedAutomationCoverage"
  | "expectedAdoptionRate"
  | "expectedErrorReduction"
  | "capacityImpact"
  | "revenueImpact"
  | "residualHumanValidationCost"
  | "currentAnnualWaste"
  | "expectedGrowthRate"
  | "capacityConstraint"
  | "errorImpact"
  | "operationalRiskExposure"
  | "implementationMonths"
  | "integrationMonths"
  | "trainingMonths"
  | "adoptionRampMonths"
  | "prerequisiteMonths";

export interface ProductionEconomicValue {
  value: number | null;
  unit: string;
  source: string;
  version?: number;
  status: EconomicStatus;
  confidence: number;
  evidenceIds?: readonly string[];
  provenance?: Readonly<Record<string, unknown>>;
  uncertaintyRange?: { min: number; max: number };
}

export interface ProductionEconomicInput {
  tenantId: string;
  opportunityId: string;
  values: Readonly<
    Partial<Record<EconomicField, ProductionEconomicValue | readonly ProductionEconomicValue[]>>
  >;
  contradictions?: readonly string[];
  reasoningTrace: ReasoningTrace;
  humanAssisted?: boolean;
  m2Decision?: "RECOMMEND_CANDIDATE" | "DEFER" | "REJECT" | "HUMAN_ASSISTED" | "NEED_MORE_EVIDENCE";
}

export interface ProductionEconomicInputResult {
  tenantId: string;
  opportunityId: string;
  inputs: Readonly<Record<string, EconomicInput>>;
  assumptions: readonly EconomicAssumption[];
  reasoningTrace: ReasoningTrace;
  humanAssisted: boolean;
  m2Decision?: ProductionEconomicInput["m2Decision"];
}

export interface EconomicAssumption {
  name: string;
  value: number | null;
  unit: string;
  status: EconomicStatus;
  source: string;
  version?: number;
  evidenceIds: readonly string[];
  provenance: Readonly<Record<string, unknown>>;
}

const SOURCE_PRIORITY: Record<EconomicStatus, number> = {
  OBSERVED: 5,
  DERIVED: 4,
  BENCHMARK_PRIOR: 3,
  ASSUMED: 2,
  UNKNOWN: 1,
};

/** Normalises production values while preserving provenance and never inventing a value. */
export class ProductionEconomicInputAdapter {
  map(input: ProductionEconomicInput): ProductionEconomicInputResult {
    const mapped: Record<string, EconomicInput> = {};
    const assumptions: EconomicAssumption[] = [];
    for (const [name, raw] of Object.entries(input.values) as [
      string,
      ProductionEconomicValue | readonly ProductionEconomicValue[] | undefined,
    ][]) {
      const values: ProductionEconomicValue[] = Array.isArray(raw) ? [...raw] : raw ? [raw] : [];
      if (!values.length) continue;
      const selected = [...values].sort(
        (a, b) =>
          SOURCE_PRIORITY[b.status] - SOURCE_PRIORITY[a.status] || a.source.localeCompare(b.source),
      )[0]!;
      const value = EconomicInputFactory.create(
        name,
        selected.value,
        selected.unit,
        selected.status,
        selected.source,
        selected.confidence,
        selected.evidenceIds ?? [],
        selected.uncertaintyRange,
      );
      mapped[name] = value;
      assumptions.push(
        Object.freeze({
          name,
          value: selected.value,
          unit: selected.unit,
          status: selected.status,
          source: selected.source,
          version: selected.version,
          evidenceIds: Object.freeze([...(selected.evidenceIds ?? [])]),
          provenance: Object.freeze({ ...(selected.provenance ?? {}) }),
        }),
      );
    }
    return Object.freeze({
      tenantId: input.tenantId,
      opportunityId: input.opportunityId,
      inputs: Object.freeze(mapped),
      assumptions: Object.freeze(assumptions),
      reasoningTrace: input.reasoningTrace,
      humanAssisted: input.humanAssisted ?? input.m2Decision === "HUMAN_ASSISTED",
      m2Decision: input.m2Decision,
    });
  }
}

export interface BrainEconomicQualification {
  tenantId: string;
  opportunityId: string;
  economicGuard: EconomicGuard;
  economicSignal: EconomicSignal;
  confidence: number;
  assumptions: readonly EconomicAssumption[];
  unknowns: readonly string[];
  contradictions: readonly string[];
  scenarioSummary: Readonly<
    Record<ScenarioKind, { netAnnualBenefit: number | null; signal: EconomicSignal }>
  >;
  sensitivity: readonly {
    variable: string;
    breakEven: number | null;
    impact: number;
    fragile: boolean;
  }[];
  breakEven: Readonly<{
    minimumVolume: number | null;
    minimumAdoption: number | null;
    maximumImplementationCost: number | null;
  }>;
  riskAdjustedValue: Readonly<{
    grossBenefit: number | null;
    riskDeduction: number | null;
    riskAdjustedBenefit: number | null;
    rationale: string;
  }>;
  costOfInaction: Readonly<Record<string, number | null>>;
  timeToValue: Readonly<{
    minimumMonths: number | null;
    maximumMonths: number | null;
    rationale: string;
  }>;
  blockingReasons: readonly string[];
  warnings: readonly string[];
  reasoningTrace: ReasoningTrace;
}

export interface EconomicQualificationOptions {
  contradiction?: boolean;
  humanResidualCostModeled?: boolean;
  sensitivityVariables?: Record<string, { current: number; down: number; up: number }>;
  risk?: {
    operationalRisk: number;
    dataRisk: number;
    securityRisk: number;
    complianceRisk: number;
    financialRisk: number;
    vendorDependencyRisk: number;
    changeManagementRisk: number;
  };
}

const REQUIRED = ["volume", "frequency", "currentLaborTime", "laborCost", "implementationCost"];

export class BrainEconomicQualificationService {
  qualify(
    mapped: ProductionEconomicInputResult,
    options: EconomicQualificationOptions = {},
  ): BrainEconomicQualification {
    const inputs = mapped.inputs;
    const baseline = new BaselineEconomicModel().calculate(inputs);
    const cost = new TransformationCostModel().calculate(inputs);
    const benefit = new BenefitModel().calculate(inputs);
    const unknowns = Object.freeze(
      REQUIRED.filter((key) => inputs[key]?.value === null || !inputs[key]),
    );
    const guard = new EconomicEvidenceGuard().assess(
      Object.values(inputs),
      Boolean(options.contradiction),
    );
    const evaluation = new EconomicEvaluation().evaluate(
      benefit,
      cost,
      baseline.confidence,
      unknowns,
    );
    const sensitivity = new SensitivityAnalyzer().analyze(
      evaluation,
      options.sensitivityVariables ?? {},
    );
    const risk = options.risk ?? {
      operationalRisk: 0,
      dataRisk: 0,
      securityRisk: 0,
      complianceRisk: 0,
      financialRisk: 0,
      vendorDependencyRisk: 0,
      changeManagementRisk: 0,
    };
    const riskAdjusted = new RiskAdjustedValue().assess(evaluation.netAnnualBenefit, risk);
    const breakEven = new BreakEvenAnalyzer();
    const timeToValue = new TimeToValueEstimate().estimate({
      implementationMonths: inputs.implementationMonths?.value ?? null,
      integrationMonths: inputs.integrationMonths?.value ?? null,
      trainingMonths: inputs.trainingMonths?.value ?? null,
      adoptionRampMonths: inputs.adoptionRampMonths?.value ?? null,
      prerequisiteMonths: inputs.prerequisiteMonths?.value ?? null,
    });
    const scenarios = (
      Object.keys({ PESSIMISTIC: 1, BASE: 1, OPTIMISTIC: 1, STRESS: 1 }) as ScenarioKind[]
    ).reduce(
      (acc, kind) => {
        const factor =
          kind === "PESSIMISTIC" || kind === "STRESS" ? 0.7 : kind === "OPTIMISTIC" ? 1.2 : 1;
        const net =
          evaluation.netAnnualBenefit === null ? null : evaluation.netAnnualBenefit * factor;
        acc[kind] = {
          netAnnualBenefit: net,
          signal:
            net === null ? "INSUFFICIENT_EVIDENCE" : net < 0 ? "NEGATIVE_VALUE" : evaluation.signal,
        };
        return acc;
      },
      {} as Record<ScenarioKind, { netAnnualBenefit: number | null; signal: EconomicSignal }>,
    );
    const warnings = [
      ...sensitivity
        .filter((item) => item.fragile)
        .map((item) => `Fragile economics: ${item.variable}`),
      ...(Object.values(inputs).some((item) => item.status === "BENCHMARK_PRIOR")
        ? ["Benchmark prior used; company data takes precedence"]
        : []),
      ...(mapped.humanAssisted && !options.humanResidualCostModeled
        ? ["Human residual cost is not modeled"]
        : []),
      ...(evaluation.signal === "NEGATIVE_VALUE"
        ? ["Negative economics must not be promoted"]
        : []),
    ];
    const blockingReasons = [
      ...unknowns.map((key) => `Critical input unknown: ${key}`),
      ...(options.contradiction ? ["Material economic contradiction unresolved"] : []),
      ...(mapped.humanAssisted && !options.humanResidualCostModeled
        ? ["Human residual cost required"]
        : []),
      ...(mapped.m2Decision && ["REJECT", "DEFER", "NEED_MORE_EVIDENCE"].includes(mapped.m2Decision)
        ? [`M2 decision ${mapped.m2Decision} blocks ROI`]
        : []),
    ];
    return Object.freeze({
      tenantId: mapped.tenantId,
      opportunityId: mapped.opportunityId,
      economicGuard: guard,
      economicSignal: evaluation.signal,
      confidence: evaluation.confidence,
      assumptions: mapped.assumptions,
      unknowns,
      contradictions: Object.freeze(
        options.contradiction ? ["MATERIAL_ECONOMIC_CONTRADICTION"] : [],
      ),
      scenarioSummary: Object.freeze(scenarios),
      sensitivity: Object.freeze(sensitivity),
      breakEven: Object.freeze({
        minimumVolume:
          inputs.volume?.value && evaluation.netAnnualBenefit && cost.totalInitial
            ? breakEven.minimumVolume(
                inputs.volume.value,
                evaluation.netAnnualBenefit,
                cost.totalInitial,
              )
            : null,
        minimumAdoption:
          evaluation.netAnnualBenefit && cost.totalInitial
            ? breakEven.minimumAdoption(evaluation.netAnnualBenefit, cost.totalInitial)
            : null,
        maximumImplementationCost: evaluation.netAnnualBenefit
          ? breakEven.maximumImplementationCost(evaluation.netAnnualBenefit, 12)
          : null,
      }),
      riskAdjustedValue: Object.freeze(riskAdjusted),
      costOfInaction: Object.freeze(new CostOfInaction().calculate(inputs)),
      timeToValue: Object.freeze(timeToValue),
      blockingReasons: Object.freeze(blockingReasons),
      warnings: Object.freeze(warnings),
      reasoningTrace: mapped.reasoningTrace,
    });
  }
}

export type RoiEligibility =
  | "ELIGIBLE"
  | "ELIGIBLE_WITH_DECLARED_ASSUMPTIONS"
  | "PARTIAL_NOT_PUBLISHABLE"
  | "NEED_MORE_EVIDENCE"
  | "BLOCKED";
export interface ProductionRoiEligibilityOutcome {
  eligibility: RoiEligibility;
  publishable: boolean;
  reason: string;
  blockingReasons: readonly string[];
  qualification: BrainEconomicQualification;
}

export class ProductionRoiEligibilityBridge {
  evaluate(q: BrainEconomicQualification): ProductionRoiEligibilityOutcome {
    const m2Blocked = q.blockingReasons.some((reason) => reason.startsWith("M2 decision"));
    const eligibility: RoiEligibility =
      q.economicGuard.status === "BLOCKED" || m2Blocked || q.economicSignal === "NEGATIVE_VALUE"
        ? "BLOCKED"
        : q.economicGuard.status === "INSUFFICIENT"
          ? "NEED_MORE_EVIDENCE"
          : q.economicGuard.status === "PARTIAL"
            ? "PARTIAL_NOT_PUBLISHABLE"
            : q.economicGuard.status === "SUFFICIENT_WITH_ASSUMPTIONS"
              ? "ELIGIBLE_WITH_DECLARED_ASSUMPTIONS"
              : "ELIGIBLE";
    return Object.freeze({
      eligibility,
      publishable:
        eligibility === "ELIGIBLE" || eligibility === "ELIGIBLE_WITH_DECLARED_ASSUMPTIONS",
      reason:
        eligibility === "ELIGIBLE"
          ? "Economic inputs are sufficient"
          : `Economic eligibility is ${eligibility}`,
      blockingReasons: q.blockingReasons,
      qualification: q,
    });
  }
}

export interface ProductionRoiAssessment {
  readiness: number;
  roi12?: number | null;
  formulaVersion?: string;
}
export type EconomicComparisonKind =
  | "AGREE"
  | "SOFT_DIFFERENCE"
  | "MATERIAL_DIFFERENCE"
  | "BRAIN_HARD_GATE_CONFLICT"
  | "FORMULA_DIFFERENCE";
export interface EconomicDualRunComparison {
  production: ProductionRoiAssessment;
  brain: BrainEconomicQualification;
  classification: EconomicComparisonKind;
  reason: string;
  agreement: boolean;
}
export class EconomicDualRunHarness {
  compare(
    production: ProductionRoiAssessment,
    brain: BrainEconomicQualification,
  ): EconomicDualRunComparison {
    const gate = brain.blockingReasons.length > 0 || brain.economicSignal === "NEGATIVE_VALUE";
    const formula = Boolean(
      production.formulaVersion && production.formulaVersion !== "brain-qualification",
    );
    const classification: EconomicComparisonKind =
      gate && production.readiness >= 70
        ? "BRAIN_HARD_GATE_CONFLICT"
        : formula && production.roi12 !== null && production.roi12 !== undefined
          ? "FORMULA_DIFFERENCE"
          : gate
            ? "MATERIAL_DIFFERENCE"
            : Math.abs(production.readiness - brain.confidence * 100) <= 15
              ? "AGREE"
              : "SOFT_DIFFERENCE";
    return Object.freeze({
      production,
      brain,
      classification,
      reason:
        classification === "BRAIN_HARD_GATE_CONFLICT"
          ? "Production readiness cannot override Brain economic gate"
          : classification === "FORMULA_DIFFERENCE"
            ? "Production formula is authoritative and differs from qualification analysis"
            : "Deterministic economic comparison",
      agreement: classification === "AGREE",
    });
  }
}
