import type { IntegratedBrainResult } from "./brain-integration";
import type { ScenarioDataset, SyntheticGroundTruth } from "./synthetic-enterprise-lab";

export const DUAL_MODE_EVALUATOR_VERSION = "evaluator-v2-evidence-conditional";

export type DualEvaluationMode = "GROUND_TRUTH_DIAGNOSTIC" | "EVIDENCE_CONDITIONAL_DECISION";
export type DualFailureClassification =
  | "REASONING_FAILURE"
  | "DISCOVERY_FAILURE"
  | "EXTRACTION_FAILURE"
  | "OBSERVABILITY_LIMIT"
  | "SAFE_ABSTENTION"
  | "UNSAFE_OVERREACH"
  | "SEMANTIC_MATCH_FAILURE";
export type ObservabilityState =
  "OBSERVABLE" | "PARTIALLY_OBSERVABLE" | "NOT_YET_OBSERVABLE" | "HIDDEN" | "AMBIGUOUS";

/** Explicit allow-list of information available to Brain at evaluation time. */
export interface ObservableInformationSet {
  readonly actorFacts?: readonly string[];
  readonly actorBeliefs?: readonly string[];
  readonly interviewEvidence?: readonly string[];
  readonly documentEvidence?: readonly string[];
  readonly systemEvidence?: readonly string[];
  readonly processEvidence?: readonly string[];
  readonly acceptedClaims?: readonly string[];
  readonly requiredSignals?: readonly string[];
}

export interface EvaluationExpectationPrerequisite {
  readonly rootCauseSignals?: readonly string[];
  readonly bottleneckSignals?: readonly string[];
  readonly economicSignals?: readonly string[];
}

export interface DualModeEvaluationInput {
  readonly scenario: ScenarioDataset;
  readonly groundTruth: SyntheticGroundTruth;
  readonly brainResult: IntegratedBrainResult;
  readonly observable: ObservableInformationSet;
  readonly prerequisites?: EvaluationExpectationPrerequisite;
}

export interface DualModeEvaluationResult {
  readonly evaluatorVersion: string;
  readonly mode: DualEvaluationMode;
  readonly status: "PASS" | "PASS_WITH_WARNINGS" | "FAIL";
  readonly score: number;
  readonly rootCauseResult: "MATCH" | "MISS" | "NOT_EVALUATED";
  readonly observability: ObservabilityState;
  readonly decisionResult:
    "CORRECT_SAFE_ABSTENTION" | "CORRECT_DECISION" | "INCORRECT_DECISION" | "NOT_EVALUATED";
  readonly safeAbstention: boolean;
  readonly classifications: readonly DualFailureClassification[];
  readonly discoveryEffectivenessScore: number;
  readonly discoveryAction: "REQUEST_MISSING_EVIDENCE" | "NONE";
  readonly evidenceConditionalDecisionScore: number;
  readonly truthReconstructionScore: number;
  readonly rationale: string;
}

function values(input: ObservableInformationSet): readonly string[] {
  return [
    ...(input.actorFacts ?? []),
    ...(input.actorBeliefs ?? []),
    ...(input.interviewEvidence ?? []),
    ...(input.documentEvidence ?? []),
    ...(input.systemEvidence ?? []),
    ...(input.processEvidence ?? []),
    ...(input.acceptedClaims ?? []),
    ...(input.requiredSignals ?? []),
  ];
}

function hasSignal(input: ObservableInformationSet, signal: string): boolean {
  const normalized = signal.toLowerCase();
  return values(input).some((value) => value.toLowerCase().includes(normalized));
}

function observability(
  input: ObservableInformationSet,
  required: readonly string[],
): ObservabilityState {
  if (!required.length) return "AMBIGUOUS";
  const count = required.filter((signal) => hasSignal(input, signal)).length;
  if (count === required.length) return "OBSERVABLE";
  if (count > 0) return "PARTIALLY_OBSERVABLE";
  return "NOT_YET_OBSERVABLE";
}

function decision(result: IntegratedBrainResult): string {
  return result.opportunityDecisions[0]?.decision.decision ?? "NEED_MORE_EVIDENCE";
}

/** Adds evidence-conditional interpretation without changing the historical evaluator. */
export class DualModeBrainEvaluator {
  readonly evaluatorVersion = DUAL_MODE_EVALUATOR_VERSION;

  evaluateGroundTruth(input: DualModeEvaluationInput): DualModeEvaluationResult {
    const required = input.prerequisites?.rootCauseSignals ?? [input.groundTruth.trueRootCause];
    const state = observability(input.observable, required);
    const root = input.brainResult.causes.find((cause) => cause.kind === "ROOT");
    const match = root?.semanticKey === `cause:${input.groundTruth.trueRootCause}`;
    const classifications: DualFailureClassification[] = [];
    if (!match)
      classifications.push(
        state === "NOT_YET_OBSERVABLE" ? "OBSERVABILITY_LIMIT" : "SEMANTIC_MATCH_FAILURE",
      );
    const score = match ? 100 : state === "NOT_YET_OBSERVABLE" ? 0 : 0;
    return Object.freeze({
      evaluatorVersion: this.evaluatorVersion,
      mode: "GROUND_TRUTH_DIAGNOSTIC" as const,
      status: match ? "PASS" : "PASS_WITH_WARNINGS",
      score,
      rootCauseResult: match ? "MATCH" : "MISS",
      observability: state,
      decisionResult: "NOT_EVALUATED" as const,
      safeAbstention: false,
      classifications: Object.freeze(classifications),
      discoveryEffectivenessScore: 0,
      discoveryAction: "NONE",
      evidenceConditionalDecisionScore: 0,
      truthReconstructionScore: score,
      rationale: match
        ? "Root cause matches the synthetic world."
        : state === "NOT_YET_OBSERVABLE"
          ? "Miss is recorded, but required evidence was not observable."
          : "Observable causal evidence was available and the root cause was missed.",
    });
  }

  evaluateEvidenceConditional(input: DualModeEvaluationInput): DualModeEvaluationResult {
    const required = input.prerequisites?.rootCauseSignals ?? [input.groundTruth.trueRootCause];
    const state = observability(input.observable, required);
    const root = input.brainResult.causes.find((cause) => cause.kind === "ROOT");
    const currentDecision = decision(input.brainResult);
    const abstains = currentDecision === "NEED_MORE_EVIDENCE" || currentDecision === "DEFER";
    const classifications: DualFailureClassification[] = [];
    let decisionResult: DualModeEvaluationResult["decisionResult"] = "NOT_EVALUATED";
    let safeAbstention = false;
    if (state === "NOT_YET_OBSERVABLE" || state === "PARTIALLY_OBSERVABLE") {
      if (root && !abstains) classifications.push("UNSAFE_OVERREACH");
      else if (abstains) {
        classifications.push("SAFE_ABSTENTION");
        safeAbstention = true;
      }
      decisionResult = abstains ? "CORRECT_SAFE_ABSTENTION" : "INCORRECT_DECISION";
    } else if (root?.semanticKey === `cause:${input.groundTruth.trueRootCause}`) {
      decisionResult = "CORRECT_DECISION";
    } else {
      classifications.push("REASONING_FAILURE");
      decisionResult = "INCORRECT_DECISION";
    }
    const pass =
      classifications.every((item) => item === "SAFE_ABSTENTION") ||
      decisionResult === "CORRECT_DECISION";
    const score = pass ? 100 : 0;
    return Object.freeze({
      evaluatorVersion: this.evaluatorVersion,
      mode: "EVIDENCE_CONDITIONAL_DECISION" as const,
      status: pass ? (safeAbstention ? "PASS_WITH_WARNINGS" : "PASS") : "FAIL",
      score,
      rootCauseResult:
        root?.semanticKey === `cause:${input.groundTruth.trueRootCause}` ? "MATCH" : "MISS",
      observability: state,
      decisionResult,
      safeAbstention,
      classifications: Object.freeze(classifications),
      discoveryEffectivenessScore: input.brainResult.discoveryReadiness.blockingGapIds.length
        ? 100
        : 50,
      discoveryAction:
        state === "NOT_YET_OBSERVABLE" || state === "PARTIALLY_OBSERVABLE"
          ? "REQUEST_MISSING_EVIDENCE"
          : "NONE",
      evidenceConditionalDecisionScore: score,
      truthReconstructionScore: 0,
      rationale: safeAbstention
        ? "Insufficient observable evidence; NEED_MORE_EVIDENCE is the safe decision."
        : pass
          ? "Decision is supported by observable evidence."
          : "Decision is not supported by the observable information set.",
    });
  }

  evaluate(input: DualModeEvaluationInput): {
    readonly truthDiagnostic: DualModeEvaluationResult;
    readonly evidenceConditional: DualModeEvaluationResult;
  } {
    return Object.freeze({
      truthDiagnostic: this.evaluateGroundTruth(input),
      evidenceConditional: this.evaluateEvidenceConditional(input),
    });
  }
}
