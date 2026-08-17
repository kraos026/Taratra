import type { AICandidate, AIProvider } from "../../../brain-evaluation/ai-interpretation-gateway";
import { AIInterpretationGateway } from "../../../brain-evaluation/ai-interpretation-gateway";
import type { Contradiction, Evidence } from "../../../brain-evaluation/brain-contracts";
import type { HypothesisCandidate } from "../../../brain-evaluation/hypothesis-expansion";
import { IntakeSession, IntakeSource, type IntakeSourceType } from "../domain/company-intake";
import {
  IntakeInterpretationAdapter,
  type EnterpriseSemanticInterpretationContext,
  type IntakeInterpretationResult,
} from "./intake-interpretation-adapter";
import type {
  ProductionDiscoveryTarget,
  QuestionIntent,
} from "./adaptive-discovery-production-bridge";

export type InterviewParticipantRole = "OWNER" | "MANAGER" | "OPERATOR" | "FINANCE" | "IT";
export type FollowUpRejectionReason =
  | "ANSWER_COMPLETE"
  | "BETTER_SOURCE_AVAILABLE"
  | "BUDGET_EXHAUSTED"
  | "DUPLICATE_QUESTION"
  | "NO_REMAINING_GAP";
export type FollowUpReason =
  "AMBIGUOUS" | "INCOMPLETE" | "CONTRADICTORY" | "TOO_GENERAL" | "MISSING_REQUESTED_EVIDENCE";

export interface SupportedTerminologyCandidate {
  readonly rawTerm: string;
  readonly normalizedCandidate: string;
  readonly ambiguity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "AMBIGUOUS";
  readonly evidenceReferences: readonly string[];
}

export interface AdaptiveInterviewIntelligenceInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly actionId: string;
  readonly questionIntent: QuestionIntent;
  readonly participantRole: InterviewParticipantRole;
  readonly knownTerminology?: readonly SupportedTerminologyCandidate[];
  readonly relevantEvidence?: readonly Evidence[];
  readonly relevantContradictions?: readonly Contradiction[];
  readonly relevantHypotheses?: readonly HypothesisCandidate[];
  readonly alreadyAskedQuestionKeys?: readonly string[];
  readonly followUpsAskedForAction?: number;
  readonly maximumFollowUpsPerMaterialQuestion?: number;
}

export interface AdaptiveInterviewTurn {
  readonly questionText: string;
  readonly whyThisIsBeingAsked?: string;
  readonly expectedEvidenceType: QuestionIntent["expectedEvidenceType"];
  readonly allowUnknown: true;
  readonly response?: Readonly<{
    readonly rawAnswer: string;
    readonly interpreted: boolean;
  }>;
  readonly followUpState: Readonly<{
    readonly eligible: boolean;
    readonly budgetRemaining: number;
    readonly reason?: FollowUpReason;
    readonly rejectionReason?: FollowUpRejectionReason;
  }>;
}

export interface AdaptiveInterviewIntelligenceResult {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly actionId: string;
  readonly questionIntent: QuestionIntent;
  readonly turn: AdaptiveInterviewTurn;
  readonly providerUsed: boolean;
  readonly fallbackUsed: boolean;
  readonly validationIssues: readonly string[];
  readonly metrics: Readonly<{
    readonly questionsRendered: number;
    readonly fallbackQuestions: number;
    readonly questionIntentModifications: 0;
    readonly factAutoPromotion: 0;
    readonly unapprovedWrites: 0;
    readonly crossCompanyLeakage: 0;
  }>;
}

export interface ProductionAnswerInput {
  readonly productionResponseId: string;
  readonly productionQuestionId: string;
  readonly rawAnswer: string;
  readonly actorId: string;
  readonly sessionId: string;
  readonly capturedAt: Date;
  readonly sourceReference: string;
  readonly questionText: string;
}

export interface AnswerInterpretationResult {
  readonly rawAnswer: string;
  readonly canonicalRawSource: true;
  readonly interpretation: IntakeInterpretationResult;
  readonly uncertaintyMarkers: readonly string[];
  readonly approximateEstimate?: Readonly<{
    readonly valueText: string;
    readonly unitText?: string;
    readonly approximate: true;
    readonly exactFact: false;
  }>;
  readonly candidateTypes: readonly string[];
  readonly factAutoPromotion: 0;
  readonly promptInjectionPolicyViolation: 0;
}

export interface FollowUpCandidate {
  readonly sourceAnswerId: string;
  readonly reason: FollowUpReason;
  readonly clarificationNeed: string;
  readonly suggestedWording: string;
  readonly relatedGapId: string;
  readonly relatedHypothesisId?: string;
  readonly evidenceNeeded: QuestionIntent["expectedEvidenceType"];
}

export interface FollowUpValidationResult {
  readonly candidate: FollowUpCandidate | null;
  readonly accepted: boolean;
  readonly rejectedReason?: FollowUpRejectionReason;
  readonly sourceEscalation?: ProductionDiscoveryTarget;
  readonly duplicate: boolean;
  readonly budgetRemaining: number;
}

/**
 * Application adapter for bounded conversational assistance.
 *
 * QuestionIntent remains the authority. AI can only suggest wording and
 * response interpretation helpers; it cannot create production questions,
 * write Knowledge directly or promote answers to FACT.
 */
export class AdaptiveInterviewIntelligenceService {
  constructor(private readonly aiProvider?: AIProvider) {}

  async renderApprovedAction(
    input: AdaptiveInterviewIntelligenceInput,
  ): Promise<AdaptiveInterviewIntelligenceResult> {
    validateScope(input);
    const deterministic = deterministicQuestion(input);
    const maxFollowUps = input.maximumFollowUpsPerMaterialQuestion ?? 2;
    let questionText = deterministic;
    let providerUsed = false;
    let fallbackUsed = !this.aiProvider;
    const issues: string[] = [];

    if (this.aiProvider) {
      try {
        const proposed = await this.aiQuestion(input);
        providerUsed = true;
        const validation = validateQuestion({
          question: proposed,
          input,
          deterministicQuestion: deterministic,
        });
        if (validation.length) {
          issues.push(...validation);
          fallbackUsed = true;
        } else {
          questionText = proposed;
        }
      } catch {
        fallbackUsed = true;
        issues.push("provider unavailable; deterministic fallback used");
      }
    }

    return deepFreeze({
      tenantId: input.tenantId,
      companyId: input.companyId,
      brainRunId: input.brainRunId,
      actionId: input.actionId,
      questionIntent: input.questionIntent,
      turn: {
        questionText,
        whyThisIsBeingAsked: boundedExplanation(input.questionIntent),
        expectedEvidenceType: input.questionIntent.expectedEvidenceType,
        allowUnknown: true,
        followUpState: {
          eligible: (input.followUpsAskedForAction ?? 0) < maxFollowUps,
          budgetRemaining: Math.max(0, maxFollowUps - (input.followUpsAskedForAction ?? 0)),
        },
      },
      providerUsed,
      fallbackUsed,
      validationIssues: issues,
      metrics: {
        questionsRendered: 1,
        fallbackQuestions: fallbackUsed ? 1 : 0,
        questionIntentModifications: 0,
        factAutoPromotion: 0,
        unapprovedWrites: 0,
        crossCompanyLeakage: 0,
      },
    });
  }

  async interpretAnswer(
    input: AdaptiveInterviewIntelligenceInput & {
      readonly answer: ProductionAnswerInput;
      readonly semanticContext?: EnterpriseSemanticInterpretationContext;
    },
  ): Promise<AnswerInterpretationResult> {
    validateScope(input);
    if (!this.aiProvider) throw new Error("AI provider is required for response interpretation");
    const source = IntakeSource.create({
      sourceId: input.answer.productionResponseId,
      tenantId: input.tenantId,
      companyId: input.companyId,
      sourceType: sourceTypeFor(input.participantRole),
      title: input.answer.questionText,
      origin: input.answer.sourceReference,
      rawText: input.answer.rawAnswer,
      actorId: input.answer.actorId,
      receivedAt: input.answer.capturedAt,
      metadata: {
        actionId: input.actionId,
        gapId: input.questionIntent.gapId,
        brainRunId: input.brainRunId,
      },
    });
    const session = IntakeSession.create({
      sessionId: input.answer.sessionId,
      tenantId: input.tenantId,
      companyId: input.companyId,
    });
    const interpretation = await new IntakeInterpretationAdapter(
      this.aiProvider,
    ).interpretEnterpriseSemantics(source, session, {
      ...input.semanticContext,
      knownTerminology: supportedTerms(input).map((term) => term.rawTerm),
      relevantProcessContext: [
        input.questionIntent.businessConcept,
        ...(input.relevantHypotheses?.map((hypothesis) => hypothesis.subject) ?? []),
      ],
      relatedKnowledgeReferences: input.relevantEvidence?.map((evidence) => evidence.evidenceId),
    });
    return deepFreeze({
      rawAnswer: input.answer.rawAnswer,
      canonicalRawSource: true,
      interpretation,
      uncertaintyMarkers: uncertaintyMarkers(input.answer.rawAnswer),
      approximateEstimate: approximateEstimate(input.answer.rawAnswer),
      candidateTypes: interpretation.interpretation.candidates.map(
        (candidate) => candidate.candidateType,
      ),
      factAutoPromotion: 0,
      promptInjectionPolicyViolation: 0,
    });
  }

  validateFollowUp(
    input: AdaptiveInterviewIntelligenceInput & {
      readonly answer: ProductionAnswerInput;
      readonly candidate?: Partial<FollowUpCandidate>;
    },
  ): FollowUpValidationResult {
    validateScope(input);
    const maxFollowUps = input.maximumFollowUpsPerMaterialQuestion ?? 2;
    const budgetRemaining = Math.max(0, maxFollowUps - (input.followUpsAskedForAction ?? 0));
    const answerState = classifyAnswer(input.answer.rawAnswer, input);
    const escalation = sourceEscalation(input, answerState);
    if (escalation) {
      return freezeFollowUp({
        candidate: null,
        accepted: false,
        rejectedReason: "BETTER_SOURCE_AVAILABLE",
        sourceEscalation: escalation,
        duplicate: false,
        budgetRemaining,
      });
    }
    if (!answerState) {
      return freezeFollowUp({
        candidate: null,
        accepted: false,
        rejectedReason: "ANSWER_COMPLETE",
        duplicate: false,
        budgetRemaining,
      });
    }
    if (budgetRemaining <= 0) {
      return freezeFollowUp({
        candidate: null,
        accepted: false,
        rejectedReason: "BUDGET_EXHAUSTED",
        duplicate: false,
        budgetRemaining,
      });
    }
    const suggestedWording =
      input.candidate?.suggestedWording ?? deterministicFollowUpQuestion(input, answerState);
    const duplicate = isDuplicate(suggestedWording, input.alreadyAskedQuestionKeys ?? []);
    if (duplicate) {
      return freezeFollowUp({
        candidate: null,
        accepted: false,
        rejectedReason: "DUPLICATE_QUESTION",
        duplicate,
        budgetRemaining,
      });
    }
    const candidate: FollowUpCandidate = {
      sourceAnswerId: input.answer.productionResponseId,
      reason: answerState,
      clarificationNeed: input.candidate?.clarificationNeed ?? input.questionIntent.reason,
      suggestedWording,
      relatedGapId: input.questionIntent.gapId,
      ...(input.candidate?.relatedHypothesisId
        ? { relatedHypothesisId: input.candidate.relatedHypothesisId }
        : {}),
      evidenceNeeded: input.questionIntent.expectedEvidenceType,
    };
    return freezeFollowUp({
      candidate,
      accepted: true,
      duplicate: false,
      budgetRemaining: budgetRemaining - 1,
    });
  }

  private async aiQuestion(input: AdaptiveInterviewIntelligenceInput): Promise<string> {
    if (!this.aiProvider) return deterministicQuestion(input);
    const gateway = new AIInterpretationGateway(this.aiProvider);
    const result = await gateway.interpret({
      requestId: `${input.brainRunId}:${input.actionId}:question-rendering`,
      tenantId: input.tenantId,
      companyId: input.companyId,
      sourceId: input.actionId,
      sourceType: "QUESTION_INTENT",
      sourceText: questionPrompt(input),
      task: "ADAPTIVE_INTERVIEW_QUESTION_RENDERING",
      schemaVersion: "adaptive-interview-question-v1",
      knownClaims: supportedTerms(input).map(
        (term) => `${term.rawTerm}=${term.normalizedCandidate}`,
      ),
      knownUnknowns: [
        input.questionIntent.businessConcept,
        ...(input.relevantContradictions?.map((contradiction) => contradiction.impact) ?? []),
      ],
      constraints: Object.freeze([
        "Render one short, neutral, non-leading business question.",
        "Do not change QuestionIntent target evidence or materiality.",
        "Allow the respondent to say they do not know.",
        "Do not expose private provenance or internal Brain scores.",
      ]),
      speakerRole: input.participantRole,
      traceContext: {
        companyId: input.companyId,
        actionId: input.actionId,
        gapId: input.questionIntent.gapId,
        brainRunId: input.brainRunId,
      },
    });
    return extractQuestion(result.candidates) ?? deterministicQuestion(input);
  }
}

function validateScope(input: AdaptiveInterviewIntelligenceInput): void {
  const trace = input.questionIntent.traceability;
  if (trace.tenantId !== input.tenantId || trace.companyId !== input.companyId)
    throw new Error("QuestionIntent scope does not match request scope");
  for (const evidence of input.relevantEvidence ?? []) {
    if (evidence.tenantId && evidence.tenantId !== input.tenantId)
      throw new Error("Cross-tenant evidence cannot enter adaptive interview context");
    if (evidence.companyId && evidence.companyId !== input.companyId)
      throw new Error("Cross-company evidence cannot enter adaptive interview context");
  }
  for (const hypothesis of input.relevantHypotheses ?? []) {
    if (
      hypothesis.sourceScope.tenantId !== input.tenantId ||
      hypothesis.sourceScope.companyId !== input.companyId
    )
      throw new Error("Cross-company hypothesis cannot enter adaptive interview context");
  }
}

function deterministicQuestion(input: AdaptiveInterviewIntelligenceInput): string {
  const concept = humanize(input.questionIntent.businessConcept);
  const reason =
    `${input.questionIntent.reason} ${input.questionIntent.businessConcept}`.toLowerCase();
  if (reason.includes("approval") && reason.includes("avail")) {
    if (input.participantRole === "OPERATOR")
      return "What happens while you wait for approval, especially when the usual approver is unavailable?";
    return "What normally happens when the person who approves this request is unavailable?";
  }
  if (input.questionIntent.expectedEvidenceType === "METRIC") {
    if (input.participantRole === "FINANCE")
      return `Where can we verify the actual ${concept}, and how reliable is that source?`;
    if (input.participantRole === "OPERATOR")
      return `If you know, roughly what is the ${concept}; if not, which system or team can confirm it?`;
    return `What is the best source to verify the actual ${concept}?`;
  }
  if (input.questionIntent.expectedEvidenceType === "DOCUMENT")
    return `Which document describes ${concept} in practice?`;
  if (input.relevantContradictions?.length) return `How does ${concept} work in practice today?`;
  return `Can you describe what happens around ${concept} in your day-to-day work?`;
}

function deterministicFollowUpQuestion(
  input: AdaptiveInterviewIntelligenceInput,
  reason: FollowUpReason,
): string {
  const concept = humanize(input.questionIntent.businessConcept);
  if (reason === "CONTRADICTORY") return `Which version of ${concept} matches what happens today?`;
  if (reason === "MISSING_REQUESTED_EVIDENCE") return `What evidence would help verify ${concept}?`;
  return `Can you give one concrete example of ${concept}?`;
}

function questionPrompt(input: AdaptiveInterviewIntelligenceInput): string {
  return [
    `Role: ${input.participantRole}`,
    `Concept: ${input.questionIntent.businessConcept}`,
    `Reason: ${input.questionIntent.reason}`,
    `Evidence needed: ${input.questionIntent.expectedEvidenceType}`,
    `Materiality: ${input.questionIntent.materiality}`,
    `Blocked decision: ${String(input.questionIntent.decisionBlocked)}`,
    `Supported terms: ${
      supportedTerms(input)
        .map((term) => term.rawTerm)
        .join(", ") || "none"
    }`,
    `Hypotheses under investigation: ${
      input.relevantHypotheses?.map((hypothesis) => hypothesis.subject).join(", ") ?? "none"
    }`,
  ].join("\n");
}

function extractQuestion(candidates: readonly AICandidate[]): string | null {
  const statement = candidates[0]?.statement.trim();
  if (!statement) return null;
  return statement.replace(/^["']|["']$/g, "");
}

function validateQuestion(input: {
  readonly question: string;
  readonly input: AdaptiveInterviewIntelligenceInput;
  readonly deterministicQuestion: string;
}): readonly string[] {
  const issues: string[] = [];
  const normalized = input.question.toLowerCase();
  if (input.question.length > 220) issues.push("question too long");
  if ((input.question.match(/\?/g) ?? []).length > 1) issues.push("multi-part question");
  if (
    /\b(would you agree|isn't it true|confirm that|causing the bottleneck)\b/i.test(input.question)
  )
    issues.push("leading question rejected");
  const intent = input.input.questionIntent;
  if (
    !intent.businessConcept.toLowerCase().includes("bottleneck") &&
    normalized.includes("bottleneck")
  )
    issues.push("question exposes internal hypothesis as truth");
  if (isDuplicate(input.question, input.input.alreadyAskedQuestionKeys ?? []))
    issues.push("duplicate question rejected");
  if (mentionsUnsupportedTerm(input.question, input.input))
    issues.push("unsupported terminology used");
  return Object.freeze(issues);
}

function supportedTerms(
  input: AdaptiveInterviewIntelligenceInput,
): readonly SupportedTerminologyCandidate[] {
  return Object.freeze(
    (input.knownTerminology ?? []).filter(
      (term) =>
        (term.ambiguity === "NONE" || term.ambiguity === "LOW") &&
        term.evidenceReferences.length > 0,
    ),
  );
}

function mentionsUnsupportedTerm(
  question: string,
  input: AdaptiveInterviewIntelligenceInput,
): boolean {
  const ambiguous = (input.knownTerminology ?? []).filter(
    (term) => term.ambiguity === "HIGH" || term.ambiguity === "AMBIGUOUS",
  );
  return ambiguous.some((term) => question.toLowerCase().includes(term.rawTerm.toLowerCase()));
}

function boundedExplanation(intent: QuestionIntent): string {
  if (intent.decisionBlocked)
    return `We are trying to understand what evidence is still needed before ${intent.traceability.affectedDecisionIds[0] ?? "the next decision"} can move forward.`;
  return "We are trying to understand the current process without assuming an answer.";
}

function classifyAnswer(
  rawAnswer: string,
  input: AdaptiveInterviewIntelligenceInput,
): FollowUpReason | null {
  const normalized = rawAnswer.toLowerCase();
  if (
    /\b(i don't know|i do not know|not sure|i'm not sure|it depends|need to check)\b/.test(
      normalized,
    )
  )
    return "MISSING_REQUESTED_EVIDENCE";
  if (input.relevantContradictions?.length) return "CONTRADICTORY";
  if (rawAnswer.trim().split(/\s+/).length < 5) return "TOO_GENERAL";
  if (/\b(maybe|roughly|around|usually|as far as i know|i think)\b/.test(normalized))
    return "AMBIGUOUS";
  return null;
}

function sourceEscalation(
  input: AdaptiveInterviewIntelligenceInput,
  reason: FollowUpReason | null,
): ProductionDiscoveryTarget | undefined {
  if (reason !== "MISSING_REQUESTED_EVIDENCE") return undefined;
  if (input.questionIntent.expectedEvidenceType === "METRIC") {
    if (input.participantRole === "OPERATOR" || input.participantRole === "MANAGER")
      return "SYSTEM_EVIDENCE";
    return "FINANCE_INTERVIEW";
  }
  if (input.questionIntent.expectedEvidenceType === "DOCUMENT") return "KNOWLEDGE_DOCUMENT";
  return undefined;
}

function isDuplicate(question: string, existingKeys: readonly string[]): boolean {
  const key = semanticQuestionKey(question);
  return existingKeys.map(semanticQuestionKey).includes(key);
}

function semanticQuestionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(
      /\b(the|a|an|when|what|how|does|do|can|you|usually|normally|please|tell|me|about)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function uncertaintyMarkers(answer: string): readonly string[] {
  const markers = [
    "I think",
    "usually",
    "maybe",
    "around",
    "roughly",
    "as far as I know",
    "it depends",
  ];
  return Object.freeze(
    markers.filter((marker) => answer.toLowerCase().includes(marker.toLowerCase())),
  );
}

function approximateEstimate(answer: string):
  | Readonly<{
      readonly valueText: string;
      readonly unitText?: string;
      readonly approximate: true;
      readonly exactFact: false;
    }>
  | undefined {
  const match = answer.match(
    /\b(?:maybe|probably|around|roughly|about)?\s*(\d+(?:\s*(?:-|to)\s*\d+)?)\s*([a-z/ ]+)?/i,
  );
  if (!match || !/\b(maybe|probably|around|roughly|about|to|-)\b/i.test(match[0])) return undefined;
  return Object.freeze({
    valueText: match[1]!.trim(),
    ...(match[2]?.trim() ? { unitText: match[2].trim() } : {}),
    approximate: true,
    exactFact: false,
  });
}

function sourceTypeFor(role: InterviewParticipantRole): IntakeSourceType {
  if (role === "OWNER") return "OWNER_INPUT";
  if (role === "MANAGER") return "MANAGER_INTERVIEW";
  if (role === "OPERATOR") return "EMPLOYEE_INTERVIEW";
  if (role === "FINANCE") return "EXECUTIVE_INTERVIEW";
  return "OTHER";
}

function humanize(value: string): string {
  return value.replace(/[_:-]+/g, " ").trim();
}

function freezeFollowUp(result: FollowUpValidationResult): FollowUpValidationResult {
  return deepFreeze(result);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
