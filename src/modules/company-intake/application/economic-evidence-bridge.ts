import type { EnterpriseEvidenceRecord } from "../../../brain-evaluation/convergence-adapters";
import {
  BrainEconomicQualificationService,
  ProductionEconomicInputAdapter,
  ProductionRoiEligibilityBridge,
  type EconomicField,
  type ProductionEconomicInput,
  type ProductionEconomicInputResult,
  type ProductionEconomicValue,
} from "../../../brain-evaluation/economic-qualification-bridge";
import { ReasoningTrace } from "../../../brain-evaluation/brain-contracts";

export type EconomicConcept =
  | "TRANSACTION_VOLUME"
  | "TASK_FREQUENCY"
  | "TASK_DURATION"
  | "LABOR_COST"
  | "HEADCOUNT"
  | "ERROR_RATE"
  | "ERROR_COST"
  | "INCIDENT_COST"
  | "SOFTWARE_COST"
  | "IMPLEMENTATION_COST"
  | "MAINTENANCE_COST"
  | "TRAINING_COST"
  | "INFRASTRUCTURE_COST"
  | "REVENUE_IMPACT"
  | "DELAY_COST"
  | "EXPECTED_TIME_REDUCTION"
  | "EXPECTED_AUTOMATION_COVERAGE"
  | "EXPECTED_ADOPTION_RATE"
  | "OTHER";

export type EconomicValueClassification =
  "OBSERVED" | "DERIVED" | "ASSUMED" | "BENCHMARK" | "UNKNOWN";
export type EconomicQualificationState =
  | "INSUFFICIENT_EVIDENCE"
  | "PARTIALLY_QUALIFIED"
  | "QUALIFIED"
  | "ECONOMICALLY_UNQUALIFIED"
  | "NEED_MORE_EVIDENCE"
  | "CURRENCY_NORMALIZATION_REQUIRED";

export interface EconomicEvidenceValue {
  readonly concept: EconomicConcept;
  readonly value: number | null;
  readonly unit: string;
  readonly currency?: string;
  readonly period?: string;
  readonly uncertaintyRange?: Readonly<{ min: number; max: number }>;
  readonly classification: EconomicValueClassification;
  readonly tenantId: string;
  readonly companyId: string;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly evidenceId: string;
  readonly observedAt: Date;
  readonly effectivePeriod?: string;
  readonly derivationReference?: string;
  readonly opportunityId?: string;
}

export interface RealCompanyEconomicEvidenceInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly knowledgeSnapshotId: string;
  readonly opportunityId: string;
  readonly evidence: readonly EnterpriseEvidenceRecord[];
  readonly reasoningTrace?: ReasoningTrace;
  readonly contradictionIds?: readonly string[];
}

export interface EconomicDiscoveryTarget {
  readonly missingField: string;
  readonly preferredSource:
    "SYSTEM_EVIDENCE" | "FINANCE_INTERVIEW" | "PROCESS_EVIDENCE" | "DOCUMENT";
  readonly rationale: string;
}

export interface ProductionRoiInputPayload {
  readonly tenantId: string;
  readonly companyId: string;
  readonly opportunityId: string;
  readonly knowledgeSnapshotId: string;
  readonly evidenceReferences: readonly string[];
  readonly assumptions: readonly ProductionEconomicInputResult["assumptions"][number][];
  readonly derivedValues: readonly EconomicEvidenceValue[];
  readonly scenarioRanges: readonly { variable: string; min: number | null; max: number | null }[];
  readonly qualificationState: EconomicQualificationState;
  readonly brainQualificationReference: string;
}

export interface RealCompanyEconomicEvidenceResult {
  readonly tenantId: string;
  readonly companyId: string;
  readonly opportunityId: string;
  readonly knowledgeSnapshotId: string;
  readonly values: readonly EconomicEvidenceValue[];
  readonly input: ProductionEconomicInputResult;
  readonly qualification: ReturnType<BrainEconomicQualificationService["qualify"]>;
  readonly eligibility: ReturnType<ProductionRoiEligibilityBridge["evaluate"]>;
  readonly state: EconomicQualificationState;
  readonly gaps: readonly string[];
  readonly discoveryTargets: readonly EconomicDiscoveryTarget[];
  readonly currencies: readonly string[];
  readonly productionRoiInput: ProductionRoiInputPayload;
}

const FIELD_BY_CONCEPT: Partial<Record<EconomicConcept, EconomicField>> = {
  TRANSACTION_VOLUME: "volume",
  TASK_FREQUENCY: "frequency",
  TASK_DURATION: "currentLaborTime",
  LABOR_COST: "laborCost",
  ERROR_RATE: "errorRate",
  ERROR_COST: "errorCost",
  INCIDENT_COST: "errorCost",
  SOFTWARE_COST: "recurringCost",
  IMPLEMENTATION_COST: "implementationCost",
  MAINTENANCE_COST: "maintenanceCost",
  TRAINING_COST: "trainingCost",
  INFRASTRUCTURE_COST: "infrastructureCost",
  REVENUE_IMPACT: "revenueImpact",
  DELAY_COST: "delayCost",
  EXPECTED_TIME_REDUCTION: "expectedTimeReduction",
  EXPECTED_AUTOMATION_COVERAGE: "expectedAutomationCoverage",
  EXPECTED_ADOPTION_RATE: "expectedAdoptionRate",
};

const CONCEPT_ALIASES: Record<string, EconomicConcept> = {
  monthly_volume: "TRANSACTION_VOLUME",
  transaction_volume: "TRANSACTION_VOLUME",
  volume: "TRANSACTION_VOLUME",
  task_frequency: "TASK_FREQUENCY",
  frequency: "TASK_FREQUENCY",
  task_duration: "TASK_DURATION",
  duration: "TASK_DURATION",
  labor_cost: "LABOR_COST",
  hourly_cost: "LABOR_COST",
  headcount: "HEADCOUNT",
  error_rate: "ERROR_RATE",
  error_cost: "ERROR_COST",
  incident_cost: "INCIDENT_COST",
  software_cost: "SOFTWARE_COST",
  implementation_cost: "IMPLEMENTATION_COST",
  maintenance_cost: "MAINTENANCE_COST",
  training_cost: "TRAINING_COST",
  infrastructure_cost: "INFRASTRUCTURE_COST",
  revenue_impact: "REVENUE_IMPACT",
  delay_cost: "DELAY_COST",
  expected_time_reduction: "EXPECTED_TIME_REDUCTION",
  expected_automation_coverage: "EXPECTED_AUTOMATION_COVERAGE",
  expected_adoption_rate: "EXPECTED_ADOPTION_RATE",
};

/** Converts source-backed structured evidence to the existing Brain economic contract. */
export class RealCompanyEconomicEvidenceAssembler {
  assemble(input: RealCompanyEconomicEvidenceInput): RealCompanyEconomicEvidenceResult {
    assertScope(input);
    const values = input.evidence.flatMap((record) => this.extract(record, input));
    const currencies = [
      ...new Set(
        values
          .map((value) => value.currency)
          .filter((currency): currency is string => Boolean(currency)),
      ),
    ].sort();
    const productionInput = this.toProductionInput(input, values);
    const mapped = new ProductionEconomicInputAdapter().map(productionInput);
    const currencyConflict = currencies.length > 1;
    const qualification = new BrainEconomicQualificationService().qualify(mapped, {
      contradiction: Boolean(input.contradictionIds?.length) || hasMaterialConflict(values),
    });
    const eligibility = new ProductionRoiEligibilityBridge().evaluate(qualification);
    const state = currencyConflict
      ? "CURRENCY_NORMALIZATION_REQUIRED"
      : qualification.economicSignal === "NEGATIVE_VALUE"
        ? "ECONOMICALLY_UNQUALIFIED"
        : qualification.economicGuard.status === "INSUFFICIENT" || qualification.unknowns.length
          ? "NEED_MORE_EVIDENCE"
          : qualification.economicGuard.status === "PARTIAL"
            ? "PARTIALLY_QUALIFIED"
            : "QUALIFIED";
    const gaps = Object.freeze([
      ...qualification.unknowns,
      ...(currencyConflict ? ["currency conversion policy"] : []),
    ]);
    const discoveryTargets = Object.freeze(
      gaps.filter((gap) => gap !== "currency conversion policy").map(targetForGap),
    );
    const productionRoiInput = Object.freeze({
      tenantId: input.tenantId,
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      knowledgeSnapshotId: input.knowledgeSnapshotId,
      evidenceReferences: Object.freeze(values.map((value) => value.evidenceId)),
      assumptions: mapped.assumptions,
      derivedValues: Object.freeze(values.filter((value) => value.classification === "DERIVED")),
      scenarioRanges: Object.freeze(
        values
          .filter((value) => value.uncertaintyRange)
          .map((value) => ({
            variable: value.concept,
            min: value.uncertaintyRange?.min ?? null,
            max: value.uncertaintyRange?.max ?? null,
          })),
      ),
      qualificationState: state,
      brainQualificationReference: `brain-economic:${input.opportunityId}`,
    });
    return Object.freeze({
      tenantId: input.tenantId,
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      knowledgeSnapshotId: input.knowledgeSnapshotId,
      values: Object.freeze(values),
      input: mapped,
      qualification,
      eligibility,
      state,
      gaps,
      discoveryTargets,
      currencies: Object.freeze(currencies),
      productionRoiInput,
    });
  }

  private extract(
    record: EnterpriseEvidenceRecord,
    input: RealCompanyEconomicEvidenceInput,
  ): readonly EconomicEvidenceValue[] {
    const structured = record.structuredValue;
    if (!structured || typeof structured !== "object" || Array.isArray(structured)) return [];
    const rows = Array.isArray((structured as { rows?: unknown }).rows)
      ? (structured as { rows: readonly unknown[] }).rows
      : [structured];
    return rows.flatMap((row, index) => this.extractRow(record, row, input, index));
  }

  private extractRow(
    record: EnterpriseEvidenceRecord,
    row: unknown,
    input: RealCompanyEconomicEvidenceInput,
    index: number,
  ): readonly EconomicEvidenceValue[] {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const value = row as Record<string, unknown>;
    const rawName = String(
      value.concept ?? value.economicConcept ?? value.field ?? value.name ?? "",
    ).toLowerCase();
    const concept =
      CONCEPT_ALIASES[rawName] ??
      (Object.keys(CONCEPT_ALIASES).find((key) => rawName.includes(key))
        ? CONCEPT_ALIASES[Object.keys(CONCEPT_ALIASES).find((key) => rawName.includes(key))!]
        : undefined);
    if (!concept) return [];
    const rawNumber = value.value ?? value.amount ?? value.number;
    const numeric =
      rawNumber === null || rawNumber === undefined || rawNumber === "" ? null : Number(rawNumber);
    if (numeric !== null && !Number.isFinite(numeric)) return [];
    const classification = normalizeClassification(value.classification ?? value.status);
    const unit = String(value.unit ?? "unknown");
    const period = value.period === undefined ? undefined : String(value.period);
    const normalized = normalizeTime(concept, numeric, unit);
    return [
      Object.freeze({
        concept,
        value: normalized.value,
        unit: normalized.unit,
        ...(value.currency ? { currency: String(value.currency) } : {}),
        ...(period ? { period } : {}),
        ...(value.uncertaintyRange && typeof value.uncertaintyRange === "object"
          ? {
              uncertaintyRange: Object.freeze({
                min: Number((value.uncertaintyRange as { min: unknown }).min),
                max: Number((value.uncertaintyRange as { max: unknown }).max),
              }),
            }
          : {}),
        classification,
        tenantId: input.tenantId,
        companyId: input.companyId,
        sourceId: String(record.provenance.sourceId ?? record.id),
        sourceVersion: Number(record.provenance.sourceVersion ?? 1),
        evidenceId: record.id,
        observedAt: record.capturedAt,
        ...(value.effectivePeriod ? { effectivePeriod: String(value.effectivePeriod) } : {}),
        ...(normalized.derivationReference
          ? { derivationReference: normalized.derivationReference }
          : {}),
        opportunityId: input.opportunityId,
        ...(index ? { derivationReference: `row:${index + 1}` } : {}),
      }),
    ];
  }

  private toProductionInput(
    input: RealCompanyEconomicEvidenceInput,
    values: readonly EconomicEvidenceValue[],
  ): ProductionEconomicInput {
    const grouped: Record<string, ProductionEconomicValue[]> = {};
    for (const value of values) {
      const field = FIELD_BY_CONCEPT[value.concept];
      if (!field) continue;
      const converted =
        value.classification === "BENCHMARK" ? "BENCHMARK_PRIOR" : value.classification;
      const item: ProductionEconomicValue = {
        value: value.value,
        unit: value.unit,
        source: value.sourceId,
        version: value.sourceVersion,
        status: converted,
        confidence: value.classification === "UNKNOWN" ? 0 : 1,
        evidenceIds: [value.evidenceId],
        provenance: {
          tenantId: value.tenantId,
          companyId: value.companyId,
          sourceId: value.sourceId,
          sourceVersion: value.sourceVersion,
          evidenceId: value.evidenceId,
          knowledgeSnapshotId: input.knowledgeSnapshotId,
        },
      };
      (grouped[field] ??= []).push(item);
    }
    return {
      tenantId: input.tenantId,
      opportunityId: input.opportunityId,
      values: grouped,
      reasoningTrace: input.reasoningTrace ?? traceFor(values, input.opportunityId),
    };
  }
}

function assertScope(input: RealCompanyEconomicEvidenceInput): void {
  if (!input.tenantId || !input.companyId || !input.knowledgeSnapshotId || !input.opportunityId)
    throw new Error("Economic evidence scope is required");
  for (const record of input.evidence) {
    if (
      (record.tenantId && record.tenantId !== input.tenantId) ||
      (record.companyId && record.companyId !== input.companyId)
    )
      throw new Error("Economic evidence scope mismatch");
  }
}

function normalizeClassification(value: unknown): EconomicValueClassification {
  if (
    value === "OBSERVED" ||
    value === "DERIVED" ||
    value === "ASSUMED" ||
    value === "BENCHMARK" ||
    value === "UNKNOWN"
  )
    return value;
  if (value === "BENCHMARK_PRIOR") return "BENCHMARK";
  return "OBSERVED";
}

function normalizeTime(
  concept: EconomicConcept,
  value: number | null,
  unit: string,
): { value: number | null; unit: string; derivationReference?: string } {
  if (value === null) return { value, unit };
  const normalized = unit.toLowerCase();
  if (concept === "TASK_DURATION" && normalized === "minutes")
    return { value: value / 60, unit: "hours", derivationReference: "minutes-to-hours" };
  if (concept === "TASK_DURATION" && normalized === "seconds")
    return { value: value / 3600, unit: "hours", derivationReference: "seconds-to-hours" };
  if (concept === "TASK_FREQUENCY" && (normalized === "per month" || normalized === "monthly"))
    return {
      value: value * 12,
      unit: "per year",
      derivationReference: "monthly-to-annual-frequency",
    };
  if (concept === "TASK_FREQUENCY" && (normalized === "per week" || normalized === "weekly"))
    return {
      value: value * 52,
      unit: "per year",
      derivationReference: "weekly-to-annual-frequency",
    };
  if (concept === "TASK_FREQUENCY" && (normalized === "per day" || normalized === "daily"))
    return {
      value: value * 365,
      unit: "per year",
      derivationReference: "daily-to-annual-frequency",
    };
  return { value, unit };
}

function hasMaterialConflict(values: readonly EconomicEvidenceValue[]): boolean {
  return [...new Set(values.map((value) => value.concept))].some((concept) => {
    const numbers = values
      .filter((value) => value.concept === concept && value.value !== null)
      .map((value) => value.value as number);
    if (numbers.length < 2) return false;
    const min = Math.min(...numbers);
    return min !== 0 && (Math.max(...numbers) - min) / min >= 0.2;
  });
}

function targetForGap(missingField: string): EconomicDiscoveryTarget {
  if (missingField === "volume" || missingField === "frequency")
    return {
      missingField,
      preferredSource: "SYSTEM_EVIDENCE",
      rationale: "Operational volume or cadence should come from a system record",
    };
  if (missingField === "laborCost")
    return {
      missingField,
      preferredSource: "FINANCE_INTERVIEW",
      rationale: "Labor cost requires an authoritative finance source",
    };
  if (missingField === "currentLaborTime")
    return {
      missingField,
      preferredSource: "PROCESS_EVIDENCE",
      rationale: "Duration should be measured from process evidence or logs",
    };
  if (missingField.endsWith("Cost"))
    return {
      missingField,
      preferredSource: "DOCUMENT",
      rationale: "Cost requires an invoice, contract or finance document",
    };
  return {
    missingField,
    preferredSource: "PROCESS_EVIDENCE",
    rationale: "A source-backed operational measurement is required",
  };
}

function traceFor(values: readonly EconomicEvidenceValue[], opportunityId: string): ReasoningTrace {
  const nodes: Record<string, string> = { [opportunityId]: "Economic qualification" };
  const edges = values.map((value) => {
    nodes[value.evidenceId] = `${value.concept} from ${value.sourceId} v${value.sourceVersion}`;
    return {
      fromId: value.evidenceId,
      toId: opportunityId,
      relationship: "supports",
      rationale: "Source-backed economic value",
    };
  });
  return ReasoningTrace.create(nodes, edges);
}
