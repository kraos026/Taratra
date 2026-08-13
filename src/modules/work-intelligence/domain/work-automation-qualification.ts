import type { AutomationCandidate } from "./work-intelligence";
import { WorkIntelligenceError } from "./work-intelligence";

export type WorkKnowledgeGapCode =
  | "CONFIDENCE_INSUFFICIENT"
  | "OBSERVATIONS_INSUFFICIENT"
  | "OBSERVED_TRIGGER_UNKNOWN"
  | "PROCESS_ORDER_UNCERTAIN"
  | "SYSTEM_IDENTITY_UNCERTAIN"
  | "OBSERVED_OUTPUT_UNKNOWN"
  | "HUMAN_JUDGMENT_UNCLEAR"
  | "PROVENANCE_INCOMPLETE";
export type WorkKnowledgeGapResolver = "HUMAN" | "AUDIT" | "CONNECTOR_METADATA" | "INFERENCE";

export interface WorkKnowledgeGap {
  readonly code: WorkKnowledgeGapCode;
  readonly reason: string;
  readonly provenance: readonly string[];
  readonly resolvableBy: readonly WorkKnowledgeGapResolver[];
}

export interface ObservedProcessStepInput {
  readonly stepId: string;
  readonly order: number;
  readonly observedDescription: string;
  readonly observedTools: readonly string[];
  readonly observedInputs: readonly string[];
  readonly observedOutputs: readonly string[];
  readonly confidence: number;
  readonly provenance: readonly string[];
  readonly uncertainty: readonly string[];
}

export type ObservedProcessStep = ObservedProcessStepInput;

export class ObservedProcessSequence {
  readonly steps: readonly Readonly<ObservedProcessStep>[];
  readonly confidence: number;
  readonly provenance: readonly string[];

  private constructor(steps: readonly ObservedProcessStepInput[]) {
    if (steps.length === 0) throw new WorkIntelligenceError("Observed process requires steps");
    const ids = new Set<string>();
    const orders = new Set<number>();
    this.steps = Object.freeze(
      [...steps]
        .map((step) => {
          const stepId = required(step.stepId, "Observed step id");
          if (ids.has(stepId))
            throw new WorkIntelligenceError(`Duplicate observed step: ${stepId}`);
          if (!Number.isInteger(step.order) || step.order < 0 || orders.has(step.order))
            throw new WorkIntelligenceError("Observed step order must be unique and non-negative");
          ids.add(stepId);
          orders.add(step.order);
          if (step.confidence < 0 || step.confidence > 100)
            throw new WorkIntelligenceError("Observed step confidence must be between 0 and 100");
          const provenance = strings(step.provenance);
          if (provenance.length === 0)
            throw new WorkIntelligenceError("Observed step provenance is required");
          return Object.freeze({
            ...step,
            stepId,
            observedDescription: required(step.observedDescription, "Observed step description"),
            observedTools: strings(step.observedTools),
            observedInputs: strings(step.observedInputs),
            observedOutputs: strings(step.observedOutputs),
            provenance,
            uncertainty: strings(step.uncertainty),
          });
        })
        .sort((left, right) => left.order - right.order),
    );
    this.confidence = Math.round(
      this.steps.reduce((sum, step) => sum + step.confidence, 0) / this.steps.length,
    );
    this.provenance = strings(this.steps.flatMap((step) => step.provenance));
    Object.freeze(this);
  }

  static create(steps: readonly ObservedProcessStepInput[]): ObservedProcessSequence {
    return new ObservedProcessSequence(steps);
  }
}

export interface WorkQualificationContext {
  readonly observedTrigger: string | null;
  readonly systemIdentitiesConfirmed: boolean;
  readonly observedOutputsConfirmed: boolean;
  readonly humanJudgmentConfirmed: boolean;
  readonly provenance: readonly string[];
}

export type CandidateAssessmentStatus =
  "NOT_READY" | "NEEDS_INFORMATION" | "QUALIFIED" | "REJECTED";

export interface AutomationCandidateAssessment {
  readonly assessmentId: string;
  readonly version: number;
  readonly status: CandidateAssessmentStatus;
  readonly candidate: AutomationCandidate;
  readonly observedProcess: ObservedProcessSequence;
  readonly gaps: readonly WorkKnowledgeGap[];
  readonly provenance: readonly string[];
}

export class AutomationCandidateQualifier {
  assess(
    candidate: AutomationCandidate,
    observedProcess: ObservedProcessSequence,
    context: WorkQualificationContext,
    version = 1,
    reviewProvenance: readonly string[] = [],
  ): AutomationCandidateAssessment {
    const gaps = detectGaps(candidate, observedProcess, context);
    const fundamental = gaps.some((gap) =>
      ["CONFIDENCE_INSUFFICIENT", "OBSERVATIONS_INSUFFICIENT", "PROVENANCE_INCOMPLETE"].includes(
        gap.code,
      ),
    );
    return Object.freeze({
      assessmentId: `${candidate.candidateId}:work-assessment`,
      version,
      status: fundamental ? "NOT_READY" : gaps.length ? "NEEDS_INFORMATION" : "QUALIFIED",
      candidate,
      observedProcess,
      gaps: Object.freeze(gaps),
      provenance: strings([
        ...candidate.provenance,
        candidate.candidateId,
        candidate.sourceHypothesisId,
        ...candidate.sourcePatternIds,
        ...candidate.supportingObservationIds,
        ...observedProcess.provenance,
        ...context.provenance,
        ...reviewProvenance,
      ]),
    });
  }
}

export type WorkQualificationReviewDecision =
  "ACCEPT" | "REJECT" | "CORRECT" | "SUPPLY_MISSING_INFORMATION";

export class WorkQualificationReviewService {
  constructor(private readonly qualifier = new AutomationCandidateQualifier()) {}

  review(
    assessment: AutomationCandidateAssessment,
    decision: WorkQualificationReviewDecision,
    reviewerId: string,
    correction?: { observedProcess?: ObservedProcessSequence; context?: WorkQualificationContext },
  ): AutomationCandidateAssessment {
    const marker = `human-review:${required(reviewerId, "Reviewer id")}:${decision}`;
    if (decision === "REJECT")
      return Object.freeze({
        ...assessment,
        version: assessment.version + 1,
        status: "REJECTED",
        provenance: strings([...assessment.provenance, marker]),
      });
    if (decision === "ACCEPT") {
      if (assessment.status !== "QUALIFIED")
        throw new WorkIntelligenceError("Only a qualified assessment can be accepted");
      return Object.freeze({
        ...assessment,
        version: assessment.version + 1,
        provenance: strings([...assessment.provenance, marker]),
      });
    }
    if (!correction?.context)
      throw new WorkIntelligenceError("Correction requires current-work qualification context");
    return this.qualifier.assess(
      assessment.candidate,
      correction.observedProcess ?? assessment.observedProcess,
      correction.context,
      assessment.version + 1,
      [marker],
    );
  }
}

function detectGaps(
  candidate: AutomationCandidate,
  sequence: ObservedProcessSequence,
  context: WorkQualificationContext,
): WorkKnowledgeGap[] {
  const gaps: WorkKnowledgeGap[] = [];
  const add = (
    condition: boolean,
    code: WorkKnowledgeGapCode,
    reason: string,
    resolvableBy: readonly WorkKnowledgeGapResolver[],
  ) => {
    if (condition)
      gaps.push(
        Object.freeze({
          code,
          reason,
          provenance: strings([...candidate.provenance, ...context.provenance]),
          resolvableBy: Object.freeze([...resolvableBy]),
        }),
      );
  };
  add(candidate.confidence < 50, "CONFIDENCE_INSUFFICIENT", "Candidate confidence is below 50", [
    "AUDIT",
    "HUMAN",
  ]);
  add(
    candidate.supportingObservationIds.length < 3,
    "OBSERVATIONS_INSUFFICIENT",
    "At least three observations are required",
    ["AUDIT"],
  );
  add(
    candidate.provenance.length === 0,
    "PROVENANCE_INCOMPLETE",
    "Candidate provenance is required",
    ["AUDIT"],
  );
  add(
    !context.observedTrigger,
    "OBSERVED_TRIGGER_UNKNOWN",
    "The current-work trigger is not observed",
    ["HUMAN", "AUDIT"],
  );
  add(
    sequence.steps.some((step) => step.uncertainty.length > 0),
    "PROCESS_ORDER_UNCERTAIN",
    "Observed process ordering contains uncertainty",
    ["HUMAN", "AUDIT"],
  );
  add(
    !context.systemIdentitiesConfirmed,
    "SYSTEM_IDENTITY_UNCERTAIN",
    "Observed system identities are uncertain",
    ["HUMAN", "CONNECTOR_METADATA"],
  );
  add(
    !context.observedOutputsConfirmed,
    "OBSERVED_OUTPUT_UNKNOWN",
    "Current-work outputs are unknown",
    ["HUMAN", "AUDIT"],
  );
  add(
    !context.humanJudgmentConfirmed,
    "HUMAN_JUDGMENT_UNCLEAR",
    "Human judgment requirement is unconfirmed",
    ["HUMAN"],
  );
  return gaps;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new WorkIntelligenceError(`${label} is required`);
  return normalized;
}

function strings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => required(value, "Value")))].sort());
}
