import type { AICandidate, AIInterpretationResult, AIProvider } from "./ai-interpretation-gateway";
import { AIInterpretationGateway } from "./ai-interpretation-gateway";
import {
  Claim,
  Confidence,
  UnknownInformation,
  type Contradiction,
  type Evidence,
} from "./brain-contracts";
import { InformationGapDetector, SourceSelector, type InformationGap } from "./adaptive-discovery";
import type { CauseCandidate } from "./process-causal";
import { ReasoningTrace } from "./brain-contracts";

export type HypothesisType =
  | "PROCESS_DESIGN"
  | "CAPACITY"
  | "QUEUEING"
  | "HANDOFF"
  | "SINGLE_PERSON_DEPENDENCY"
  | "DATA_QUALITY"
  | "CONTROL_CONFIGURATION"
  | "POLICY"
  | "SYSTEM_LIMITATION"
  | "INTEGRATION"
  | "MANUAL_REWORK"
  | "INFORMATION_DELAY"
  | "ROLE_OWNERSHIP"
  | "TRAINING_KNOWLEDGE"
  | "EXCEPTION_HANDLING"
  | "DEMAND_VARIABILITY"
  | "SCHEDULING"
  | "INCENTIVE_BEHAVIOR"
  | "OTHER";

export type HypothesisEvidenceGrounding =
  "SUPPORTED_BY_CURRENT_EVIDENCE" | "PLAUSIBLE_BUT_UNSUPPORTED" | "CONFLICTED_BY_EVIDENCE";

export type HypothesisNovelty = "EXISTING" | "REFINEMENT" | "NEW_ALTERNATIVE";
export type HypothesisMaterialityCandidate = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type BrainHypothesisValidationOutcome =
  | "SUPPORTED"
  | "UNDER_INVESTIGATION"
  | "INSUFFICIENT_EVIDENCE"
  | "CONTRADICTED"
  | "REJECTED"
  | "NEED_MORE_EVIDENCE";

export interface HypothesisSourceScope {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly problemReference: string;
}

export interface HypothesisCandidate {
  readonly candidateId: string;
  readonly subject: string;
  readonly hypothesis: string;
  readonly hypothesisType: HypothesisType;
  readonly reasoningSummary: string;
  readonly evidenceGrounding: HypothesisEvidenceGrounding;
  readonly supportingEvidenceIds: readonly string[];
  readonly conflictingEvidenceIds: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly relatedProcessNodeIds: readonly string[];
  readonly relatedConceptIds: readonly string[];
  readonly sourceScope: HypothesisSourceScope;
  readonly testable: boolean;
  readonly testPlan: string | null;
  readonly bestEvidenceSource: string | null;
  readonly materialityCandidate: HypothesisMaterialityCandidate;
  readonly novelty: HypothesisNovelty;
  readonly noveltyKey: string;
  readonly providerMetadata: Readonly<{ provider: string; model: string }>;
  readonly authoritativeRootCause: false;
  readonly factPromotion: false;
  readonly directOpportunityPublication: false;
}

export interface HypothesisExpansionInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly problemReference: string;
  readonly problem: string;
  readonly bottleneck?: string;
  readonly criticalIssue?: string;
  readonly relevantProcessNodeIds?: readonly string[];
  readonly existingHypotheses?: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly contradictions?: readonly Contradiction[];
  readonly unknowns?: readonly UnknownInformation[];
  readonly semanticConceptIds?: readonly string[];
  readonly candidateBudget?: number;
}

export interface HypothesisExpansionResult {
  readonly candidates: readonly HypothesisCandidate[];
  readonly rejectedCandidates: readonly { readonly candidateId: string; readonly reason: string }[];
  readonly duplicatesRemoved: number;
  readonly providerUnavailable: boolean;
  readonly rawCandidateCount: number;
}

export interface BrainHypothesisValidation {
  readonly candidate: HypothesisCandidate;
  readonly outcome: BrainHypothesisValidationOutcome;
  readonly claim: Claim;
  readonly causeCandidate: CauseCandidate;
  readonly informationGaps: readonly InformationGap[];
  readonly rationale: string;
}

export class HypothesisExpansionService {
  constructor(private readonly provider?: AIProvider) {}

  async expand(input: HypothesisExpansionInput): Promise<HypothesisExpansionResult> {
    validateInputScope(input);
    if (!this.provider) return emptyResult(true);
    let result: AIInterpretationResult;
    try {
      result = await new AIInterpretationGateway(this.provider).interpret({
        requestId: `${input.brainRunId}:${input.problemReference}:hypothesis-expansion`,
        tenantId: input.tenantId,
        companyId: input.companyId,
        sourceId: input.problemReference,
        sourceType: "BRAIN_PROBLEM_CONTEXT",
        sourceText: boundedContext(input),
        task: "HYPOTHESIS_EXPANSION",
        schemaVersion: "hypothesis-expansion-v1",
        knownClaims: input.existingHypotheses?.slice(0, 8) ?? [],
        knownUnknowns: input.unknowns?.map((unknown) => unknown.missingField).slice(0, 8) ?? [],
        constraints: [
          "Return candidate hypotheses only.",
          "Do not confirm root causes.",
          "Do not create facts, opportunities or economic values.",
          "Every evidence reference must be in the supplied context.",
          "Preserve unknowns and contradictions explicitly.",
        ],
        traceContext: {
          companyId: input.companyId,
          brainRunId: input.brainRunId,
          problemReference: input.problemReference,
        },
      });
    } catch {
      return emptyResult(true);
    }
    const parsed = result.candidates.map((candidate) => parseCandidate(candidate, result, input));
    const accepted: HypothesisCandidate[] = [];
    const rejected: { candidateId: string; reason: string }[] = [];
    for (const item of parsed) {
      if (item.ok) accepted.push(item.candidate);
      else rejected.push(Object.freeze({ candidateId: item.candidateId, reason: item.reason }));
    }
    const deduped = dedupeAndBudget(accepted, input);
    return Object.freeze({
      candidates: deduped,
      rejectedCandidates: Object.freeze(rejected),
      duplicatesRemoved: accepted.length - deduped.length,
      providerUnavailable: false,
      rawCandidateCount: result.candidates.length,
    });
  }
}

export class HypothesisBrainAdapter {
  validate(input: {
    readonly candidate: HypothesisCandidate;
    readonly evidence: readonly Evidence[];
    readonly contradictions?: readonly Contradiction[];
    readonly unknowns?: readonly UnknownInformation[];
  }): BrainHypothesisValidation {
    const candidate = input.candidate;
    const contradictions = input.contradictions ?? [];
    const unknowns = [
      ...(input.unknowns ?? []),
      ...candidate.requiredEvidence.map((required) =>
        UnknownInformation.create({
          unknownId: `hypothesis:${safeId(candidate.candidateId)}:${safeId(required)}`,
          missingField: required,
          domain: candidate.subject,
          reason: `Required to test hypothesis: ${candidate.hypothesis}`,
          impact: "Hypothesis remains unqualified until this evidence is supplied.",
          requiredFor: ["finding", "decision"],
          priority:
            candidate.materialityCandidate === "CRITICAL"
              ? "CRITICAL"
              : candidate.materialityCandidate === "HIGH"
                ? "HIGH"
                : "MEDIUM",
          suggestedClarification: candidate.testPlan ?? `Provide evidence for ${required}.`,
        }),
      ),
    ];
    const knownEvidenceIds = new Set(input.evidence.map((evidence) => evidence.evidenceId));
    const supportingCount = candidate.supportingEvidenceIds.filter((id) =>
      knownEvidenceIds.has(id),
    ).length;
    const contradicted =
      candidate.evidenceGrounding === "CONFLICTED_BY_EVIDENCE" ||
      contradictions.some((contradiction) =>
        candidate.conflictingEvidenceIds.some(
          (id) =>
            contradiction.leftEvidenceIds.includes(id) ||
            contradiction.rightEvidenceIds.includes(id),
        ),
      );
    const outcome: BrainHypothesisValidationOutcome = contradicted
      ? supportingCount > 0
        ? "CONTRADICTED"
        : "REJECTED"
      : candidate.requiredEvidence.length > 0
        ? "NEED_MORE_EVIDENCE"
        : supportingCount > 0
          ? "SUPPORTED"
          : "INSUFFICIENT_EVIDENCE";
    const confidence = Confidence.create(
      outcome === "SUPPORTED" ? 0.62 : outcome === "CONTRADICTED" ? 0.35 : 0.28,
      {
        supportingEvidenceCount: supportingCount,
        averageSourceReliability: averageReliability(
          input.evidence,
          candidate.supportingEvidenceIds,
        ),
        sourceAgreement: contradicted ? 0.2 : supportingCount ? 0.7 : 0.1,
        freshness: 0.5,
        directness: candidate.testable ? 0.6 : 0.3,
        contradictionPenalty: contradicted ? 0.7 : 0,
        missingDataPenalty: candidate.requiredEvidence.length ? 0.7 : 0.2,
      },
      "Deterministic Brain validation of AI-generated hypothesis candidate",
    );
    const claim = Claim.create({
      claimId: `claim:${safeId(candidate.candidateId)}`,
      kind: "HYPOTHESIS",
      statement: candidate.hypothesis,
      supportingEvidenceIds: candidate.supportingEvidenceIds,
      contradictingEvidenceIds: candidate.conflictingEvidenceIds,
      confidence,
      rationale: candidate.reasoningSummary,
      status:
        outcome === "CONTRADICTED" || outcome === "REJECTED"
          ? "CONTRADICTED"
          : outcome === "NEED_MORE_EVIDENCE"
            ? "REQUIRES_CLARIFICATION"
            : "ACTIVE",
      createdByModule: "brain_evaluation",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lastEvaluatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const causeCandidate: CauseCandidate = Object.freeze({
      causeId: `cause:${safeId(candidate.candidateId)}`,
      semanticKey: candidate.noveltyKey,
      kind: "CANDIDATE",
      statement: candidate.hypothesis,
      affectedStepIds: candidate.relatedProcessNodeIds,
      supportingClaimIds: [claim.claimId],
      supportingEvidenceIds: candidate.supportingEvidenceIds,
      confidence: confidence.value,
      relationship: confidence.value >= 0.6 ? "INDIRECT" : "CORRELATION",
      competingCauseIds: [],
      unresolvedUnknownIds: unknowns.map((unknown) => unknown.unknownId),
      trace: ReasoningTrace.create(
        { [candidate.candidateId]: "HypothesisCandidate", [claim.claimId]: "Brain hypothesis" },
        [
          {
            fromId: candidate.candidateId,
            toId: claim.claimId,
            relationship: "validated_as_hypothesis",
            rationale: "AI candidate is retained only as Brain hypothesis input",
          },
        ],
      ),
    });
    const informationGaps = new InformationGapDetector().detect({
      evidence: input.evidence,
      claims: [claim],
      unknowns,
      contradictions,
      clarifications: [],
      decisionDependencies: [
        {
          decisionId: `decision:${safeId(candidate.candidateId)}`,
          target: "decision",
          claimIds: [claim.claimId],
          unknownIds: unknowns.map((unknown) => unknown.unknownId),
        },
      ],
      budget: {
        maximumQuestions: 5,
        maximumQuestionsPerDomain: 3,
        minimumValueThreshold: 0,
        alreadyAskedQuestionIds: [],
        questionsAskedByDomain: {},
      },
    });
    return Object.freeze({
      candidate,
      outcome,
      claim,
      causeCandidate,
      informationGaps,
      rationale: "Brain retained the AI output as a hypothesis candidate only.",
    });
  }

  discoveryTargets(validation: BrainHypothesisValidation) {
    const selector = new SourceSelector();
    return Object.freeze(
      validation.informationGaps.map((gap) =>
        Object.freeze({
          gap,
          source: selector.select(gap),
        }),
      ),
    );
  }
}

function parseCandidate(
  ai: AICandidate,
  result: AIInterpretationResult,
  input: HypothesisExpansionInput,
):
  | { readonly ok: true; readonly candidate: HypothesisCandidate }
  | { readonly ok: false; readonly candidateId: string; readonly reason: string } {
  const value = ai.value as Partial<HypothesisCandidate> | undefined;
  if (!value || typeof value !== "object")
    return { ok: false, candidateId: ai.candidateId, reason: "missing hypothesis payload" };
  const candidate = freezeCandidate({
    candidateId: value.candidateId ?? ai.candidateId,
    subject: value.subject ?? input.problem,
    hypothesis: value.hypothesis ?? ai.statement,
    hypothesisType: value.hypothesisType ?? "OTHER",
    reasoningSummary: value.reasoningSummary ?? ai.rationale,
    evidenceGrounding: value.evidenceGrounding ?? "PLAUSIBLE_BUT_UNSUPPORTED",
    supportingEvidenceIds: value.supportingEvidenceIds ?? [],
    conflictingEvidenceIds: value.conflictingEvidenceIds ?? [],
    requiredEvidence: value.requiredEvidence ?? [],
    relatedProcessNodeIds: value.relatedProcessNodeIds ?? input.relevantProcessNodeIds ?? [],
    relatedConceptIds: value.relatedConceptIds ?? input.semanticConceptIds ?? [],
    sourceScope: value.sourceScope ?? {
      tenantId: input.tenantId,
      companyId: input.companyId,
      brainRunId: input.brainRunId,
      problemReference: input.problemReference,
    },
    testable: value.testable ?? Boolean(value.requiredEvidence?.length),
    testPlan: value.testPlan ?? null,
    bestEvidenceSource: value.bestEvidenceSource ?? null,
    materialityCandidate: value.materialityCandidate ?? "MEDIUM",
    novelty: noveltyFor(value, input),
    noveltyKey: value.noveltyKey ?? noveltyKey(value.hypothesis ?? ai.statement, input.problem),
    providerMetadata: value.providerMetadata ?? { provider: result.provider, model: result.model },
    authoritativeRootCause: false,
    factPromotion: false,
    directOpportunityPublication: false,
  });
  const validationError = validateCandidate(candidate, input);
  if (validationError)
    return { ok: false, candidateId: candidate.candidateId, reason: validationError };
  return { ok: true, candidate };
}

function validateCandidate(
  candidate: HypothesisCandidate,
  input: HypothesisExpansionInput,
): string | null {
  if (
    candidate.sourceScope.tenantId !== input.tenantId ||
    candidate.sourceScope.companyId !== input.companyId
  )
    return "candidate is outside tenant/company scope";
  const evidenceIds = new Set(input.evidence.map((evidence) => evidence.evidenceId));
  for (const id of [...candidate.supportingEvidenceIds, ...candidate.conflictingEvidenceIds]) {
    if (!evidenceIds.has(id)) return `invented evidence reference: ${id}`;
  }
  const processIds = new Set(input.relevantProcessNodeIds ?? []);
  for (const id of candidate.relatedProcessNodeIds) {
    if (processIds.size && !processIds.has(id)) return `invented process node: ${id}`;
  }
  const contextText = boundedContext(input).toLowerCase();
  for (const system of ["salesforce", "hubspot", "shopify"]) {
    if (candidate.hypothesis.toLowerCase().includes(system) && !contextText.includes(system))
      return `invented system reference: ${system}`;
  }
  if (
    candidate.authoritativeRootCause ||
    candidate.factPromotion ||
    candidate.directOpportunityPublication
  )
    return "candidate attempts authoritative mutation";
  return null;
}

function dedupeAndBudget(
  candidates: readonly HypothesisCandidate[],
  input: HypothesisExpansionInput,
): readonly HypothesisCandidate[] {
  const byKey = new Map<string, HypothesisCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.hypothesisType}:${candidate.noveltyKey}:${candidate.relatedProcessNodeIds.join(",")}`;
    if (!byKey.has(key)) byKey.set(key, candidate);
  }
  const budget = Math.max(1, Math.min(7, input.candidateBudget ?? 5));
  return Object.freeze(
    [...byKey.values()]
      .sort(
        (left, right) =>
          noveltyRank(right.novelty) - noveltyRank(left.novelty) ||
          materialityRank(right.materialityCandidate) -
            materialityRank(left.materialityCandidate) ||
          left.candidateId.localeCompare(right.candidateId),
      )
      .slice(0, budget),
  );
}

function boundedContext(input: HypothesisExpansionInput): string {
  const lines = [
    `problem: ${input.problem}`,
    input.bottleneck ? `bottleneck: ${input.bottleneck}` : "",
    input.criticalIssue ? `critical issue: ${input.criticalIssue}` : "",
    ...input.evidence
      .slice(0, 8)
      .map((evidence) => `evidence ${evidence.evidenceId}: ${evidence.content}`),
    ...(input.contradictions ?? [])
      .slice(0, 5)
      .map((c) => `contradiction ${c.contradictionId}: ${c.impact}`),
    ...(input.unknowns ?? []).slice(0, 5).map((u) => `unknown ${u.unknownId}: ${u.missingField}`),
    ...(input.existingHypotheses ?? []).slice(0, 5).map((h) => `existing hypothesis: ${h}`),
    ...(input.semanticConceptIds ?? []).slice(0, 8).map((id) => `semantic concept: ${id}`),
  ].filter(Boolean);
  return lines.join("\n").slice(0, 6000);
}

function validateInputScope(input: HypothesisExpansionInput) {
  if (!input.tenantId || !input.companyId || !input.brainRunId || !input.problemReference)
    throw new Error("Hypothesis scope is required");
  for (const evidence of input.evidence) {
    if (evidence.tenantId && evidence.tenantId !== input.tenantId)
      throw new Error("Evidence is outside tenant scope");
    if (evidence.companyId && evidence.companyId !== input.companyId)
      throw new Error("Evidence is outside company scope");
  }
}

function freezeCandidate(candidate: HypothesisCandidate): HypothesisCandidate {
  return Object.freeze({
    ...candidate,
    supportingEvidenceIds: Object.freeze([...candidate.supportingEvidenceIds]),
    conflictingEvidenceIds: Object.freeze([...candidate.conflictingEvidenceIds]),
    requiredEvidence: Object.freeze([...candidate.requiredEvidence]),
    relatedProcessNodeIds: Object.freeze([...candidate.relatedProcessNodeIds]),
    relatedConceptIds: Object.freeze([...candidate.relatedConceptIds]),
    sourceScope: Object.freeze({ ...candidate.sourceScope }),
    providerMetadata: Object.freeze({ ...candidate.providerMetadata }),
  });
}

function emptyResult(providerUnavailable: boolean): HypothesisExpansionResult {
  return Object.freeze({
    candidates: [],
    rejectedCandidates: [],
    duplicatesRemoved: 0,
    providerUnavailable,
    rawCandidateCount: 0,
  });
}

function noveltyFor(
  value: Partial<HypothesisCandidate>,
  input: HypothesisExpansionInput,
): HypothesisNovelty {
  if (value.novelty) return value.novelty;
  const hypothesis = (value.hypothesis ?? "").toLowerCase();
  const existing = input.existingHypotheses ?? [];
  if (existing.some((item) => item.toLowerCase() === hypothesis)) return "EXISTING";
  if (existing.some((item) => hypothesis.includes(item.toLowerCase().slice(0, 12))))
    return "REFINEMENT";
  return "NEW_ALTERNATIVE";
}

function noveltyKey(hypothesis: string, subject: string): string {
  return safeId(`${subject}:${hypothesis}`.toLowerCase().replace(/\b(the|a|an|may|be|is)\b/g, ""));
}

function noveltyRank(novelty: HypothesisNovelty): number {
  return novelty === "NEW_ALTERNATIVE" ? 3 : novelty === "REFINEMENT" ? 2 : 1;
}

function materialityRank(materiality: HypothesisMaterialityCandidate): number {
  return materiality === "CRITICAL"
    ? 4
    : materiality === "HIGH"
      ? 3
      : materiality === "MEDIUM"
        ? 2
        : 1;
}

function averageReliability(evidence: readonly Evidence[], ids: readonly string[]): number {
  const matched = evidence.filter((item) => ids.includes(item.evidenceId));
  if (!matched.length) return 0;
  return (
    Math.round(
      (matched.reduce((sum, item) => sum + item.reliability, 0) / matched.length) * 1_000_000,
    ) / 1_000_000
  );
}

function safeId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9:_/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "hypothesis";
}
