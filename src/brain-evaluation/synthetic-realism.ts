import {
  AIInterpretationGateway,
  type AIInterpretationRequest,
  type AIInterpretationResult,
  type AICandidate,
  type AIProvider,
} from "./ai-interpretation-gateway";

export type SyntheticActorRole =
  | "OWNER"
  | "EXECUTIVE"
  | "MANAGER"
  | "OPERATOR"
  | "FINANCE"
  | "IT"
  | "PROCESS_OWNER"
  | "CUSTOMER_SERVICE"
  | "ANALYST";
export type SyntheticPersonality =
  | "DIRECT"
  | "VERBOSE"
  | "UNCERTAIN"
  | "OVERCONFIDENT"
  | "DEFENSIVE"
  | "TECHNICAL"
  | "NON_TECHNICAL"
  | "RUSHED"
  | "COOPERATIVE";
export type RealismLevel = "STRUCTURED" | "LIGHT_NATURAL_LANGUAGE" | "REALISTIC" | "ADVERSARIAL";
export type SyntheticDocumentType =
  | "SOP"
  | "POLICY"
  | "PROCESS_DESCRIPTION"
  | "INTERNAL_MEMO"
  | "EMAIL"
  | "MEETING_NOTES"
  | "SYSTEM_DOCUMENTATION"
  | "PROCEDURE"
  | "APPROVAL_POLICY"
  | "SPREADSHEET_DESCRIPTION";

export interface ActorPerspective {
  actorId: string;
  role: SyntheticActorRole;
  knowledgeScope: readonly string[];
  beliefs: Readonly<Record<string, string | number>>;
  bias: number;
  reliability: number;
  confidence: number;
  informationFreshness: number;
  knownFacts: readonly string[];
  unknownFacts: readonly string[];
  terminology: Readonly<Record<string, string>>;
  communicationStyle: SyntheticPersonality;
  language: string;
}

export interface DocumentPerspective {
  documentId: string;
  documentType: SyntheticDocumentType;
  allowedFacts: readonly string[];
  unknownFacts: readonly string[];
  terminology: Readonly<Record<string, string>>;
  freshness: "CURRENT" | "STALE" | "PARTIAL" | "INCORRECT" | "AMBIGUOUS";
  language: string;
}

export interface SyntheticFidelityMetrics {
  allowedFactCoverage: number;
  unauthorizedFactRate: number;
  groundTruthLeakRate: number;
  perspectiveConsistency: number;
  contradictionPreservation: number;
  unknownPreservation: number;
}

export interface SyntheticGeneratedMaterial {
  sourceId: string;
  kind: "INTERVIEW" | "DOCUMENT";
  text: string;
  interpretation: AIInterpretationResult;
  provenance: "SYNTHETIC";
  fidelity: SyntheticFidelityMetrics;
  rejected: boolean;
  rejectionReasons: readonly string[];
}

const freeze = <T>(value: T): T => Object.freeze(value);
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const stableHash = (value: string) =>
  [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 17);

/** Builds the only information an actor is allowed to see. GroundTruth is not accepted by this API. */
export class ActorKnowledgeFirewall {
  buildPerspective(input: ActorPerspective): ActorPerspective {
    return freeze({
      actorId: input.actorId,
      role: input.role,
      knowledgeScope: freeze([...input.knowledgeScope]),
      beliefs: freeze({ ...input.beliefs }),
      bias: clamp(input.bias),
      reliability: clamp(input.reliability),
      confidence: clamp(input.confidence),
      informationFreshness: clamp(input.informationFreshness),
      knownFacts: freeze([...input.knownFacts]),
      unknownFacts: freeze([...input.unknownFacts]),
      terminology: freeze({ ...input.terminology }),
      communicationStyle: input.communicationStyle,
      language: input.language || "und",
    });
  }

  validateGeneratedContent(text: string, perspective: ActorPerspective): readonly string[] {
    const errors: string[] = [];
    for (const fact of perspective.unknownFacts)
      if (text.toLowerCase().includes(fact.toLowerCase())) errors.push("OUT_OF_SCOPE_ASSERTION");
    if (
      perspective.knownFacts.length &&
      !perspective.knownFacts.some((fact) => text.toLowerCase().includes(fact.toLowerCase()))
    )
      errors.push("PERSPECTIVE_NOT_REFLECTED");
    return freeze([...new Set(errors)]);
  }
}

export class SyntheticContentValidator {
  validate(text: string, perspective: ActorPerspective | DocumentPerspective): readonly string[] {
    const errors: string[] = [];
    const allowedFacts =
      "allowedFacts" in perspective ? perspective.allowedFacts : perspective.knownFacts;
    for (const fact of perspective.unknownFacts)
      if (text.toLowerCase().includes(fact.toLowerCase())) errors.push("UNAUTHORIZED_FACT");
    const numericFacts = [...text.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((match) => match[0]);
    if (
      numericFacts.length &&
      !allowedFacts.some((fact) => numericFacts.some((value) => fact.includes(value)))
    )
      errors.push("INVENTED_METRIC");
    return freeze([...new Set(errors)]);
  }
}

export class DeterministicSyntheticTextProvider implements AIProvider {
  readonly providerId = "deterministic-synthetic-text-provider";
  constructor(private readonly mode: "valid" | "hallucination" = "valid") {}

  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    const sourceReference = `${request.sourceId}:1`;
    const base =
      request.sourceText.split("|")[0]?.trim() ||
      "The participant shared an operational observation.";
    const statement =
      this.mode === "hallucination"
        ? `${base} The hidden root cause is secret-system-truth.`
        : base;
    const candidate: AICandidate = {
      candidateId: `candidate:${stableHash(request.requestId)}`,
      candidateType: "PROCESS_OBSERVATION_CANDIDATE",
      statement,
      value: undefined,
      sourceReference,
      sourceExcerpt: base.slice(0, 160),
      confidenceHint: 0.7,
      rationale: "Deterministic bounded synthetic rendering",
      knowledgeReferences: [],
      status: "AI_DERIVED",
      review: "REQUIRED",
    };
    return freeze({
      requestId: request.requestId,
      provider: this.providerId,
      model: "synthetic-fixture-model",
      task: request.task,
      schemaVersion: request.schemaVersion,
      candidates: freeze([candidate]),
      sourceReferences: freeze([request.sourceId]),
      warnings: freeze([]),
      validationIssues: freeze([]),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }
}

export interface SyntheticRealismOptions {
  level: RealismLevel;
  promptVersion: string;
  language?: string;
  provider?: AIProvider;
}

export class SyntheticRealismLayer {
  private readonly firewall = new ActorKnowledgeFirewall();
  private readonly validator = new SyntheticContentValidator();
  private readonly gateway: AIInterpretationGateway;

  constructor(private readonly options: SyntheticRealismOptions) {
    this.gateway = new AIInterpretationGateway(
      options.provider ?? new DeterministicSyntheticTextProvider(),
    );
  }

  async renderInterview(
    perspectiveInput: ActorPerspective,
    question: string,
    requestId: string,
  ): Promise<SyntheticGeneratedMaterial> {
    const perspective = this.firewall.buildPerspective(perspectiveInput);
    const sourceId = `synthetic-interview:${perspective.actorId}:${requestId}`;
    const text = this.renderPerspectiveText(perspective, question);
    return this.interpret(sourceId, "INTERVIEW", text, perspective, requestId);
  }

  async renderDocument(
    perspectiveInput: DocumentPerspective,
    requestId: string,
  ): Promise<SyntheticGeneratedMaterial> {
    const sourceId = `synthetic-document:${perspectiveInput.documentId}`;
    const text = `${perspectiveInput.documentType}: ${perspectiveInput.allowedFacts.join("; ")}`;
    const interpretation = await this.gateway.interpret({
      requestId,
      tenantId: "synthetic",
      sourceId,
      sourceType: perspectiveInput.documentType,
      sourceText: `${text} | ${perspectiveInput.language}`,
      task: "PROCESS_OBSERVATION",
      schemaVersion: "synthetic-realism-v1",
      language: perspectiveInput.language,
    });
    const rejectionReasons = this.validator.validate(text, perspectiveInput);
    return this.material(sourceId, "DOCUMENT", text, interpretation, rejectionReasons);
  }

  private async interpret(
    sourceId: string,
    kind: "INTERVIEW" | "DOCUMENT",
    text: string,
    perspective: ActorPerspective,
    requestId: string,
  ) {
    const interpretation = await this.gateway.interpret({
      requestId,
      tenantId: "synthetic",
      sourceId,
      sourceType: kind,
      sourceText: `${text} | ${perspective.language}`,
      task: "PROCESS_OBSERVATION",
      schemaVersion: "synthetic-realism-v1",
      knownClaims: perspective.knownFacts,
      knownUnknowns: perspective.unknownFacts,
      language: perspective.language,
    });
    const renderedText = [
      text,
      ...interpretation.candidates.map((candidate) => candidate.statement),
    ].join(" ");
    const rejectionReasons = [
      ...this.firewall.validateGeneratedContent(renderedText, perspective),
      ...this.validator.validate(renderedText, perspective),
    ];
    return this.material(sourceId, kind, renderedText, interpretation, rejectionReasons);
  }

  private material(
    sourceId: string,
    kind: "INTERVIEW" | "DOCUMENT",
    text: string,
    interpretation: AIInterpretationResult,
    rejectionReasons: readonly string[],
  ): SyntheticGeneratedMaterial {
    const rejected = rejectionReasons.length > 0;
    return freeze({
      sourceId,
      kind,
      text,
      interpretation,
      provenance: "SYNTHETIC",
      fidelity: freeze({
        allowedFactCoverage: rejected ? 0 : 1,
        unauthorizedFactRate: rejected ? 1 : 0,
        groundTruthLeakRate: rejectionReasons.includes("GROUND_TRUTH_LEAK") ? 1 : 0,
        perspectiveConsistency: rejected ? 0 : 1,
        contradictionPreservation: 1,
        unknownPreservation: 1,
      }),
      rejected,
      rejectionReasons: freeze([...rejectionReasons]),
    });
  }

  private renderPerspectiveText(perspective: ActorPerspective, question: string): string {
    const fact = perspective.knownFacts[0] ?? "the current process";
    const belief = Object.entries(perspective.beliefs)[0];
    const value = belief ? `${belief[0]} is ${belief[1]}` : fact;
    const prefix =
      perspective.communicationStyle === "VERBOSE"
        ? "From my perspective, "
        : perspective.communicationStyle === "UNCERTAIN"
          ? "I may be mistaken, but "
          : "";
    return `${prefix}${question}: ${value}.`;
  }
}

export class BoundedSyntheticInterviewService {
  constructor(
    private readonly layer: SyntheticRealismLayer,
    private readonly maxRounds = 3,
  ) {}

  async askFollowUps(
    questions: readonly string[],
    perspective: ActorPerspective,
    startRequestId: string,
  ): Promise<readonly SyntheticGeneratedMaterial[]> {
    return Promise.all(
      questions
        .slice(0, this.maxRounds)
        .map((question, index) =>
          this.layer.renderInterview(perspective, question, `${startRequestId}:${index + 1}`),
        ),
    );
  }
}

export interface RealismProfile {
  seed: string;
  level: RealismLevel;
  sector: string;
  companySize: "SMB" | "MID_MARKET" | "ENTERPRISE";
  processComplexity: number;
  dataQuality: number;
  systemFragmentation: number;
  humanDependency: number;
  controlIntensity: number;
  documentationQuality: number;
  actorReliability: number;
  holdout: boolean;
}

const sectors = ["services", "retail", "manufacturing", "hospitality", "professional-services"];
const sizes: RealismProfile["companySize"][] = ["SMB", "MID_MARKET", "ENTERPRISE"];
const levels: RealismLevel[] = ["STRUCTURED", "LIGHT_NATURAL_LANGUAGE", "REALISTIC", "ADVERSARIAL"];

export function createGeneralizationProfiles(count = 50): readonly RealismProfile[] {
  return freeze(
    Array.from({ length: Math.max(50, count) }, (_, index) => {
      const sector = sectors[index % sectors.length]!;
      const size = sizes[Math.floor(index / sectors.length) % sizes.length]!;
      return freeze({
        seed: `realism-profile-${index + 1}`,
        level: levels[index % levels.length]!,
        sector,
        companySize: size,
        processComplexity: ((index * 17) % 100) / 100,
        dataQuality: 0.45 + ((index * 11) % 55) / 100,
        systemFragmentation: ((index * 13) % 100) / 100,
        humanDependency: ((index * 19) % 100) / 100,
        controlIntensity: ((index * 23) % 100) / 100,
        documentationQuality: ((index * 29) % 100) / 100,
        actorReliability: 0.5 + ((index * 7) % 50) / 100,
        holdout: index >= Math.max(34, count - 16),
      });
    }),
  );
}

export function splitGeneralizationProfiles(profiles = createGeneralizationProfiles()): {
  readonly core: readonly RealismProfile[];
  readonly adversarial: readonly RealismProfile[];
  readonly holdout: readonly RealismProfile[];
} {
  return freeze({
    core: freeze(profiles.filter((profile) => !profile.holdout && profile.level !== "ADVERSARIAL")),
    adversarial: freeze(
      profiles.filter((profile) => !profile.holdout && profile.level === "ADVERSARIAL"),
    ),
    holdout: freeze(profiles.filter((profile) => profile.holdout)),
  });
}
