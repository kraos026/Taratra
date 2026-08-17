import type { KnowledgeContextV3 } from "./knowledge-retrieval-engine";

export type AICandidateType =
  | "FACT_CANDIDATE"
  | "CLAIM_CANDIDATE"
  | "PROCESS_STEP_CANDIDATE"
  | "PROCESS_OBSERVATION_CANDIDATE"
  | "ENTITY_CANDIDATE"
  | "RELATIONSHIP_CANDIDATE"
  | "CAUSE_CANDIDATE"
  | "UNKNOWN_CANDIDATE"
  | "PATTERN_CANDIDATE"
  | "CLASSIFICATION_CANDIDATE"
  | "TERMINOLOGY_MAPPING"
  | "SUMMARY";
export type CandidateStatus = "AI_DERIVED" | "REVIEW_REQUIRED" | "VALIDATED" | "REJECTED";
export type ReviewRequirement = "NONE" | "OPTIONAL" | "REQUIRED";
export type AIFailure =
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_OUTPUT"
  | "SCHEMA_MISMATCH"
  | "SOURCE_GROUNDING_FAILURE"
  | "RATE_LIMITED"
  | "POLICY_REJECTED";

export interface AIInterpretationRequest {
  requestId: string;
  tenantId: string;
  companyId?: string;
  sourceId: string;
  sourceType: string;
  sourceText: string;
  task: string;
  schemaVersion: string;
  knowledgeContext?: KnowledgeContextV3;
  knownClaims?: readonly string[];
  knownUnknowns?: readonly string[];
  constraints?: readonly string[];
  language?: string;
  speakerRole?: string;
  traceContext?: Readonly<Record<string, string>>;
}
export interface AICandidate {
  candidateId: string;
  candidateType: AICandidateType;
  statement: string;
  value?: unknown;
  semantic?: AISemanticCandidate;
  sourceReference: string;
  sourceExcerpt?: string;
  confidenceHint?: number;
  rationale: string;
  knowledgeReferences: readonly string[];
  status: CandidateStatus;
  review: ReviewRequirement;
}

export type SemanticCandidateType =
  "TERMINOLOGY" | "BUSINESS_ENTITY" | "PROCESS_CONCEPT" | "RELATIONSHIP" | "STRUCTURED_FIELD";

export type SemanticEntityKind =
  | "CUSTOMER"
  | "SUPPLIER"
  | "ORDER"
  | "INVOICE"
  | "CASE"
  | "TICKET"
  | "NAMED_PERSON"
  | "EMPLOYEE_ROLE"
  | "DEPARTMENT"
  | "SYSTEM"
  | "APPROVAL"
  | "EXCEPTION"
  | "DOCUMENT"
  | "ASSET"
  | "UNKNOWN";

export type SemanticProcessConceptKind =
  | "ACTIVITY"
  | "HANDOFF"
  | "APPROVAL"
  | "QUEUE"
  | "REWORK"
  | "MANUAL_ENTRY"
  | "VALIDATION"
  | "EXCEPTION"
  | "DECISION_POINT"
  | "CONTROL"
  | "SYSTEM_INTERACTION"
  | "WAIT_STATE"
  | "UNKNOWN";

export type SemanticRelationshipKind =
  | "ACTIVITY_USES_SYSTEM"
  | "ACTOR_PERFORMS_TASK"
  | "DOCUMENT_TRIGGERS_ACTIVITY"
  | "APPROVAL_BLOCKS_PROCESS"
  | "SYSTEM_FEEDS_SYSTEM"
  | "DEPARTMENT_OWNS_PROCESS"
  | "POSSIBLE_CONTRADICTION"
  | "POSSIBLE_ALIAS";

export type SemanticAmbiguityLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "AMBIGUOUS";

export interface AISemanticSourceContext {
  readonly tenantId: string;
  readonly companyId: string;
  readonly sourceId: string;
  readonly sourceVersion: string | number;
  readonly locator: string;
}

export interface AISemanticRelationship {
  readonly relationshipType: SemanticRelationshipKind;
  readonly from: string;
  readonly to: string;
  readonly evidenceReferences: readonly string[];
}

export interface AISemanticCandidate {
  readonly rawTerm: string;
  readonly normalizedCandidate: string;
  readonly candidateType: SemanticCandidateType;
  readonly entityKind?: SemanticEntityKind;
  readonly processConceptKind?: SemanticProcessConceptKind;
  readonly sourceContext: AISemanticSourceContext;
  readonly possibleAliases: readonly string[];
  readonly possibleRelatedConcepts: readonly string[];
  readonly relationships: readonly AISemanticRelationship[];
  readonly ambiguity: SemanticAmbiguityLevel;
  readonly ambiguityReasons: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly providerMetadata: Readonly<{
    readonly provider: string;
    readonly model: string;
  }>;
  readonly authoritativeMerge: false;
  readonly factPromotion: false;
}
export interface AIInterpretationResult {
  requestId: string;
  provider: string;
  model: string;
  task: string;
  schemaVersion: string;
  candidates: readonly AICandidate[];
  sourceReferences: readonly string[];
  warnings: readonly string[];
  validationIssues: readonly string[];
  rawProviderMetadata?: Readonly<Record<string, string | number | boolean>>;
  createdAt: Date;
}
export interface AIProvider {
  readonly providerId: string;
  interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult>;
}
export interface AIModelPolicy {
  select(
    task: string,
    risk: "LOW" | "MEDIUM" | "HIGH",
  ): { model: string; schemaVersion: string; promptId: string; promptVersion: string };
}

export class AIOutputValidator {
  validate(request: AIInterpretationRequest, result: AIInterpretationResult): readonly string[] {
    const errors: string[] = [];
    if (result.requestId !== request.requestId) errors.push("request/result correlation mismatch");
    if (result.schemaVersion !== request.schemaVersion) errors.push("schema mismatch");
    const ids = new Set<string>();
    for (const candidate of result.candidates) {
      if (!candidate.candidateId || ids.has(candidate.candidateId))
        errors.push("duplicate candidate");
      ids.add(candidate.candidateId);
      if (!candidate.statement.trim()) errors.push("empty candidate statement");
      if (!candidate.sourceReference || !candidate.sourceReference.startsWith(request.sourceId))
        errors.push(`candidate ${candidate.candidateId} is not source grounded`);
      if (
        candidate.confidenceHint !== undefined &&
        (candidate.confidenceHint < 0 || candidate.confidenceHint > 1)
      )
        errors.push("invalid confidence hint");
      if (candidate.semantic) errors.push(...semanticErrors(request, candidate));
    }
    return Object.freeze(errors);
  }
}

export type PromotionOutcome =
  "ACCEPT_AS_EVIDENCE" | "ACCEPT_WITH_REVIEW" | "NEED_VALIDATION" | "REJECT";
export interface PromotionDecision {
  outcome: PromotionOutcome;
  reason: string;
  candidate: AICandidate;
}
export class CandidateEvidencePromotionGate {
  evaluate(candidate: AICandidate): PromotionDecision {
    if (candidate.semantic)
      return {
        outcome: "NEED_VALIDATION",
        reason: "Semantic interpretation candidates require Brain/Knowledge validation",
        candidate,
      };
    if (!candidate.sourceReference || !candidate.sourceExcerpt)
      return { outcome: "REJECT", reason: "Source grounding is required", candidate };
    if (
      candidate.candidateType !== "FACT_CANDIDATE" &&
      candidate.candidateType !== "PROCESS_OBSERVATION_CANDIDATE"
    )
      return {
        outcome: "NEED_VALIDATION",
        reason: "Only factual observations may become evidence",
        candidate,
      };
    if (candidate.review === "REQUIRED")
      return { outcome: "ACCEPT_WITH_REVIEW", reason: "Human review is required", candidate };
    return { outcome: "ACCEPT_AS_EVIDENCE", reason: "Direct source-grounded candidate", candidate };
  }
}

function semanticErrors(
  request: AIInterpretationRequest,
  candidate: AICandidate,
): readonly string[] {
  const semantic = candidate.semantic;
  if (!semantic) return [];
  const errors: string[] = [];
  if (semantic.sourceContext.tenantId !== request.tenantId)
    errors.push(`candidate ${candidate.candidateId} has cross-tenant semantic context`);
  if (request.companyId && semantic.sourceContext.companyId !== request.companyId)
    errors.push(`candidate ${candidate.candidateId} has cross-company semantic context`);
  if (semantic.sourceContext.sourceId !== request.sourceId)
    errors.push(`candidate ${candidate.candidateId} has non-source semantic context`);
  if (!semantic.evidenceReferences.length)
    errors.push(`candidate ${candidate.candidateId} semantic evidence is required`);
  if (semantic.authoritativeMerge !== false || semantic.factPromotion !== false)
    errors.push(`candidate ${candidate.candidateId} attempts authoritative semantic mutation`);
  for (const relationship of semantic.relationships) {
    if (!relationship.evidenceReferences.length)
      errors.push(`candidate ${candidate.candidateId} relationship evidence is required`);
    if (
      relationship.evidenceReferences.some((reference) => !reference.startsWith(request.sourceId))
    )
      errors.push(`candidate ${candidate.candidateId} relationship is not source grounded`);
  }
  return Object.freeze(errors);
}

export class AIInterpretationGateway {
  constructor(
    private readonly provider: AIProvider,
    private readonly validator = new AIOutputValidator(),
  ) {}
  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    if (!request.tenantId || !request.sourceText.trim())
      throw new Error("Invalid interpretation request");
    const result = await this.provider.interpret(request);
    const issues = this.validator.validate(request, result);
    if (issues.length) throw new Error(`AI output rejected: ${issues.join(", ")}`);
    return Object.freeze({
      ...result,
      candidates: Object.freeze(
        result.candidates.map((c) =>
          Object.freeze({
            ...c,
            semantic: c.semantic ? freezeSemantic(c.semantic) : undefined,
            status: "AI_DERIVED" as const,
          }),
        ),
      ),
      validationIssues: Object.freeze([]),
    });
  }
}

function freezeSemantic(semantic: AISemanticCandidate): AISemanticCandidate {
  return Object.freeze({
    ...semantic,
    sourceContext: Object.freeze({ ...semantic.sourceContext }),
    possibleAliases: Object.freeze([...semantic.possibleAliases]),
    possibleRelatedConcepts: Object.freeze([...semantic.possibleRelatedConcepts]),
    relationships: Object.freeze(
      semantic.relationships.map((relationship) =>
        Object.freeze({
          ...relationship,
          evidenceReferences: Object.freeze([...relationship.evidenceReferences]),
        }),
      ),
    ),
    ambiguityReasons: Object.freeze([...semantic.ambiguityReasons]),
    evidenceReferences: Object.freeze([...semantic.evidenceReferences]),
    providerMetadata: Object.freeze({ ...semantic.providerMetadata }),
  });
}

export class DeterministicAIProvider implements AIProvider {
  readonly providerId = "deterministic-test-provider";
  constructor(
    private readonly mode:
      "valid" | "hallucination" | "duplicate" | "timeout" | "rate_limit" = "valid",
  ) {}
  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    if (this.mode === "timeout") throw new Error("TIMEOUT");
    if (this.mode === "rate_limit") throw new Error("RATE_LIMITED");
    const sourceReference =
      this.mode === "hallucination" ? "other-source:1" : `${request.sourceId}:1`;
    const candidate: AICandidate = {
      candidateId: "candidate-1",
      candidateType: request.task === "CAUSE" ? "CAUSE_CANDIDATE" : "FACT_CANDIDATE",
      statement: "Operator manually copies orders from CRM into ERP",
      sourceReference,
      sourceExcerpt: request.sourceText.slice(0, 80),
      confidenceHint: 0.8,
      rationale: "Deterministic extraction",
      knowledgeReferences: [],
      status: "AI_DERIVED",
      review: request.task === "CAUSE" ? "REQUIRED" : "OPTIONAL",
    };
    const candidates = this.mode === "duplicate" ? [candidate, { ...candidate }] : [candidate];
    return Object.freeze({
      requestId: request.requestId,
      provider: this.providerId,
      model: "fixture-model",
      task: request.task,
      schemaVersion: request.schemaVersion,
      candidates: Object.freeze(candidates),
      sourceReferences: Object.freeze([request.sourceId]),
      warnings: Object.freeze([]),
      validationIssues: Object.freeze([]),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
  }
}
