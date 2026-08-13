export type BrainModule =
  | "discovery"
  | "interview"
  | "enterprise_knowledge"
  | "work_intelligence"
  | "process_mapping"
  | "business_analysis"
  | "ai_opportunities"
  | "automation_opportunities"
  | "roi"
  | "recommendations"
  | "solution_blueprint"
  | "automation_specification"
  | "executive_result"
  | "brain_evaluation";

export type EvidenceSourceType =
  "DECLARED" | "OBSERVED" | "DOCUMENT" | "METRIC" | "SYSTEM_RECORD" | "INTERVIEW";

export type EvidenceFreshness = "CURRENT" | "RECENT" | "STALE" | "UNKNOWN";
export type ClaimKind = "FACT" | "INFERENCE" | "HYPOTHESIS" | "UNKNOWN";
export type ClaimStatus = "ACTIVE" | "CONTRADICTED" | "SUPERSEDED" | "REQUIRES_CLARIFICATION";
export type ContradictionKind =
  "QUANTITATIVE" | "QUALITATIVE" | "ACTOR_REPORT" | "STALE_VS_CURRENT" | "EVIDENCE_VS_ASSUMPTION";
export type ContradictionMateriality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type UnknownPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DecisionType =
  "RECOMMEND" | "REJECT" | "DEFER" | "HUMAN_ASSISTED" | "NEED_MORE_EVIDENCE";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{1,127}$/;

export class BrainContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainContractError";
  }
}

export class EvidenceId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static create(value: string): EvidenceId {
    return new EvidenceId(identifier(value, "Evidence id"));
  }
}

export class ClaimId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static create(value: string): ClaimId {
    return new ClaimId(identifier(value, "Claim id"));
  }
}

export class ContradictionId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static create(value: string): ContradictionId {
    return new ContradictionId(identifier(value, "Contradiction id"));
  }
}

export class DecisionId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static create(value: string): DecisionId {
    return new DecisionId(identifier(value, "Decision id"));
  }
}

export interface EvidenceInput {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  sourceReference: string;
  sourceModule: BrainModule;
  capturedAt: Date;
  freshness: EvidenceFreshness;
  reliability: number;
  content: string;
  structuredValue?: unknown;
  provenance: Readonly<Record<string, unknown>>;
  tenantId?: string;
  companyId?: string;
  tags?: readonly string[];
  categories?: readonly string[];
}

export class Evidence {
  readonly evidenceId: string;
  readonly sourceType: EvidenceSourceType;
  readonly sourceReference: string;
  readonly sourceModule: BrainModule;
  readonly capturedAt: Date;
  readonly freshness: EvidenceFreshness;
  readonly reliability: number;
  readonly content: string;
  readonly structuredValue: unknown;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly tenantId: string | null;
  readonly companyId: string | null;
  readonly tags: readonly string[];
  readonly categories: readonly string[];

  private constructor(input: EvidenceInput) {
    this.evidenceId = EvidenceId.create(input.evidenceId).value;
    this.sourceType = oneOf(
      input.sourceType,
      ["DECLARED", "OBSERVED", "DOCUMENT", "METRIC", "SYSTEM_RECORD", "INTERVIEW"],
      "Evidence source type",
    );
    this.sourceReference = required(input.sourceReference, "Evidence source reference");
    this.sourceModule = brainModule(input.sourceModule);
    this.capturedAt = date(input.capturedAt, "Evidence captured at");
    this.freshness = oneOf(
      input.freshness,
      ["CURRENT", "RECENT", "STALE", "UNKNOWN"],
      "Evidence freshness",
    );
    this.reliability = normalized(input.reliability, "Evidence reliability");
    this.content = required(input.content, "Evidence content");
    this.structuredValue = cloneUnknown(input.structuredValue);
    this.provenance = immutableRecord(input.provenance, "Evidence provenance");
    this.tenantId = optional(input.tenantId);
    this.companyId = optional(input.companyId);
    this.tags = strings(input.tags ?? []);
    this.categories = strings(input.categories ?? []);
    Object.freeze(this);
  }

  static create(input: EvidenceInput): Evidence {
    return new Evidence(input);
  }
}

export interface ConfidenceFactorsInput {
  supportingEvidenceCount: number;
  averageSourceReliability: number;
  sourceAgreement: number;
  freshness: number;
  directness: number;
  contradictionPenalty: number;
  missingDataPenalty: number;
}

export class Confidence {
  readonly value: number;
  readonly factors: ConfidenceFactorsInput;
  readonly rationale: string;

  private constructor(value: number, factors: ConfidenceFactorsInput, rationale: string) {
    this.value = normalized(value, "Confidence");
    this.factors = Object.freeze({ ...factors });
    this.rationale = required(rationale, "Confidence rationale");
    Object.freeze(this);
  }

  static create(value: number, factors: ConfidenceFactorsInput, rationale: string): Confidence {
    return new Confidence(value, validateFactors(factors), rationale);
  }
}

export class DeterministicConfidenceModel {
  calculate(input: ConfidenceFactorsInput): Confidence {
    const factors = validateFactors(input);
    const support = Math.min(1, factors.supportingEvidenceCount / 4);
    const positive =
      support * 0.2 +
      factors.averageSourceReliability * 0.25 +
      factors.sourceAgreement * 0.2 +
      factors.freshness * 0.15 +
      factors.directness * 0.2;
    const penalty = factors.contradictionPenalty * 0.35 + factors.missingDataPenalty * 0.25;
    const value = Math.max(0, Math.min(1, round(positive - penalty)));
    return Confidence.create(value, factors, "Deterministic weighted evidence confidence");
  }
}

export interface ClaimInput {
  claimId: string;
  kind: ClaimKind;
  statement: string;
  supportingEvidenceIds?: readonly string[];
  contradictingEvidenceIds?: readonly string[];
  confidence: Confidence;
  rationale: string;
  status?: ClaimStatus;
  createdByModule: BrainModule;
  createdAt: Date;
  lastEvaluatedAt: Date;
}

export class Claim {
  readonly claimId: string;
  readonly kind: ClaimKind;
  readonly statement: string;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly confidence: Confidence;
  readonly rationale: string;
  readonly status: ClaimStatus;
  readonly createdByModule: BrainModule;
  readonly createdAt: Date;
  readonly lastEvaluatedAt: Date;

  private constructor(input: ClaimInput) {
    this.claimId = ClaimId.create(input.claimId).value;
    this.kind = oneOf(input.kind, ["FACT", "INFERENCE", "HYPOTHESIS", "UNKNOWN"], "Claim kind");
    this.statement = required(input.statement, "Claim statement");
    this.supportingEvidenceIds = ids(input.supportingEvidenceIds ?? [], "Supporting evidence id");
    this.contradictingEvidenceIds = ids(
      input.contradictingEvidenceIds ?? [],
      "Contradicting evidence id",
    );
    if (this.kind === "FACT" && this.supportingEvidenceIds.length === 0)
      throw new BrainContractError("FACT claim requires supporting Evidence");
    this.confidence = input.confidence;
    this.rationale = required(input.rationale, "Claim rationale");
    this.status = oneOf(
      input.status ?? "ACTIVE",
      ["ACTIVE", "CONTRADICTED", "SUPERSEDED", "REQUIRES_CLARIFICATION"],
      "Claim status",
    );
    this.createdByModule = brainModule(input.createdByModule);
    this.createdAt = date(input.createdAt, "Claim created at");
    this.lastEvaluatedAt = date(input.lastEvaluatedAt, "Claim last evaluated at");
    Object.freeze(this);
  }

  static create(input: ClaimInput): Claim {
    return new Claim(input);
  }
}

export interface ContradictionInput {
  contradictionId: string;
  kind: ContradictionKind;
  leftClaimId: string;
  rightClaimId: string;
  leftEvidenceIds: readonly string[];
  rightEvidenceIds: readonly string[];
  materiality: ContradictionMateriality;
  impact: string;
  requiresClarification: boolean;
  detectedAt: Date;
}

export class Contradiction {
  readonly contradictionId: string;
  readonly kind: ContradictionKind;
  readonly leftClaimId: string;
  readonly rightClaimId: string;
  readonly leftEvidenceIds: readonly string[];
  readonly rightEvidenceIds: readonly string[];
  readonly materiality: ContradictionMateriality;
  readonly impact: string;
  readonly requiresClarification: boolean;
  readonly detectedAt: Date;

  private constructor(input: ContradictionInput) {
    this.contradictionId = ContradictionId.create(input.contradictionId).value;
    this.kind = oneOf(
      input.kind,
      ["QUANTITATIVE", "QUALITATIVE", "ACTOR_REPORT", "STALE_VS_CURRENT", "EVIDENCE_VS_ASSUMPTION"],
      "Contradiction kind",
    );
    this.leftClaimId = ClaimId.create(input.leftClaimId).value;
    this.rightClaimId = ClaimId.create(input.rightClaimId).value;
    this.leftEvidenceIds = ids(input.leftEvidenceIds, "Left evidence id");
    this.rightEvidenceIds = ids(input.rightEvidenceIds, "Right evidence id");
    if (this.leftEvidenceIds.length === 0 || this.rightEvidenceIds.length === 0)
      throw new BrainContractError("Contradiction must preserve evidence on both sides");
    this.materiality = oneOf(
      input.materiality,
      ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      "Contradiction materiality",
    );
    this.impact = required(input.impact, "Contradiction impact");
    this.requiresClarification = boolean(input.requiresClarification, "Requires clarification");
    this.detectedAt = date(input.detectedAt, "Contradiction detected at");
    Object.freeze(this);
  }

  static create(input: ContradictionInput): Contradiction {
    return new Contradiction(input);
  }
}

export interface UnknownInformationInput {
  unknownId: string;
  missingField: string;
  domain: string;
  reason: string;
  impact: string;
  requiredFor: readonly string[];
  priority: UnknownPriority;
  suggestedClarification: string;
}

export class UnknownInformation {
  readonly unknownId: string;
  readonly missingField: string;
  readonly domain: string;
  readonly reason: string;
  readonly impact: string;
  readonly requiredFor: readonly string[];
  readonly priority: UnknownPriority;
  readonly suggestedClarification: string;

  private constructor(input: UnknownInformationInput) {
    this.unknownId = identifier(input.unknownId, "Unknown id");
    this.missingField = required(input.missingField, "Missing field");
    this.domain = required(input.domain, "Unknown domain");
    this.reason = required(input.reason, "Unknown reason");
    this.impact = required(input.impact, "Unknown impact");
    this.requiredFor = strings(input.requiredFor);
    this.priority = oneOf(
      input.priority,
      ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      "Unknown priority",
    );
    this.suggestedClarification = required(input.suggestedClarification, "Suggested clarification");
    Object.freeze(this);
  }

  static create(input: UnknownInformationInput): UnknownInformation {
    return new UnknownInformation(input);
  }
}

export interface ReasoningTraceEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly relationship: string;
  readonly rationale: string;
}

export class ReasoningTrace {
  readonly nodes: Readonly<Record<string, string>>;
  readonly edges: readonly ReasoningTraceEdge[];

  private constructor(
    nodes: Readonly<Record<string, string>>,
    edges: readonly ReasoningTraceEdge[],
  ) {
    this.nodes = immutableRecord(nodes, "Reasoning trace nodes") as Readonly<
      Record<string, string>
    >;
    this.edges = Object.freeze(
      edges.map((edge) =>
        Object.freeze({
          fromId: identifier(edge.fromId, "Trace from id"),
          toId: identifier(edge.toId, "Trace to id"),
          relationship: required(edge.relationship, "Trace relationship"),
          rationale: required(edge.rationale, "Trace rationale"),
        }),
      ),
    );
    Object.freeze(this);
  }

  static create(nodes: Readonly<Record<string, string>>, edges: readonly ReasoningTraceEdge[]) {
    return new ReasoningTrace(nodes, edges);
  }

  backward(targetId: string): readonly ReasoningTraceEdge[] {
    const target = identifier(targetId, "Trace target id");
    return this.edges.filter((edge) => edge.toId === target);
  }

  forward(sourceId: string): readonly ReasoningTraceEdge[] {
    const source = identifier(sourceId, "Trace source id");
    return this.edges.filter((edge) => edge.fromId === source);
  }
}

export interface DecisionInput {
  decisionId: string;
  subjectId: string;
  decisionType: DecisionType;
  rationale: string;
  supportingClaimIds: readonly string[];
  blockingUnknownIds?: readonly string[];
  riskReferences?: readonly string[];
  confidence: Confidence;
  generatedByModule: BrainModule;
}

export class Decision {
  readonly decisionId: string;
  readonly subjectId: string;
  readonly decisionType: DecisionType;
  readonly rationale: string;
  readonly supportingClaimIds: readonly string[];
  readonly blockingUnknownIds: readonly string[];
  readonly riskReferences: readonly string[];
  readonly confidence: Confidence;
  readonly generatedByModule: BrainModule;

  private constructor(input: DecisionInput) {
    this.decisionId = DecisionId.create(input.decisionId).value;
    this.subjectId = identifier(input.subjectId, "Decision subject id");
    this.decisionType = oneOf(
      input.decisionType,
      ["RECOMMEND", "REJECT", "DEFER", "HUMAN_ASSISTED", "NEED_MORE_EVIDENCE"],
      "Decision type",
    );
    this.rationale = required(input.rationale, "Decision rationale");
    this.supportingClaimIds = ids(input.supportingClaimIds, "Supporting claim id");
    this.blockingUnknownIds = ids(input.blockingUnknownIds ?? [], "Blocking unknown id");
    this.riskReferences = strings(input.riskReferences ?? []);
    this.confidence = input.confidence;
    this.generatedByModule = brainModule(input.generatedByModule);
    if (
      this.decisionType === "RECOMMEND" &&
      (this.supportingClaimIds.length === 0 || this.blockingUnknownIds.length > 0)
    )
      throw new BrainContractError(
        "Recommendation decision requires supporting claims and no blocking unknowns",
      );
    Object.freeze(this);
  }

  static create(input: DecisionInput): Decision {
    return new Decision(input);
  }
}

function validateFactors(input: ConfidenceFactorsInput): ConfidenceFactorsInput {
  return Object.freeze({
    supportingEvidenceCount: nonNegativeInteger(
      input.supportingEvidenceCount,
      "Supporting evidence count",
    ),
    averageSourceReliability: normalized(
      input.averageSourceReliability,
      "Average source reliability",
    ),
    sourceAgreement: normalized(input.sourceAgreement, "Source agreement"),
    freshness: normalized(input.freshness, "Freshness"),
    directness: normalized(input.directness, "Directness"),
    contradictionPenalty: normalized(input.contradictionPenalty, "Contradiction penalty"),
    missingDataPenalty: normalized(input.missingDataPenalty, "Missing data penalty"),
  });
}

function identifier(value: string, label: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value))
    throw new BrainContractError(`${label} is invalid`);
  return value;
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new BrainContractError(`${label} is required`);
  return value.trim();
}

function optional(value: string | undefined): string | null {
  if (value === undefined || value === null) return null;
  return required(value, "Optional value");
}

function date(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new BrainContractError(`${label} is invalid`);
  return new Date(value.getTime());
}

function normalized(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new BrainContractError(`${label} must be between 0 and 1`);
  return round(value);
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0)
    throw new BrainContractError(`${label} must be a non-negative integer`);
  return value;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new BrainContractError(`${label} is invalid`);
  return value as T[number];
}

function brainModule(value: BrainModule): BrainModule {
  return oneOf(
    value,
    [
      "discovery",
      "interview",
      "enterprise_knowledge",
      "work_intelligence",
      "process_mapping",
      "business_analysis",
      "ai_opportunities",
      "automation_opportunities",
      "roi",
      "recommendations",
      "solution_blueprint",
      "automation_specification",
      "executive_result",
      "brain_evaluation",
    ],
    "Brain module",
  ) as BrainModule;
}

function boolean(value: boolean, label: string): boolean {
  if (typeof value !== "boolean") throw new BrainContractError(`${label} must be boolean`);
  return value;
}

function ids(values: readonly string[], label: string): readonly string[] {
  return Object.freeze(values.map((value) => identifier(value, label)));
}

function strings(values: readonly string[]): readonly string[] {
  return Object.freeze(values.map((value) => required(value, "String value")));
}

function immutableRecord(value: Readonly<Record<string, unknown>>, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BrainContractError(`${label} must be an object`);
  return Object.freeze(JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function cloneUnknown(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
