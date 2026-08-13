import {
  ReasoningTrace,
  type Claim,
  type Contradiction,
  type ContradictionMateriality,
  type Evidence,
  type UnknownInformation,
} from "./brain-contracts";
import type {
  ClarificationRequirement,
  ImpactTarget,
  RequiredEvidenceType,
} from "./uncertainty-engine";

export type GapResolutionStatus = "OPEN" | "PARTIALLY_RESOLVED" | "RESOLVED" | "WAIVED";
export type GapUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PreferredSourceType =
  | "process_owner"
  | "operator"
  | "finance"
  | "it"
  | "manager"
  | "customer_facing_employee"
  | "system_data"
  | "operational_logs"
  | "documents";
export type CandidateQuestionType =
  | "DIRECT_QUESTION"
  | "QUANTITATIVE_REQUEST"
  | "DOCUMENT_REQUEST"
  | "SYSTEM_DATA_REQUEST"
  | "CLARIFICATION"
  | "VALIDATION";
export type DiscoveryReadinessOutcome =
  | "CONTINUE_DISCOVERY"
  | "READY_FOR_ANALYSIS"
  | "BLOCKED_BY_CRITICAL_GAPS"
  | "READY_WITH_DECLARED_UNCERTAINTY";

export interface InformationGap {
  readonly gapId: string;
  readonly subject: string;
  readonly domain: string;
  readonly description: string;
  readonly reasonMissing: string;
  readonly affectedClaimIds: readonly string[];
  readonly affectedDecisionIds: readonly string[];
  readonly affectedTargets: readonly ImpactTarget[];
  readonly materiality: ContradictionMateriality;
  readonly urgency: GapUrgency;
  readonly confidenceImpact: number;
  readonly requiredEvidenceType: RequiredEvidenceType;
  readonly preferredSourceType: PreferredSourceType;
  readonly candidateRespondentRole: string;
  readonly resolutionStatus: GapResolutionStatus;
}

export interface QuestionValueFactors {
  readonly decisionImpact: number;
  readonly contradictionResolutionValue: number;
  readonly confidenceImprovementPotential: number;
  readonly downstreamArtifactsAffected: number;
  readonly urgency: number;
  readonly acquisitionEffort: number;
  readonly alternativeEvidenceAvailability: number;
  readonly respondentReliability: number;
  readonly redundancyWithExistingEvidence: number;
}

export interface QuestionValue {
  readonly score: number;
  readonly factors: QuestionValueFactors;
  readonly rationale: string;
}

export interface CandidateQuestion {
  readonly questionId: string;
  readonly questionType: CandidateQuestionType;
  readonly targetGapIds: readonly string[];
  readonly question: string;
  readonly respondentRole: string;
  readonly requiredEvidenceType: RequiredEvidenceType;
  readonly expectedInformationGain: number;
  readonly valueScore: number;
  readonly rationale: string;
  readonly priority: GapUrgency;
  readonly blocking: boolean;
}

export interface InterviewBudget {
  readonly maximumQuestions: number;
  readonly maximumQuestionsPerDomain: number;
  readonly minimumValueThreshold: number;
  readonly alreadyAskedQuestionIds: readonly string[];
  readonly questionsAskedByDomain: Readonly<Record<string, number>>;
}

export interface BrainDiscoveryState {
  readonly evidence: readonly Evidence[];
  readonly claims: readonly Claim[];
  readonly unknowns: readonly UnknownInformation[];
  readonly contradictions: readonly Contradiction[];
  readonly clarifications: readonly ClarificationRequirement[];
  readonly decisionDependencies: readonly {
    readonly decisionId: string;
    readonly target: ImpactTarget;
    readonly claimIds: readonly string[];
    readonly unknownIds: readonly string[];
  }[];
  readonly budget: InterviewBudget;
}

export interface PlannerResult {
  readonly gaps: readonly InformationGap[];
  readonly candidates: readonly CandidateQuestion[];
  readonly selectedAction: CandidateQuestion | null;
  readonly readiness: DiscoveryReadiness;
  readonly trace: ReasoningTrace;
  readonly rationale: string;
}

export interface DiscoveryReadiness {
  readonly outcome: DiscoveryReadinessOutcome;
  readonly rationale: string;
  readonly blockingGapIds: readonly string[];
  readonly declaredUncertaintyGapIds: readonly string[];
}

export class InformationGapDetector {
  detect(state: BrainDiscoveryState): readonly InformationGap[] {
    const fromUnknowns = state.unknowns.map((unknown) => gapFromUnknown(unknown, state));
    const fromClarifications = state.clarifications.map((clarification) =>
      gapFromClarification(clarification, state),
    );
    const fromContradictions = state.contradictions
      .filter((contradiction) => contradiction.requiresClarification)
      .map((contradiction) => gapFromContradiction(contradiction, state));
    const gaps = dedupeGaps([...fromUnknowns, ...fromClarifications, ...fromContradictions])
      .filter((gap) => gap.resolutionStatus !== "RESOLVED" && gap.resolutionStatus !== "WAIVED")
      .sort(
        (left, right) =>
          urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
          materialityRank(right.materiality) - materialityRank(left.materiality) ||
          left.gapId.localeCompare(right.gapId),
      );
    return Object.freeze(gaps);
  }
}

export class QuestionValueEstimator {
  estimate(input: {
    readonly gap: InformationGap;
    readonly evidence: readonly Evidence[];
    readonly candidateQuestionType: CandidateQuestionType;
  }): QuestionValue {
    const factors = Object.freeze({
      decisionImpact: normalize(input.gap.affectedTargets.length / 4),
      contradictionResolutionValue:
        input.gap.reasonMissing.toLowerCase().includes("contradict") ||
        input.candidateQuestionType === "CLARIFICATION"
          ? 1
          : 0.25,
      confidenceImprovementPotential: input.gap.confidenceImpact,
      downstreamArtifactsAffected: normalize(input.gap.affectedTargets.length / 5),
      urgency: normalize(urgencyRank(input.gap.urgency) / 4),
      acquisitionEffort: acquisitionEffort(input.candidateQuestionType),
      alternativeEvidenceAvailability: objectiveSource(input.gap.preferredSourceType) ? 0.9 : 0.35,
      respondentReliability: respondentReliability(input.gap.preferredSourceType),
      redundancyWithExistingEvidence: redundancy(input.gap, input.evidence),
    });
    const positive =
      factors.decisionImpact * 0.18 +
      factors.contradictionResolutionValue * 0.17 +
      factors.confidenceImprovementPotential * 0.17 +
      factors.downstreamArtifactsAffected * 0.12 +
      factors.urgency * 0.12 +
      factors.alternativeEvidenceAvailability * 0.1 +
      factors.respondentReliability * 0.14;
    const score = round(
      normalize(
        positive - factors.acquisitionEffort * 0.16 - factors.redundancyWithExistingEvidence * 0.2,
      ),
    );
    return Object.freeze({
      score,
      factors,
      rationale:
        "Question value is deterministic and derived from impact, urgency, evidence quality and redundancy",
    });
  }
}

export class SourceSelector {
  select(gap: InformationGap): {
    readonly questionType: CandidateQuestionType;
    readonly respondentRole: string;
    readonly rationale: string;
  } {
    if (gap.requiredEvidenceType === "METRIC" && objectiveSource(gap.preferredSourceType)) {
      return Object.freeze({
        questionType:
          gap.preferredSourceType === "operational_logs"
            ? "SYSTEM_DATA_REQUEST"
            : "QUANTITATIVE_REQUEST",
        respondentRole: gap.candidateRespondentRole,
        rationale: "Objective operational evidence is preferred over subjective re-questioning",
      });
    }
    if (gap.requiredEvidenceType === "DOCUMENT") {
      return Object.freeze({
        questionType: "DOCUMENT_REQUEST",
        respondentRole: gap.candidateRespondentRole,
        rationale: "Documentary evidence is the preferred source for this gap",
      });
    }
    if (gap.reasonMissing.toLowerCase().includes("contradict")) {
      return Object.freeze({
        questionType: "CLARIFICATION",
        respondentRole: gap.candidateRespondentRole,
        rationale: "Contradiction requires explicit clarification",
      });
    }
    return Object.freeze({
      questionType: "DIRECT_QUESTION",
      respondentRole: gap.candidateRespondentRole,
      rationale: "No stronger objective source is available for this gap",
    });
  }
}

export class AdaptiveInterviewPlanner {
  private readonly gapDetector = new InformationGapDetector();
  private readonly sourceSelector = new SourceSelector();
  private readonly estimator = new QuestionValueEstimator();
  private readonly stoppingCriteria = new DiscoveryStoppingCriteria();

  plan(state: BrainDiscoveryState): PlannerResult {
    const gaps = this.gapDetector.detect(state);
    const candidates = gaps
      .flatMap((gap) => this.candidateForGap(gap, state))
      .filter((question) => budgetAllows(question, gaps, state.budget))
      .filter((question) => question.valueScore >= state.budget.minimumValueThreshold)
      .sort(
        (left, right) =>
          Number(right.blocking) - Number(left.blocking) ||
          right.valueScore - left.valueScore ||
          left.questionId.localeCompare(right.questionId),
      );
    const readiness = this.stoppingCriteria.evaluate({ ...state, gaps, candidates });
    const selectedAction =
      readiness.outcome === "CONTINUE_DISCOVERY" ? (candidates[0] ?? null) : null;
    return Object.freeze({
      gaps,
      candidates: Object.freeze(candidates),
      selectedAction,
      readiness,
      trace: traceDiscoveryDecision(gaps, candidates, selectedAction, readiness),
      rationale: selectedAction
        ? `Selected ${selectedAction.questionType} because it has the highest deterministic value`
        : readiness.rationale,
    });
  }

  private candidateForGap(
    gap: InformationGap,
    state: BrainDiscoveryState,
  ): readonly CandidateQuestion[] {
    const source = this.sourceSelector.select(gap);
    const value = this.estimator.estimate({
      gap,
      evidence: state.evidence,
      candidateQuestionType: source.questionType,
    });
    const questionId = `question:${gap.gapId}:${source.questionType}`.toLowerCase();
    if (state.budget.alreadyAskedQuestionIds.includes(questionId)) return [];
    return [
      Object.freeze({
        questionId,
        questionType: source.questionType,
        targetGapIds: Object.freeze([gap.gapId]),
        question: questionText(gap, source.questionType),
        respondentRole: source.respondentRole,
        requiredEvidenceType: gap.requiredEvidenceType,
        expectedInformationGain: value.score,
        valueScore: value.score,
        rationale: `${source.rationale}. ${value.rationale}`,
        priority: gap.urgency,
        blocking: gap.materiality === "HIGH" || gap.materiality === "CRITICAL",
      }),
    ];
  }
}

export class DiscoveryStoppingCriteria {
  evaluate(
    input: BrainDiscoveryState & {
      readonly gaps: readonly InformationGap[];
      readonly candidates: readonly CandidateQuestion[];
    },
  ): DiscoveryReadiness {
    const critical = input.gaps.filter(
      (gap) =>
        gap.resolutionStatus === "OPEN" &&
        (gap.urgency === "CRITICAL" || gap.materiality === "CRITICAL"),
    );
    if (critical.length > 0) {
      return freezeReadiness({
        outcome: "BLOCKED_BY_CRITICAL_GAPS",
        rationale: "Critical material gaps block analysis",
        blockingGapIds: critical.map((gap) => gap.gapId),
        declaredUncertaintyGapIds: [],
      });
    }
    const material = input.gaps.filter(
      (gap) =>
        gap.resolutionStatus === "OPEN" &&
        (gap.materiality === "HIGH" || gap.materiality === "CRITICAL"),
    );
    const budgetExhausted =
      input.budget.alreadyAskedQuestionIds.length >= input.budget.maximumQuestions ||
      input.candidates.length === 0;
    if (material.length > 0 && budgetExhausted) {
      return freezeReadiness({
        outcome: "BLOCKED_BY_CRITICAL_GAPS",
        rationale:
          "Material gaps remain but interview budget or value threshold prevents more questions",
        blockingGapIds: material.map((gap) => gap.gapId),
        declaredUncertaintyGapIds: [],
      });
    }
    if (material.length > 0) {
      return freezeReadiness({
        outcome: "CONTINUE_DISCOVERY",
        rationale: "Material gaps remain and useful questions are available",
        blockingGapIds: material.map((gap) => gap.gapId),
        declaredUncertaintyGapIds: [],
      });
    }
    const nonMaterialOpen = input.gaps.filter((gap) => gap.resolutionStatus === "OPEN");
    if (nonMaterialOpen.length > 0) {
      return freezeReadiness({
        outcome: "READY_WITH_DECLARED_UNCERTAINTY",
        rationale: "Remaining gaps are non-material for downstream analysis",
        blockingGapIds: [],
        declaredUncertaintyGapIds: nonMaterialOpen.map((gap) => gap.gapId),
      });
    }
    return freezeReadiness({
      outcome: "READY_FOR_ANALYSIS",
      rationale: "No unresolved material information gaps remain",
      blockingGapIds: [],
      declaredUncertaintyGapIds: [],
    });
  }
}

function gapFromUnknown(unknown: UnknownInformation, state: BrainDiscoveryState): InformationGap {
  const requiredFor = unknown.requiredFor.filter(isImpactTarget);
  const target = requiredFor[0] ?? inferTargetFromDomain(unknown.domain);
  return freezeGap({
    gapId: `gap:${unknown.unknownId}`,
    subject: unknown.missingField,
    domain: unknown.domain,
    description: unknown.impact,
    reasonMissing: unknown.reason,
    affectedClaimIds: affectedClaimsForUnknown(unknown, state),
    affectedDecisionIds: affectedDecisionsForUnknown(unknown, state),
    affectedTargets: requiredFor.length ? requiredFor : [target],
    materiality:
      unknown.priority === "CRITICAL" ? "CRITICAL" : unknown.priority === "HIGH" ? "HIGH" : "LOW",
    urgency: unknown.priority,
    confidenceImpact:
      unknown.priority === "CRITICAL" ? 1 : unknown.priority === "HIGH" ? 0.8 : 0.35,
    requiredEvidenceType: requiredEvidenceForField(unknown.missingField),
    preferredSourceType: preferredSourceForField(unknown.missingField),
    candidateRespondentRole: respondentForField(unknown.missingField),
    resolutionStatus: "OPEN",
  });
}

function gapFromClarification(
  clarification: ClarificationRequirement,
  state: BrainDiscoveryState,
): InformationGap {
  return freezeGap({
    gapId: `gap:${clarification.clarificationId}`,
    subject: clarification.targetSubject,
    domain: clarification.affectedDecisions[0] ?? "decision",
    description: clarification.reason,
    reasonMissing: "Clarification is required",
    affectedClaimIds: state.claims
      .filter((claim) =>
        claim.statement.toLowerCase().includes(clarification.targetSubject.toLowerCase()),
      )
      .map((claim) => claim.claimId),
    affectedDecisionIds: state.decisionDependencies.map((dependency) => dependency.decisionId),
    affectedTargets: clarification.affectedDecisions,
    materiality: clarification.priority,
    urgency: clarification.priority,
    confidenceImpact: clarification.priority === "CRITICAL" ? 1 : 0.75,
    requiredEvidenceType: clarification.requiredEvidenceType,
    preferredSourceType:
      clarification.requiredEvidenceType === "METRIC" ? "operational_logs" : "process_owner",
    candidateRespondentRole:
      clarification.requiredEvidenceType === "METRIC" ? "system data" : "process owner",
    resolutionStatus: "OPEN",
  });
}

function gapFromContradiction(
  contradiction: Contradiction,
  state: BrainDiscoveryState,
): InformationGap {
  const affectedTargets = targetsForContradiction(contradiction, state);
  return freezeGap({
    gapId: `gap:${contradiction.contradictionId}`,
    subject: contradiction.impact,
    domain: affectedTargets[0] ?? "decision",
    description: contradiction.impact,
    reasonMissing: "Contradictory evidence requires resolution",
    affectedClaimIds: [contradiction.leftClaimId, contradiction.rightClaimId],
    affectedDecisionIds: state.decisionDependencies
      .filter((dependency) =>
        dependency.claimIds.some(
          (claimId) =>
            claimId === contradiction.leftClaimId || claimId === contradiction.rightClaimId,
        ),
      )
      .map((dependency) => dependency.decisionId),
    affectedTargets,
    materiality: contradiction.materiality,
    urgency:
      contradiction.materiality === "CRITICAL"
        ? "CRITICAL"
        : contradiction.materiality === "HIGH"
          ? "HIGH"
          : "MEDIUM",
    confidenceImpact: materialityConfidenceImpact(contradiction.materiality),
    requiredEvidenceType: contradiction.kind === "QUANTITATIVE" ? "METRIC" : "INTERVIEW",
    preferredSourceType:
      contradiction.kind === "QUANTITATIVE" ? "operational_logs" : "process_owner",
    candidateRespondentRole:
      contradiction.kind === "QUANTITATIVE" ? "system data" : "process owner",
    resolutionStatus: "OPEN",
  });
}

function dedupeGaps(gaps: readonly InformationGap[]): readonly InformationGap[] {
  const byId = new Map<string, InformationGap>();
  for (const gap of gaps) if (!byId.has(gap.gapId)) byId.set(gap.gapId, gap);
  return [...byId.values()];
}

function budgetAllows(
  question: CandidateQuestion,
  gaps: readonly InformationGap[],
  budget: InterviewBudget,
): boolean {
  if (budget.alreadyAskedQuestionIds.includes(question.questionId)) return false;
  if (budget.alreadyAskedQuestionIds.length >= budget.maximumQuestions) return false;
  const gap = gaps.find((item) => item.gapId === question.targetGapIds[0]);
  if (!gap) return false;
  return (budget.questionsAskedByDomain[gap.domain] ?? 0) < budget.maximumQuestionsPerDomain;
}

function traceDiscoveryDecision(
  gaps: readonly InformationGap[],
  candidates: readonly CandidateQuestion[],
  selected: CandidateQuestion | null,
  readiness: DiscoveryReadiness,
): ReasoningTrace {
  const nodes: Record<string, string> = {};
  const edges: { fromId: string; toId: string; relationship: string; rationale: string }[] = [];
  for (const gap of gaps) {
    nodes[gap.gapId] = "InformationGap";
    for (const candidate of candidates.filter((item) => item.targetGapIds.includes(gap.gapId))) {
      nodes[candidate.questionId] = "CandidateQuestion";
      edges.push({
        fromId: gap.gapId,
        toId: candidate.questionId,
        relationship: "drives_question",
        rationale: candidate.rationale,
      });
    }
  }
  nodes[`readiness:${readiness.outcome}`] = "DiscoveryReadiness";
  if (selected) {
    edges.push({
      fromId: selected.questionId,
      toId: `readiness:${readiness.outcome}`,
      relationship: "selected_action",
      rationale: selected.rationale,
    });
  }
  return ReasoningTrace.create(nodes, edges);
}

function questionText(gap: InformationGap, type: CandidateQuestionType): string {
  switch (type) {
    case "SYSTEM_DATA_REQUEST":
      return `Retrieve ${gap.subject} from ${gap.preferredSourceType}.`;
    case "QUANTITATIVE_REQUEST":
      return `Provide a measured value for ${gap.subject}.`;
    case "DOCUMENT_REQUEST":
      return `Provide the document that proves ${gap.subject}.`;
    case "CLARIFICATION":
      return `Clarify the conflicting evidence about ${gap.subject}.`;
    case "VALIDATION":
      return `Validate whether ${gap.subject} is correct.`;
    case "DIRECT_QUESTION":
      return `What is the current value or answer for ${gap.subject}?`;
  }
}

function affectedClaimsForUnknown(
  unknown: UnknownInformation,
  state: BrainDiscoveryState,
): readonly string[] {
  return state.claims
    .filter((claim) => claim.statement.toLowerCase().includes(unknown.missingField.toLowerCase()))
    .map((claim) => claim.claimId);
}

function affectedDecisionsForUnknown(
  unknown: UnknownInformation,
  state: BrainDiscoveryState,
): readonly string[] {
  return state.decisionDependencies
    .filter((dependency) =>
      dependency.unknownIds.some(
        (unknownId) => unknownId === unknown.unknownId || unknownId === `gap:${unknown.unknownId}`,
      ),
    )
    .map((dependency) => dependency.decisionId);
}

function targetsForContradiction(
  contradiction: Contradiction,
  state: BrainDiscoveryState,
): readonly ImpactTarget[] {
  const targets = state.decisionDependencies
    .filter(
      (dependency) =>
        dependency.claimIds.includes(contradiction.leftClaimId) ||
        dependency.claimIds.includes(contradiction.rightClaimId),
    )
    .map((dependency) => dependency.target);
  if (targets.length) return Object.freeze([...new Set(targets)]);
  return contradiction.kind === "QUANTITATIVE"
    ? Object.freeze(["roi"])
    : Object.freeze(["decision"]);
}

function requiredEvidenceForField(field: string): RequiredEvidenceType {
  const normalized = field.toLowerCase();
  if (
    normalized.includes("volume") ||
    normalized.includes("time") ||
    normalized.includes("cost") ||
    normalized.includes("rate")
  )
    return "METRIC";
  if (normalized.includes("api") || normalized.includes("system")) return "SYSTEM_RECORD";
  if (normalized.includes("regulatory") || normalized.includes("document")) return "DOCUMENT";
  return "INTERVIEW";
}

function preferredSourceForField(field: string): PreferredSourceType {
  const normalized = field.toLowerCase();
  if (normalized.includes("volume") || normalized.includes("time") || normalized.includes("rate"))
    return "operational_logs";
  if (normalized.includes("cost")) return "finance";
  if (normalized.includes("api") || normalized.includes("system")) return "it";
  if (normalized.includes("regulatory") || normalized.includes("document")) return "documents";
  if (normalized.includes("actor") || normalized.includes("owner")) return "process_owner";
  return "operator";
}

function respondentForField(field: string): string {
  const source = preferredSourceForField(field);
  if (source === "operational_logs") return "system data";
  if (source === "documents") return "manager";
  return source.replaceAll("_", " ");
}

function inferTargetFromDomain(domain: string): ImpactTarget {
  if (domain === "roi") return "roi";
  if (domain.includes("recommend")) return "recommendation";
  if (domain.includes("opportunity")) return "opportunity";
  if (domain.includes("finding")) return "finding";
  return "decision";
}

function isImpactTarget(value: string): value is ImpactTarget {
  return ["finding", "opportunity", "roi", "decision", "recommendation"].includes(value);
}

function acquisitionEffort(type: CandidateQuestionType): number {
  switch (type) {
    case "SYSTEM_DATA_REQUEST":
      return 0.25;
    case "QUANTITATIVE_REQUEST":
      return 0.45;
    case "DOCUMENT_REQUEST":
      return 0.55;
    case "CLARIFICATION":
      return 0.4;
    case "VALIDATION":
      return 0.35;
    case "DIRECT_QUESTION":
      return 0.5;
  }
}

function respondentReliability(source: PreferredSourceType): number {
  switch (source) {
    case "system_data":
    case "operational_logs":
      return 0.95;
    case "documents":
    case "finance":
    case "it":
      return 0.85;
    case "operator":
      return 0.75;
    case "process_owner":
    case "manager":
      return 0.7;
    case "customer_facing_employee":
      return 0.65;
  }
}

function objectiveSource(source: PreferredSourceType): boolean {
  return ["system_data", "operational_logs", "documents", "finance", "it"].includes(source);
}

function redundancy(gap: InformationGap, evidence: readonly Evidence[]): number {
  const normalizedSubject = gap.subject.toLowerCase();
  const supportCount = evidence.filter(
    (item) =>
      item.content.toLowerCase().includes(normalizedSubject) ||
      Object.keys((item.structuredValue as Record<string, unknown>) ?? {}).some((key) =>
        normalizedSubject.includes(key.toLowerCase()),
      ),
  ).length;
  return normalize(supportCount / 3);
}

function materialityConfidenceImpact(materiality: ContradictionMateriality): number {
  switch (materiality) {
    case "LOW":
      return 0.25;
    case "MEDIUM":
      return 0.5;
    case "HIGH":
      return 0.8;
    case "CRITICAL":
      return 1;
  }
}

function materialityRank(materiality: ContradictionMateriality): number {
  return materialityConfidenceImpact(materiality) * 100;
}

function urgencyRank(urgency: GapUrgency): number {
  switch (urgency) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    case "CRITICAL":
      return 4;
  }
}

function freezeGap(gap: InformationGap): InformationGap {
  return Object.freeze({
    ...gap,
    affectedClaimIds: Object.freeze([...gap.affectedClaimIds]),
    affectedDecisionIds: Object.freeze([...gap.affectedDecisionIds]),
    affectedTargets: Object.freeze([...gap.affectedTargets]),
  });
}

function freezeReadiness(readiness: DiscoveryReadiness): DiscoveryReadiness {
  return Object.freeze({
    ...readiness,
    blockingGapIds: Object.freeze([...readiness.blockingGapIds]),
    declaredUncertaintyGapIds: Object.freeze([...readiness.declaredUncertaintyGapIds]),
  });
}

function normalize(value: number): number {
  return Math.max(0, Math.min(1, round(value)));
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
