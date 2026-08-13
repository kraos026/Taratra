import type { ReasoningTrace } from "./brain-contracts";

export type SimulationScenario = "BASELINE" | "PESSIMISTIC" | "BASE" | "OPTIMISTIC" | "STRESS";
export interface SimulationValue {
  value: number | null;
  unit: string;
  source: string;
  status: "OBSERVED" | "DERIVED" | "ASSUMED" | "BENCHMARK_PRIOR" | "UNKNOWN";
  confidence: number;
  range?: { min: number; max: number };
}
export interface CustomerSimulationInput {
  tenantId: string;
  companyId: string;
  processId: string;
  opportunityId: string;
  solutionId: string;
  values: Readonly<Record<string, SimulationValue>>;
  controls?: readonly string[];
  dependencies?: readonly string[];
  risks?: readonly string[];
  unknowns?: readonly string[];
  assumptions?: readonly string[];
  humanAssisted?: boolean;
  simulationHorizonMonths: number;
  modelVersion: string;
  reasoningTrace: ReasoningTrace;
}
export interface BaselineState {
  volume: number | null;
  processingTime: number | null;
  waitingTime: number | null;
  laborEffort: number | null;
  errorRate: number | null;
  rework: number | null;
  capacity: number | null;
  cost: number | null;
  throughput: number | null;
  backlog: number | null;
  humanEffort: number | null;
}
export interface TransformationModel {
  automationCoverage: number;
  expectedTimeReduction: number;
  expectedErrorReduction: number;
  expectedAdoption: number;
  humanResidualWork: number;
  newControlCost: number;
  newMaintenanceCost: number;
  implementationDelay: number;
  availability: number;
  rollbackCapability: number;
}
export interface ScenarioParameters {
  adoption: number;
  coverage: number;
  volumeMultiplier: number;
  errorReduction: number;
  costMultiplier: number;
  availability: number;
}
export interface OperationalImpact {
  throughput: number | null;
  processingTime: number | null;
  waitingTime: number | null;
  laborRequirement: number | null;
  humanResidualWork: number | null;
  backlog: number | null;
  errorVolume: number | null;
  rework: number | null;
  capacityUtilization: number | null;
}
export interface EconomicProjection {
  operationalCost: number | null;
  laborCost: number | null;
  maintenanceCost: number | null;
  errorCost: number | null;
  netBenefit: number | null;
  riskAdjustedCost: number | null;
}
export interface ScenarioResult {
  scenario: SimulationScenario;
  parameters: ScenarioParameters;
  operationalImpact: OperationalImpact;
  economicProjection: EconomicProjection;
  confidence: number;
  warnings: readonly string[];
}
export interface BottleneckShift {
  previousBottleneck: string | null;
  newBottleneck: string | null;
  capacityShift: number;
  reason: string;
  confidence: number;
}
export interface CustomerSimulationResult {
  simulationModelVersion: string;
  baseline: BaselineState;
  pessimistic: ScenarioResult;
  base: ScenarioResult;
  optimistic: ScenarioResult;
  stress: ScenarioResult;
  bottleneckShift: BottleneckShift;
  assumptions: readonly string[];
  unknowns: readonly string[];
  confidence: number;
  warnings: readonly string[];
  reasoningTrace: ReasoningTrace;
}

const n = (v: SimulationValue | undefined) => v?.value ?? null;
const val = (values: CustomerSimulationInput["values"], key: string, fallback = 0) =>
  n(values[key]) ?? fallback;
const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export class BaselineStateBuilder {
  build(input: CustomerSimulationInput): BaselineState {
    return Object.freeze({
      volume: n(input.values.volume),
      processingTime: n(input.values.processingTime),
      waitingTime: n(input.values.waitingTime),
      laborEffort: n(input.values.laborEffort),
      errorRate: n(input.values.errorRate),
      rework: n(input.values.rework),
      capacity: n(input.values.capacity),
      cost: n(input.values.cost),
      throughput: n(input.values.throughput),
      backlog: n(input.values.backlog),
      humanEffort: n(input.values.humanEffort),
    });
  }
}
export class TransformationModelBuilder {
  build(input: CustomerSimulationInput): TransformationModel {
    return Object.freeze({
      automationCoverage: clamp(val(input.values, "automationCoverage")),
      expectedTimeReduction: clamp(val(input.values, "expectedTimeReduction")),
      expectedErrorReduction: clamp(val(input.values, "expectedErrorReduction")),
      expectedAdoption: clamp(val(input.values, "expectedAdoption")),
      humanResidualWork: input.humanAssisted
        ? Math.max(0, val(input.values, "humanResidualWork", 0.3))
        : val(input.values, "humanResidualWork"),
      newControlCost: val(input.values, "newControlCost"),
      newMaintenanceCost: val(input.values, "maintenanceCost"),
      implementationDelay: val(input.values, "implementationDelay"),
      availability: clamp(val(input.values, "availability", 1)),
      rollbackCapability: clamp(val(input.values, "rollbackCapability", 1)),
    });
  }
}

export class CustomerSimulationEngine {
  simulate(input: CustomerSimulationInput): CustomerSimulationResult {
    const baseline = new BaselineStateBuilder().build(input);
    const model = new TransformationModelBuilder().build(input);
    const params: Record<SimulationScenario, ScenarioParameters> = {
      BASELINE: {
        adoption: 0,
        coverage: 0,
        volumeMultiplier: 1,
        errorReduction: 0,
        costMultiplier: 1,
        availability: 1,
      },
      PESSIMISTIC: {
        adoption: model.expectedAdoption * 0.6,
        coverage: model.automationCoverage * 0.7,
        volumeMultiplier: 1,
        errorReduction: model.expectedErrorReduction * 0.6,
        costMultiplier: 1.3,
        availability: model.availability * 0.95,
      },
      BASE: {
        adoption: model.expectedAdoption,
        coverage: model.automationCoverage,
        volumeMultiplier: 1,
        errorReduction: model.expectedErrorReduction,
        costMultiplier: 1,
        availability: model.availability,
      },
      OPTIMISTIC: {
        adoption: Math.min(1, model.expectedAdoption * 1.2),
        coverage: Math.min(1, model.automationCoverage * 1.1),
        volumeMultiplier: 1,
        errorReduction: Math.min(1, model.expectedErrorReduction * 1.2),
        costMultiplier: 0.9,
        availability: model.availability,
      },
      STRESS: {
        adoption: model.expectedAdoption * 0.7,
        coverage: model.automationCoverage,
        volumeMultiplier: 1.8,
        errorReduction: model.expectedErrorReduction * 0.5,
        costMultiplier: 1.5,
        availability: model.availability * 0.92,
      },
    };
    const make = (scenario: SimulationScenario): ScenarioResult =>
      this.project(baseline, model, params[scenario], scenario, input);
    const scenarios = {
      pessimistic: make("PESSIMISTIC"),
      base: make("BASE"),
      optimistic: make("OPTIMISTIC"),
      stress: make("STRESS"),
    };
    const unknowns = Object.entries(input.values)
      .filter(([, v]) => v.value === null || v.status === "UNKNOWN")
      .map(([k]) => k);
    const warnings = [
      ...(unknowns.length ? ["Unknown inputs widen interpretation"] : []),
      ...(input.humanAssisted ? ["Human residual work preserved"] : []),
    ];
    return Object.freeze({
      simulationModelVersion: input.modelVersion,
      baseline,
      ...scenarios,
      bottleneckShift: this.bottleneck(baseline, scenarios.base),
      assumptions: Object.freeze(input.assumptions ?? []),
      unknowns: Object.freeze([...(input.unknowns ?? []), ...unknowns]),
      confidence:
        Object.values(input.values).reduce((a, v) => a + v.confidence, 0) /
        Math.max(1, Object.keys(input.values).length),
      warnings: Object.freeze(warnings),
      reasoningTrace: input.reasoningTrace,
    });
  }
  private project(
    b: BaselineState,
    m: TransformationModel,
    p: ScenarioParameters,
    scenario: SimulationScenario,
    input: CustomerSimulationInput,
  ): ScenarioResult {
    const coverage = p.adoption * p.coverage;
    const operational: OperationalImpact = {
      throughput:
        b.throughput === null ? null : b.throughput * (1 + coverage * 0.5) * p.volumeMultiplier,
      processingTime:
        b.processingTime === null
          ? null
          : b.processingTime * (1 - m.expectedTimeReduction * coverage),
      waitingTime: b.waitingTime === null ? null : b.waitingTime * (1 - coverage * 0.3),
      laborRequirement:
        b.laborEffort === null
          ? null
          : b.laborEffort * (1 - coverage) +
            (input.humanAssisted ? b.laborEffort * m.humanResidualWork : 0),
      humanResidualWork:
        b.humanEffort === null
          ? null
          : b.humanEffort *
            (input.humanAssisted ? Math.max(m.humanResidualWork, 0.1) : 1 - coverage),
      backlog:
        b.backlog === null || operationalThroughput(b) === null
          ? null
          : Math.max(
              0,
              b.backlog +
                (val(input.values, "volume") * p.volumeMultiplier - operationalThroughput(b)!),
            ),
      errorVolume:
        b.errorRate === null || b.volume === null
          ? null
          : b.volume * p.volumeMultiplier * b.errorRate * (1 - p.errorReduction),
      rework: b.rework === null ? null : b.rework * (1 - p.errorReduction),
      capacityUtilization:
        b.capacity && operationalThroughput(b) ? operationalThroughput(b)! / b.capacity : null,
    };
    const baseCost = b.cost;
    const economic: EconomicProjection = {
      operationalCost: baseCost === null ? null : baseCost * p.costMultiplier,
      laborCost:
        operational.laborRequirement === null
          ? null
          : operational.laborRequirement * val(input.values, "laborCost"),
      maintenanceCost: m.newMaintenanceCost * p.costMultiplier,
      errorCost:
        operational.errorVolume === null
          ? null
          : operational.errorVolume * val(input.values, "errorCost"),
      netBenefit:
        baseCost === null ? null : baseCost - (baseCost * p.costMultiplier + m.newMaintenanceCost),
      riskAdjustedCost: baseCost === null ? null : baseCost * (1 + (1 - p.availability)),
    };
    const warnings = [
      ...(p.availability < 0.95 ? ["Availability degradation increases failure exposure"] : []),
      ...(input.controls?.length ? ["Controls retained in simulation"] : []),
    ];
    return Object.freeze({
      scenario,
      parameters: Object.freeze(p),
      operationalImpact: Object.freeze(operational),
      economicProjection: Object.freeze(economic),
      confidence:
        Object.values(input.values).reduce((a, v) => a + v.confidence, 0) /
        Math.max(1, Object.keys(input.values).length),
      warnings: Object.freeze(warnings),
    });
  }
  private bottleneck(b: BaselineState, base: ScenarioResult): BottleneckShift {
    const previous =
      b.waitingTime !== null && b.waitingTime > (b.processingTime ?? 0) ? "waiting" : "processing";
    const next =
      base.operationalImpact.waitingTime !== null &&
      base.operationalImpact.processingTime !== null &&
      base.operationalImpact.waitingTime > base.operationalImpact.processingTime
        ? "waiting"
        : "processing";
    return Object.freeze({
      previousBottleneck: previous,
      newBottleneck: next === previous ? null : next,
      capacityShift: (base.operationalImpact.throughput ?? 0) - (b.throughput ?? 0),
      reason:
        next === previous
          ? "No bottleneck shift detected"
          : "Transformation exposed a downstream constraint",
      confidence: base.confidence,
    });
  }
}
const operationalThroughput = (b: BaselineState) => b.throughput;

export interface WhatIfChange {
  volumeMultiplier?: number;
  adoption?: number;
  coverage?: number;
  costMultiplier?: number;
  availability?: number;
  errorReduction?: number;
}
export class WhatIfEngine {
  compare(input: CustomerSimulationInput, change: WhatIfChange) {
    const values = {
      ...input.values,
      ...(change.adoption === undefined
        ? {}
        : {
            expectedAdoption: {
              value: change.adoption,
              unit: "ratio",
              source: "what-if",
              status: "ASSUMED" as const,
              confidence: 0.7,
            },
          }),
      ...(change.coverage === undefined
        ? {}
        : {
            automationCoverage: {
              value: change.coverage,
              unit: "ratio",
              source: "what-if",
              status: "ASSUMED" as const,
              confidence: 0.7,
            },
          }),
    };
    const result = new CustomerSimulationEngine().simulate({ ...input, values });
    return Object.freeze({ result, delta: result.base.economicProjection.netBenefit });
  }
}
export class SimulationBreakpointAnalyzer {
  findVolumeBreakpoint(input: CustomerSimulationInput) {
    const capacity = n(input.values.capacity);
    const throughput = n(input.values.throughput);
    return capacity !== null && throughput !== null ? capacity / Math.max(1, throughput) : null;
  }
  findAdoptionBreakpoint(input: CustomerSimulationInput) {
    const adoption = n(input.values.expectedAdoption);
    return adoption === null ? null : Math.max(0, adoption * 0.3);
  }
}
export class SolutionComparisonEngine {
  compare(a: CustomerSimulationResult, b: CustomerSimulationResult) {
    return Object.freeze({
      timeReductionDelta:
        (a.base.operationalImpact.processingTime ?? 0) -
        (b.base.operationalImpact.processingTime ?? 0),
      costDelta:
        (a.base.economicProjection.operationalCost ?? 0) -
        (b.base.economicProjection.operationalCost ?? 0),
      riskDelta:
        (a.base.economicProjection.riskAdjustedCost ?? 0) -
        (b.base.economicProjection.riskAdjustedCost ?? 0),
      humanDependency: [
        a.base.operationalImpact.humanResidualWork,
        b.base.operationalImpact.humanResidualWork,
      ],
    });
  }
}
