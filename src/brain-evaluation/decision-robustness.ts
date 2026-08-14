import type { Contradiction, UnknownInformation } from "./brain-contracts";
import type { EconomicInput, EconomicSignal } from "./economic-intelligence";

export type DataQualityDecision =
  "READY" | "READY_WITH_CONDITIONS" | "REMEDIATE_FIRST" | "BLOCKED" | "NEED_MORE_EVIDENCE";

export interface DataQualityGuardInput {
  score: number;
  missingRequiredFields?: readonly string[];
  duplicateRate?: number;
  invalidValueCount?: number;
  inconsistentIdentifierCount?: number;
  staleDataRate?: number;
  masterDataFragmentation?: number;
  reconciliationFailures?: number;
  unknownSourceReliability?: boolean;
  criticalSchemaMismatch?: boolean;
}

export interface DataQualityDecisionResult {
  status: DataQualityDecision;
  score: number;
  reasons: readonly string[];
  requiredDataRemediation: readonly string[];
  requiredMasterDataCleanup: readonly string[];
  requiredSchemaAlignment: readonly string[];
  requiredReconciliation: readonly string[];
  requiredOwnership: readonly string[];
  evidenceNeeded: readonly string[];
}

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export class DataQualityDecisionGuard {
  assess(input: DataQualityGuardInput): DataQualityDecisionResult {
    const reasons: string[] = [];
    const remediation: string[] = [];
    const masterData: string[] = [];
    const schema: string[] = [];
    const reconciliation: string[] = [];
    const ownership: string[] = [];
    const evidenceNeeded: string[] = [];
    const missing = input.missingRequiredFields ?? [];
    if (input.criticalSchemaMismatch) {
      reasons.push("critical schema mismatch");
      schema.push("align the source schema before automation");
    }
    if ((input.invalidValueCount ?? 0) > 0) {
      reasons.push("invalid source values");
      remediation.push("validate and correct invalid source values");
    }
    if ((input.duplicateRate ?? 0) > 0.1) {
      reasons.push("duplicate records exceed the accepted quality level");
      masterData.push("deduplicate master data");
    }
    if ((input.inconsistentIdentifierCount ?? 0) > 0) {
      reasons.push("inconsistent identifiers");
      masterData.push("reconcile identifiers across systems");
    }
    if ((input.masterDataFragmentation ?? 0) > 0.6) {
      reasons.push("master-data fragmentation");
      masterData.push("select and document a master-data owner");
      ownership.push("assign master-data ownership");
    }
    if ((input.reconciliationFailures ?? 0) > 0) {
      reasons.push("reconciliation failures");
      reconciliation.push("complete source reconciliation");
    }
    if ((input.staleDataRate ?? 0) > 0.5) {
      reasons.push("stale source data");
      remediation.push("refresh stale source data");
    }
    if (missing.length || input.unknownSourceReliability) {
      if (missing.length)
        evidenceNeeded.push(...missing.map((field) => `required field: ${field}`));
      if (input.unknownSourceReliability) evidenceNeeded.push("source reliability");
    }
    const score = clamp(input.score);
    const status: DataQualityDecision = input.criticalSchemaMismatch
      ? "BLOCKED"
      : evidenceNeeded.length
        ? "NEED_MORE_EVIDENCE"
        : reasons.length && (masterData.length || reconciliation.length || remediation.length)
          ? "REMEDIATE_FIRST"
          : score >= 0.8
            ? "READY"
            : score >= 0.5
              ? "READY_WITH_CONDITIONS"
              : "REMEDIATE_FIRST";
    return Object.freeze({
      status,
      score,
      reasons: Object.freeze(reasons),
      requiredDataRemediation: Object.freeze(remediation),
      requiredMasterDataCleanup: Object.freeze(masterData),
      requiredSchemaAlignment: Object.freeze(schema),
      requiredReconciliation: Object.freeze(reconciliation),
      requiredOwnership: Object.freeze(ownership),
      evidenceNeeded: Object.freeze(evidenceNeeded),
    });
  }
}

export type ContradictionResolutionState =
  | "RESOLVED_WITH_AUTHORITATIVE_EVIDENCE"
  | "RESOLVED_WITH_WEIGHTED_EVIDENCE"
  | "UNRESOLVED_MATERIAL"
  | "UNRESOLVED_NON_MATERIAL";

export interface ContradictionResolution {
  state: ContradictionResolutionState;
  rationale: string;
  evidenceNeeded: readonly string[];
}

export class ContradictionResolutionEngine {
  resolve(
    contradictions: readonly Contradiction[],
    evidence: ReadonlyArray<{ evidenceId: string; reliability: number; sourceType: string }>,
  ): readonly ContradictionResolution[] {
    return Object.freeze(
      contradictions.map((contradiction) => {
        const ids = [...contradiction.leftEvidenceIds, ...contradiction.rightEvidenceIds];
        const candidates = evidence.filter((item) => ids.includes(item.evidenceId));
        const strongest = [...candidates].sort((a, b) => b.reliability - a.reliability)[0];
        const second = [...candidates].sort((a, b) => b.reliability - a.reliability)[1];
        if (contradiction.materiality === "LOW")
          return Object.freeze({
            state: "UNRESOLVED_NON_MATERIAL" as const,
            rationale: "Contradiction is retained but does not affect the decision target",
            evidenceNeeded: Object.freeze([]),
          });
        if (strongest && second && strongest.reliability - second.reliability >= 0.2)
          return Object.freeze({
            state: "RESOLVED_WITH_WEIGHTED_EVIDENCE" as const,
            rationale: "A materially stronger source is preferred without discarding the outlier",
            evidenceNeeded: Object.freeze([]),
          });
        return Object.freeze({
          state: "UNRESOLVED_MATERIAL" as const,
          rationale: "No sufficiently authoritative evidence resolves the contradiction",
          evidenceNeeded: Object.freeze(ids),
        });
      }),
    );
  }
}

export type RobustDecision =
  "ALLOW" | "REMEDIATE_FIRST" | "REJECT" | "DEFER" | "NEED_MORE_EVIDENCE";

export interface DecisionRobustnessResult {
  decision: RobustDecision;
  reasons: readonly string[];
  rationale: string;
  contradictionResolution: readonly ContradictionResolution[];
  economicallyUncertain: boolean;
}

export class DecisionRobustnessGuard {
  private readonly contradictionEngine = new ContradictionResolutionEngine();

  evaluate(input: {
    dataQuality: DataQualityDecisionResult;
    economicSignal: EconomicSignal;
    economicInputs: readonly EconomicInput[];
    contradictions: readonly Contradiction[];
    evidence: ReadonlyArray<{ evidenceId: string; reliability: number; sourceType: string }>;
    unknowns: readonly UnknownInformation[];
    strategicControlBenefit?: boolean;
  }): DecisionRobustnessResult {
    const reasons: string[] = [];
    const resolutions = this.contradictionEngine.resolve(input.contradictions, input.evidence);
    if (input.dataQuality.status === "BLOCKED" || input.dataQuality.status === "REMEDIATE_FIRST")
      reasons.push(...input.dataQuality.reasons);
    const unresolved = resolutions.filter((item) => item.state === "UNRESOLVED_MATERIAL");
    if (unresolved.length) reasons.push("material contradiction remains unresolved");
    const requiredEconomicFields = [
      "implementationCost",
      "maintenanceCost",
      "expectedTimeReduction",
      "expectedAutomationCoverage",
      "expectedAdoptionRate",
    ];
    const availableEconomicFields = new Set(input.economicInputs.map((item) => item.name));
    const unknownEconomics =
      input.economicSignal === "INSUFFICIENT_EVIDENCE" ||
      input.economicInputs.some((item) => item.value === null) ||
      requiredEconomicFields.some((field) => !availableEconomicFields.has(field));
    if (unknownEconomics) reasons.push("economic inputs are incomplete");
    if (input.economicSignal === "NEGATIVE_VALUE" && !input.strategicControlBenefit)
      reasons.push("economic direction is negative");
    const decision: RobustDecision =
      input.dataQuality.status === "BLOCKED" || input.dataQuality.status === "REMEDIATE_FIRST"
        ? "REMEDIATE_FIRST"
        : input.economicSignal === "NEGATIVE_VALUE" && !input.strategicControlBenefit
          ? "REJECT"
          : input.economicSignal === "MARGINAL" && !input.strategicControlBenefit
            ? "DEFER"
            : unresolved.length || input.unknowns.length || unknownEconomics
              ? "NEED_MORE_EVIDENCE"
              : "ALLOW";
    return Object.freeze({
      decision,
      reasons: Object.freeze(reasons),
      rationale:
        decision === "REMEDIATE_FIRST"
          ? "Data quality prerequisites must be completed before automation"
          : decision === "REJECT"
            ? "Expected value does not justify automation"
            : decision === "NEED_MORE_EVIDENCE"
              ? "Decision-critical evidence is incomplete or contradictory"
              : decision === "DEFER"
                ? "Value is marginal and requires explicit prioritization"
                : "Decision gates passed",
      contradictionResolution: resolutions,
      economicallyUncertain: unknownEconomics,
    });
  }
}
