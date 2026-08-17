import {
  AdaptiveInterviewPlanner,
  type BrainDiscoveryState,
  type CandidateQuestion,
  type InformationGap,
  type InterviewBudget,
  type DiscoveryReadiness,
} from "../../../brain-evaluation/adaptive-discovery";
import type { RequiredEvidenceType } from "../../../brain-evaluation/uncertainty-engine";
import type { RealCompanyBrainResult } from "./real-company-brain-orchestrator";

export type ProductionDiscoveryTarget =
  | "DISCOVERY"
  | "OWNER_INTERVIEW"
  | "MANAGER_INTERVIEW"
  | "OPERATOR_INTERVIEW"
  | "FINANCE_INTERVIEW"
  | "IT_INTERVIEW"
  | "KNOWLEDGE_DOCUMENT"
  | "SYSTEM_EVIDENCE"
  | "PROCESS_EVIDENCE";

export interface QuestionIntent {
  readonly gapId: string;
  readonly targetSource: ProductionDiscoveryTarget;
  readonly businessConcept: string;
  readonly reason: string;
  readonly expectedEvidenceType: RequiredEvidenceType;
  readonly materiality: InformationGap["materiality"];
  readonly decisionBlocked: boolean;
  readonly traceability: Readonly<{
    readonly companyId: string;
    readonly tenantId: string;
    readonly unknownIds: readonly string[];
    readonly contradictionIds: readonly string[];
    readonly evidenceIds: readonly string[];
    readonly affectedDecisionIds: readonly string[];
  }>;
}

export interface RecommendedDiscoveryAction {
  readonly questionId: string;
  readonly targetSource: ProductionDiscoveryTarget;
  readonly questionIntent: QuestionIntent;
  readonly naturalWording?: string;
  readonly whyThisMatters: string;
  readonly decisionUnlocked: readonly string[];
  readonly priority: CandidateQuestion["priority"];
  readonly evidenceRequested: RequiredEvidenceType;
  readonly valueScore: number;
}

export interface AdaptiveDiscoveryPlan {
  readonly companyId: string;
  readonly tenantId: string;
  readonly brainRunReference: string;
  readonly materialGaps: readonly InformationGap[];
  readonly recommendedActions: readonly RecommendedDiscoveryAction[];
  readonly stoppingReason: DiscoveryReadiness["rationale"];
  readonly readiness: DiscoveryReadiness;
  readonly remainingQuestionBudget: number;
}

export interface AdaptiveDiscoveryOptions {
  readonly maximumQuestions?: number;
  readonly alreadyAskedQuestionIds?: readonly string[];
  readonly questionsAskedByDomain?: Readonly<Record<string, number>>;
  readonly renderQuestion?: (intent: QuestionIntent) => Promise<string>;
}

/**
 * Bridges Brain's deterministic discovery planner to production targets.
 * It proposes actions only; it never creates Discovery or Interview records.
 */
export class AdaptiveDiscoveryProductionBridge {
  async plan(
    result: RealCompanyBrainResult,
    options: AdaptiveDiscoveryOptions = {},
  ): Promise<AdaptiveDiscoveryPlan> {
    const budget: InterviewBudget = {
      maximumQuestions: options.maximumQuestions ?? 10,
      maximumQuestionsPerDomain: 5,
      minimumValueThreshold: 0.1,
      alreadyAskedQuestionIds: Object.freeze([...(options.alreadyAskedQuestionIds ?? [])]),
      questionsAskedByDomain: options.questionsAskedByDomain ?? {},
    };
    const state: BrainDiscoveryState = {
      evidence: result.brainEvidence,
      claims: result.claims,
      unknowns: result.whatWeDoNotKnow,
      contradictions: result.contradictions,
      clarifications: [],
      decisionDependencies: [],
      budget,
    };
    const planned = new AdaptiveInterviewPlanner().plan(state);
    const actions = await Promise.all(
      planned.candidates.map(async (candidate) => {
        const gap = planned.gaps.find((item) => candidate.targetGapIds.includes(item.gapId));
        if (!gap) throw new Error("Question target gap is missing");
        const intent = this.toIntent(result, gap);
        const naturalWording = options.renderQuestion
          ? await options.renderQuestion(intent)
          : undefined;
        return Object.freeze({
          questionId: candidate.questionId,
          targetSource: targetFor(candidate.respondentRole, candidate.questionType),
          questionIntent: intent,
          ...(naturalWording ? { naturalWording } : {}),
          whyThisMatters: candidate.rationale,
          decisionUnlocked: Object.freeze([...gap.affectedDecisionIds]),
          priority: candidate.priority,
          evidenceRequested: candidate.requiredEvidenceType,
          valueScore: candidate.valueScore,
        });
      }),
    );
    return Object.freeze({
      companyId: result.companyId,
      tenantId: result.tenantId,
      brainRunReference: `brain:${result.companyId}`,
      materialGaps: Object.freeze([...planned.gaps]),
      recommendedActions: Object.freeze(actions),
      stoppingReason: planned.readiness.rationale,
      readiness: planned.readiness,
      remainingQuestionBudget: Math.max(
        0,
        budget.maximumQuestions - budget.alreadyAskedQuestionIds.length,
      ),
    });
  }

  private toIntent(result: RealCompanyBrainResult, gap: InformationGap): QuestionIntent {
    return Object.freeze({
      gapId: gap.gapId,
      targetSource: targetFor(gap.candidateRespondentRole, undefined),
      businessConcept: gap.subject,
      reason: gap.reasonMissing,
      expectedEvidenceType: gap.requiredEvidenceType,
      materiality: gap.materiality,
      decisionBlocked: gap.materiality === "HIGH" || gap.materiality === "CRITICAL",
      traceability: Object.freeze({
        companyId: result.companyId,
        tenantId: result.tenantId,
        unknownIds: result.whatWeDoNotKnow
          .filter((unknown) => gap.gapId === `gap:${unknown.unknownId}`)
          .map((unknown) => unknown.unknownId),
        contradictionIds: result.contradictions
          .filter((contradiction) => gap.gapId === `gap:${contradiction.contradictionId}`)
          .map((contradiction) => contradiction.contradictionId),
        evidenceIds: result.brainEvidence.map((evidence) => evidence.evidenceId),
        affectedDecisionIds: Object.freeze([...gap.affectedDecisionIds]),
      }),
    });
  }
}

function targetFor(
  respondentRole: string,
  questionType: CandidateQuestion["questionType"] | undefined,
): ProductionDiscoveryTarget {
  const role = respondentRole.toLowerCase();
  if (questionType === "SYSTEM_DATA_REQUEST" || role.includes("system")) return "SYSTEM_EVIDENCE";
  if (questionType === "DOCUMENT_REQUEST" || role.includes("document")) return "KNOWLEDGE_DOCUMENT";
  if (role.includes("finance")) return "FINANCE_INTERVIEW";
  if (role.includes("it")) return "IT_INTERVIEW";
  if (role.includes("manager")) return "MANAGER_INTERVIEW";
  if (role.includes("operator")) return "OPERATOR_INTERVIEW";
  if (role.includes("owner") || role.includes("executive")) return "OWNER_INTERVIEW";
  if (role.includes("process")) return "PROCESS_EVIDENCE";
  return "DISCOVERY";
}
