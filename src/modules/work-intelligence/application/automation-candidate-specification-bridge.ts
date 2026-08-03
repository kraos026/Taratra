import type {
  AutomationSpecificationInput,
  PublishedBlueprint,
  SpecificationRule,
} from "../../automation-specifications/domain/automation-specification";
import type { AutomationCandidate, TimeRoiBaseline } from "../domain/work-intelligence";
import { WorkIntelligenceError } from "../domain/work-intelligence";

export type CandidateQualificationStatus =
  "NOT_READY" | "NEEDS_INFORMATION" | "READY_FOR_DRAFT" | "READY_FOR_REVIEW";
export type KnowledgeGapSeverity = "ERROR" | "WARNING" | "INFORMATION";
export type KnowledgeGapResolver = "HUMAN" | "CONNECTOR_METADATA" | "AUDIT" | "INFERENCE";
export type KnowledgeGapCode =
  | "CONFIDENCE_INSUFFICIENT"
  | "OBSERVATIONS_INSUFFICIENT"
  | "NORMALIZED_PATTERN_UNKNOWN"
  | "TRIGGER_UNKNOWN"
  | "INPUT_SCHEMA_UNKNOWN"
  | "OUTPUT_UNKNOWN"
  | "SYSTEM_MAPPING_UNKNOWN"
  | "BUSINESS_RULE_UNKNOWN"
  | "ERROR_POLICY_UNKNOWN"
  | "APPROVAL_POLICY_REQUIRED"
  | "HUMAN_REVIEW_REQUIRED"
  | "PROVENANCE_INCOMPLETE"
  | "SOLUTION_BLUEPRINT_REQUIRED";

export interface KnowledgeGap {
  readonly code: KnowledgeGapCode;
  readonly severity: KnowledgeGapSeverity;
  readonly reason: string;
  readonly provenance: readonly string[];
  readonly resolvableBy: readonly KnowledgeGapResolver[];
}

export type ProcessSkeletonStepKind =
  | "TRIGGER"
  | "READ_INPUT"
  | "LOOKUP_CONTEXT"
  | "TRANSFORM_OR_CLASSIFY"
  | "DECISION"
  | "HUMAN_APPROVAL"
  | "ACTION";

export interface CandidateProcessKnowledge {
  readonly stepId: string;
  readonly kind: ProcessSkeletonStepKind;
  readonly requiredCapability: string;
  readonly knownInputs: readonly string[];
  readonly knownOutputs: readonly string[];
  readonly confidence: number;
  readonly provenance: readonly string[];
}

export interface CandidateSpecificationKnowledge {
  readonly normalizedPattern: string | null;
  readonly objective: string | null;
  readonly trigger: string | null;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly systems: readonly string[];
  readonly capabilities: readonly string[];
  readonly processSteps: readonly CandidateProcessKnowledge[];
  readonly businessRules: readonly string[];
  readonly errorPolicy: string | null;
  readonly approvalPolicy: string | null;
  readonly provenance: readonly string[];
  readonly solutionBlueprint: PublishedBlueprint | null;
}

export interface CandidateQualification {
  readonly status: CandidateQualificationStatus;
  readonly gaps: readonly KnowledgeGap[];
  readonly confidence: number;
  readonly explanation: string;
}

export interface ProcessSkeletonStep extends CandidateProcessKnowledge {
  readonly uncertainty: readonly KnowledgeGapCode[];
}

export interface ProcessSkeleton {
  readonly steps: readonly ProcessSkeletonStep[];
  readonly confidence: number;
  readonly provenance: readonly string[];
}

export type SpecificationDraftStatus = "DRAFT" | "REVIEWED" | "REJECTED";

export interface AutomationSpecificationDraft {
  readonly draftId: string;
  readonly version: number;
  readonly status: SpecificationDraftStatus;
  readonly tenantId: string;
  readonly companyId: string;
  readonly candidate: AutomationCandidate;
  readonly objective: string | null;
  readonly trigger: string | null;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly capabilities: readonly string[];
  readonly systems: readonly string[];
  readonly constraints: readonly string[];
  readonly processSkeleton: ProcessSkeleton;
  readonly expectedBenefit: Readonly<TimeRoiBaseline>;
  readonly riskClassification: "LOW" | "MEDIUM" | "HIGH";
  readonly requiresHumanApproval: boolean;
  readonly confidence: number;
  readonly gaps: readonly KnowledgeGap[];
  readonly provenance: readonly string[];
  readonly knowledge: CandidateSpecificationKnowledge;
}

export class AutomationCandidateQualifier {
  qualify(
    candidate: AutomationCandidate,
    knowledge: CandidateSpecificationKnowledge,
  ): CandidateQualification {
    const gaps = detectGaps(candidate, knowledge);
    const fundamental = gaps.some((gap) =>
      ["CONFIDENCE_INSUFFICIENT", "OBSERVATIONS_INSUFFICIENT", "PROVENANCE_INCOMPLETE"].includes(
        gap.code,
      ),
    );
    const blocking = gaps.some((gap) => gap.severity === "ERROR");
    const status: CandidateQualificationStatus = fundamental
      ? "NOT_READY"
      : blocking
        ? "NEEDS_INFORMATION"
        : candidate.requiresHumanApproval
          ? "READY_FOR_REVIEW"
          : "READY_FOR_DRAFT";
    return Object.freeze({
      status,
      gaps: Object.freeze(gaps),
      confidence: candidate.confidence,
      explanation: `${status}: ${gaps.length} explicit knowledge gap(s); automation score alone is not specification readiness.`,
    });
  }
}

export class AutomationSpecificationDraftBuilder {
  constructor(private readonly qualifier = new AutomationCandidateQualifier()) {}

  build(
    candidate: AutomationCandidate,
    knowledge: CandidateSpecificationKnowledge,
    version = 1,
    reviewProvenance: readonly string[] = [],
  ): AutomationSpecificationDraft {
    if (candidate.automationLevel === "HUMAN_ONLY")
      throw new WorkIntelligenceError("HUMAN_ONLY candidate cannot produce a specification draft");
    const qualification = this.qualifier.qualify(candidate, knowledge);
    const provenance = unique([
      ...candidate.provenance,
      candidate.candidateId,
      candidate.sourceOpportunityId,
      ...candidate.sourcePatternIds,
      ...candidate.supportingObservationIds,
      ...knowledge.provenance,
      ...reviewProvenance,
    ]);
    return deepFreeze({
      draftId: `${candidate.candidateId}:specification-draft`,
      version,
      status: "DRAFT" as const,
      tenantId: candidate.tenantId,
      companyId: candidate.companyId,
      candidate,
      objective: knowledge.objective,
      trigger: knowledge.trigger,
      inputs: unique(knowledge.inputs),
      outputs: unique(knowledge.outputs),
      capabilities: unique(knowledge.capabilities),
      systems: unique(knowledge.systems),
      constraints: candidate.requiresHumanApproval
        ? Object.freeze(["HUMAN_APPROVAL_REQUIRED"])
        : Object.freeze([]),
      processSkeleton: skeleton(knowledge),
      expectedBenefit: candidate.expectedBenefit,
      riskClassification: candidate.riskClassification,
      requiresHumanApproval: candidate.requiresHumanApproval,
      confidence: candidate.confidence,
      gaps: qualification.gaps,
      provenance,
      knowledge: freezeKnowledge(knowledge),
    });
  }
}

export type HumanReviewDecision = "ACCEPT" | "REJECT" | "CORRECT" | "SUPPLY_MISSING_INFORMATION";

export interface HumanReviewCommand {
  readonly decision: HumanReviewDecision;
  readonly reviewerId: string;
  readonly knowledge?: Partial<CandidateSpecificationKnowledge>;
}

export class AutomationSpecificationDraftReviewService {
  constructor(
    private readonly builder = new AutomationSpecificationDraftBuilder(),
    private readonly readiness = new SpecificationDraftReadinessValidator(),
  ) {}

  review(
    draft: AutomationSpecificationDraft,
    command: HumanReviewCommand,
  ): AutomationSpecificationDraft {
    const marker = `human-review:${required(command.reviewerId)}:${command.decision}`;
    if (command.decision === "REJECT")
      return deepFreeze({
        ...draft,
        version: draft.version + 1,
        status: "REJECTED",
        provenance: unique([...draft.provenance, marker]),
      });
    if (command.decision === "ACCEPT") {
      if (draft.gaps.some((gap) => gap.severity === "ERROR"))
        throw new WorkIntelligenceError("Blocked draft cannot be accepted");
      return deepFreeze({
        ...draft,
        version: draft.version + 1,
        status: "REVIEWED",
        provenance: unique([...draft.provenance, marker]),
      });
    }
    if (!command.knowledge)
      throw new WorkIntelligenceError("Human correction requires supplied knowledge");
    const knowledge = mergeKnowledge(draft.knowledge, command.knowledge);
    return this.builder.build(draft.candidate, knowledge, draft.version + 1, [marker]);
  }
}

export interface SpecificationDraftReadiness {
  readonly status: "READY" | "BLOCKED_BY_GAPS";
  readonly blockingGaps: readonly KnowledgeGap[];
}

export class SpecificationDraftReadinessValidator {
  validate(draft: AutomationSpecificationDraft): SpecificationDraftReadiness {
    const blockingGaps = [...draft.gaps.filter((gap) => gap.severity === "ERROR")];
    if (draft.requiresHumanApproval && draft.status !== "REVIEWED")
      blockingGaps.push(
        Object.freeze({
          code: "HUMAN_REVIEW_REQUIRED",
          severity: "ERROR",
          reason: "An authorized human must accept this draft before handoff",
          provenance: draft.provenance,
          resolvableBy: Object.freeze(["HUMAN"] as const),
        }),
      );
    return Object.freeze({
      status: blockingGaps.length === 0 ? "READY" : "BLOCKED_BY_GAPS",
      blockingGaps: Object.freeze(blockingGaps),
    });
  }
}

export interface ExistingSpecificationHandoff {
  readonly input: AutomationSpecificationInput;
  readonly sourceCandidateId: string;
  readonly sourceDraftId: string;
  readonly sourceDraftVersion: number;
  readonly provenance: readonly string[];
}

export class ExistingAutomationSpecificationAdapter {
  constructor(private readonly readiness = new SpecificationDraftReadinessValidator()) {}

  adapt(
    draft: AutomationSpecificationDraft,
    rules: readonly SpecificationRule[],
  ): ExistingSpecificationHandoff {
    if (this.readiness.validate(draft).status !== "READY")
      throw new WorkIntelligenceError("Specification draft is blocked by knowledge gaps");
    const blueprint = draft.knowledge.solutionBlueprint;
    if (!blueprint || blueprint.status !== "published")
      throw new WorkIntelligenceError("A published Solution Blueprint is required");
    if (blueprint.organizationId !== draft.tenantId)
      throw new WorkIntelligenceError("Solution Blueprint belongs to another tenant");
    const publishedRules = rules.filter((rule) => rule.published);
    if (!publishedRules.some((rule) => rule.ruleType === "transformation"))
      throw new WorkIntelligenceError("Published specification transformation rules are required");
    if (!publishedRules.some((rule) => rule.ruleType === "validation"))
      throw new WorkIntelligenceError("Published specification validation rules are required");
    return deepFreeze({
      input: { blueprint, rules: [...publishedRules] },
      sourceCandidateId: draft.candidate.candidateId,
      sourceDraftId: draft.draftId,
      sourceDraftVersion: draft.version,
      provenance: draft.provenance,
    });
  }
}

function detectGaps(
  candidate: AutomationCandidate,
  knowledge: CandidateSpecificationKnowledge,
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const add = (
    condition: boolean,
    code: KnowledgeGapCode,
    reason: string,
    resolvableBy: readonly KnowledgeGapResolver[],
  ) => {
    if (condition)
      gaps.push(
        Object.freeze({
          code,
          severity: "ERROR" as const,
          reason,
          provenance: Object.freeze([...candidate.provenance]),
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
    "At least three supporting observations are required",
    ["AUDIT"],
  );
  add(
    candidate.provenance.length === 0,
    "PROVENANCE_INCOMPLETE",
    "Candidate provenance is required",
    ["AUDIT"],
  );
  add(
    !knowledge.normalizedPattern,
    "NORMALIZED_PATTERN_UNKNOWN",
    "Normalized work pattern is unknown",
    ["AUDIT", "HUMAN"],
  );
  add(!knowledge.trigger, "TRIGGER_UNKNOWN", "Trigger is unknown", ["HUMAN", "CONNECTOR_METADATA"]);
  add(knowledge.inputs.length === 0, "INPUT_SCHEMA_UNKNOWN", "Input contract is unknown", [
    "HUMAN",
    "CONNECTOR_METADATA",
  ]);
  add(knowledge.outputs.length === 0, "OUTPUT_UNKNOWN", "Output contract is unknown", [
    "HUMAN",
    "CONNECTOR_METADATA",
  ]);
  add(knowledge.systems.length === 0, "SYSTEM_MAPPING_UNKNOWN", "System mapping is unknown", [
    "HUMAN",
    "CONNECTOR_METADATA",
  ]);
  add(
    knowledge.capabilities.length === 0 ||
      knowledge.processSteps.length === 0 ||
      knowledge.businessRules.length === 0,
    "BUSINESS_RULE_UNKNOWN",
    "Capability process is incomplete",
    ["HUMAN", "AUDIT"],
  );
  add(!knowledge.errorPolicy, "ERROR_POLICY_UNKNOWN", "Error policy is unknown", ["HUMAN"]);
  add(
    candidate.requiresHumanApproval && !knowledge.approvalPolicy,
    "APPROVAL_POLICY_REQUIRED",
    "Human approval policy is required",
    ["HUMAN"],
  );
  add(
    !knowledge.solutionBlueprint,
    "SOLUTION_BLUEPRINT_REQUIRED",
    "Existing pipeline requires a published Solution Blueprint",
    ["HUMAN"],
  );
  return gaps;
}

function skeleton(knowledge: CandidateSpecificationKnowledge): ProcessSkeleton {
  const steps = knowledge.processSteps.map((step) =>
    deepFreeze({
      ...step,
      knownInputs: unique(step.knownInputs),
      knownOutputs: unique(step.knownOutputs),
      provenance: unique(step.provenance),
      uncertainty: Object.freeze([
        ...(step.knownInputs.length === 0 ? (["INPUT_SCHEMA_UNKNOWN"] as const) : []),
        ...(step.knownOutputs.length === 0 ? (["OUTPUT_UNKNOWN"] as const) : []),
      ]),
    }),
  );
  const confidence = steps.length
    ? Math.round(steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length)
    : 0;
  return deepFreeze({
    steps,
    confidence,
    provenance: unique(steps.flatMap((step) => step.provenance)),
  });
}

function freezeKnowledge(value: CandidateSpecificationKnowledge): CandidateSpecificationKnowledge {
  return deepFreeze({
    ...value,
    inputs: unique(value.inputs),
    outputs: unique(value.outputs),
    systems: unique(value.systems),
    capabilities: unique(value.capabilities),
    businessRules: unique(value.businessRules),
    provenance: unique(value.provenance),
    processSteps: value.processSteps.map((step) => deepFreeze({ ...step })),
  });
}

function mergeKnowledge(
  current: CandidateSpecificationKnowledge,
  correction: Partial<CandidateSpecificationKnowledge>,
): CandidateSpecificationKnowledge {
  return freezeKnowledge({ ...current, ...correction });
}

function required(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new WorkIntelligenceError("Value is required");
  return normalized;
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map(required))].sort());
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
