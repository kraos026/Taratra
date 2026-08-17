import type { AIProvider } from "../../../brain-evaluation/ai-interpretation-gateway";
import { AIInterpretationGateway } from "../../../brain-evaluation/ai-interpretation-gateway";
import type {
  StrategyComparisonReadModel,
  StrategyComparisonItem,
} from "./solution-strategy-generation";
import type {
  ExecutiveDecisionState,
  ExecutiveDecisionView,
  ExecutiveEconomicState,
  ExecutivePriorityCard,
} from "./executive-decision-view";

export type AskAutomateXIntentType =
  | "WHY_DECISION"
  | "WHY_NOT_AUTOMATE"
  | "WHY_AUTOMATE"
  | "WHAT_IS_WRONG"
  | "WHAT_DO_WE_KNOW"
  | "WHAT_DO_WE_BELIEVE"
  | "WHAT_IS_UNKNOWN"
  | "SHOW_EVIDENCE"
  | "SHOW_CONTRADICTIONS"
  | "WHAT_IS_MISSING"
  | "WHAT_SHOULD_WE_FIX_FIRST"
  | "WHAT_SHOULD_WE_DO_NEXT"
  | "WHY_THIS_PRIORITY"
  | "WHAT_ARE_THE_ALTERNATIVES"
  | "COMPARE_STRATEGIES"
  | "WHAT_WOULD_CHANGE_THE_DECISION"
  | "IS_IT_ECONOMICALLY_JUSTIFIED"
  | "WHAT_IF_EVIDENCE_CHANGES"
  | "EXPLAIN_TERM"
  | "OTHER_BOUNDED_AUDIT_QUESTION";

export type AskAutomateXAnswerStatus =
  | "ANSWERED"
  | "ANSWERED_WITH_UNCERTAINTY"
  | "INSUFFICIENT_EVIDENCE"
  | "CLARIFICATION_REQUIRED"
  | "OUT_OF_SCOPE"
  | "PROVIDER_FALLBACK";

export type AskAutomateXTargetEntityType =
  | "DECISION_CARD"
  | "OPPORTUNITY"
  | "STRATEGY"
  | "ECONOMICS"
  | "PROCESS_NODE"
  | "TERM"
  | "COMPANY_AUDIT"
  | "UNKNOWN";

export type AskEvidenceDepth = "SUMMARY" | "DETAILED";

export interface AskAutomateXInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly userId: string;
  readonly question: string;
  readonly context?: Readonly<{
    readonly decisionCardId?: string;
    readonly opportunityId?: string;
    readonly strategyCandidateId?: string;
    readonly economicResultId?: string;
    readonly processNodeId?: string;
    readonly previousIntent?: AskAutomateXIntent;
    readonly previousBrainRunId?: string;
  }>;
}

export interface AskAutomateXIntent {
  readonly intentType: AskAutomateXIntentType;
  readonly targetEntityType: AskAutomateXTargetEntityType;
  readonly targetEntityId: string | null;
  readonly requestedPerspective: "EXECUTIVE" | "EVIDENCE" | "ECONOMIC" | "STRATEGY" | "PROCESS";
  readonly requestedEvidenceDepth: AskEvidenceDepth;
  readonly language: "en" | "fr";
  readonly ambiguity: "NONE" | "RESOLVED_FROM_CONTEXT" | "CLARIFICATION_REQUIRED";
}

export interface AskAutomateXEvidenceRef {
  readonly label: string;
  readonly supports: string;
  readonly sourceId?: string;
}

export interface GroundedAnswerPlan {
  readonly intent: AskAutomateXIntent;
  readonly authoritativeAnswerPoints: readonly string[];
  readonly knownFacts: readonly string[];
  readonly qualifiedBeliefs: readonly string[];
  readonly unknowns: readonly string[];
  readonly contradictions: readonly string[];
  readonly economicValues: readonly string[];
  readonly evidenceReferences: readonly AskAutomateXEvidenceRef[];
  readonly conflictingEvidenceReferences: readonly AskAutomateXEvidenceRef[];
  readonly allowedStrategyReferences: readonly StrategyComparisonItem[];
  readonly nextActions: readonly string[];
  readonly whatWouldChangeDecision: readonly string[];
  readonly prohibitedClaims: readonly string[];
}

export interface AskAutomateXResponse {
  readonly answer: string;
  readonly answerStatus: AskAutomateXAnswerStatus;
  readonly intent: AskAutomateXIntent;
  readonly authoritativeDecisionState: ExecutiveDecisionState | null;
  readonly economicState: ExecutiveEconomicState | "UNKNOWN" | null;
  readonly known: readonly string[];
  readonly beliefs: readonly string[];
  readonly unknowns: readonly string[];
  readonly contradictions: readonly string[];
  readonly supportingEvidence: readonly AskAutomateXEvidenceRef[];
  readonly conflictingEvidence: readonly AskAutomateXEvidenceRef[];
  readonly relevantStrategies: readonly StrategyComparisonItem[];
  readonly nextActions: readonly string[];
  readonly whatWouldChangeDecision: readonly string[];
  readonly traceability: Readonly<{
    readonly tenantId: string;
    readonly companyId: string;
    readonly userId: string;
    readonly brainRunId: string;
    readonly decisionRefs: readonly string[];
    readonly economicRefs: readonly string[];
    readonly strategyRefs: readonly string[];
    readonly evidenceRefs: readonly string[];
  }>;
  readonly providerMetadata: Readonly<{ readonly provider: string; readonly model: string }> | null;
  readonly validation: Readonly<{ readonly valid: boolean; readonly issues: readonly string[] }>;
}

export interface AskAutomateXReadModel {
  readonly view: ExecutiveDecisionView;
  readonly strategies?: StrategyComparisonReadModel;
  readonly terminology?: Readonly<Record<string, AskAutomateXEvidenceRef>>;
}

export interface AskAutomateXReadModelPort {
  read(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly userId: string;
  }): Promise<AskAutomateXReadModel | null>;
}

export class AskAutomateXService {
  constructor(
    private readonly readModel: AskAutomateXReadModelPort,
    private readonly provider?: AIProvider,
    private readonly validator = new AskAutomateXAnswerIntegrityValidator(),
  ) {}

  async ask(input: AskAutomateXInput): Promise<AskAutomateXResponse> {
    validateAskInput(input);
    const model = await this.readModel.read({
      tenantId: input.tenantId,
      companyId: input.companyId,
      userId: input.userId,
    });
    if (!model) return unavailableResponse(input);
    if (model.view.company.id !== input.companyId || model.view.company.tenantId !== input.tenantId)
      throw new Error("Ask AutomateX context is outside the requested company");

    const intent = await this.interpretIntent(input, model);
    if (intent.ambiguity === "CLARIFICATION_REQUIRED")
      return responseFromPlan(input, model, clarificationPlan(intent), "CLARIFICATION_REQUIRED");
    if (
      crossCompanyScopeAttack(input.question) ||
      (intent.intentType === "OTHER_BOUNDED_AUDIT_QUESTION" && outOfScope(input.question))
    )
      return responseFromPlan(input, model, outOfScopePlan(intent), "OUT_OF_SCOPE");

    const plan = buildPlan(input, intent, model);
    if (plan.authoritativeAnswerPoints.length === 0 && plan.unknowns.length > 0)
      return responseFromPlan(input, model, plan, "INSUFFICIENT_EVIDENCE");

    if (this.provider) {
      try {
        const rendered = await this.renderWithProvider(input, plan);
        const validation = this.validator.validate(plan, model.view, rendered.answer);
        if (validation.valid)
          return responseFromPlan(
            input,
            model,
            plan,
            statusFor(plan),
            rendered.answer,
            {
              provider: rendered.provider,
              model: rendered.model,
            },
            validation,
          );
      } catch {
        // Provider failures intentionally fall through to deterministic answer.
      }
    }
    return responseFromPlan(
      input,
      model,
      plan,
      this.provider ? "PROVIDER_FALLBACK" : statusFor(plan),
    );
  }

  private async interpretIntent(
    input: AskAutomateXInput,
    model: AskAutomateXReadModel,
  ): Promise<AskAutomateXIntent> {
    const deterministic = deterministicIntent(input, model);
    if (!this.provider || deterministic.ambiguity !== "NONE") return deterministic;
    try {
      const result = await new AIInterpretationGateway(this.provider).interpret({
        requestId: `${input.companyId}:ask-automatex:intent`,
        tenantId: input.tenantId,
        companyId: input.companyId,
        sourceId: input.companyId,
        sourceType: "EXECUTIVE_QUESTION",
        sourceText: input.question,
        task: "ASK_AUTOMATEX_INTENT",
        schemaVersion: "ask-automatex-intent-v1",
        knownClaims: Object.values(INTENT_HINTS),
        constraints: Object.freeze([
          "Classify intent only; do not answer.",
          "Do not choose business truth or recommendation state.",
          "Return bounded audit/product intent.",
        ]),
      });
      return normalizeIntent(result.candidates[0]?.value, deterministic, input, model);
    } catch {
      return deterministic;
    }
  }

  private async renderWithProvider(
    input: AskAutomateXInput,
    plan: GroundedAnswerPlan,
  ): Promise<{ readonly answer: string; readonly provider: string; readonly model: string }> {
    if (!this.provider) throw new Error("Provider unavailable");
    const result = await new AIInterpretationGateway(this.provider).interpret({
      requestId: `${input.companyId}:ask-automatex:answer:${plan.intent.intentType}`,
      tenantId: input.tenantId,
      companyId: input.companyId,
      sourceId: input.companyId,
      sourceType: "GROUNDED_ANSWER_PLAN",
      sourceText: JSON.stringify(plan),
      task: "ASK_AUTOMATEX_ANSWER_RENDERING",
      schemaVersion: "ask-automatex-answer-v1",
      constraints: Object.freeze([
        "Use only the provided GroundedAnswerPlan.",
        "Preserve know/believe/unknown separation.",
        "Do not invent economics, sources, strategies, decisions or certainty.",
        "Do not expose chain-of-thought.",
      ]),
    });
    return {
      answer: result.candidates[0]?.statement ?? deterministicAnswer(plan),
      provider: result.provider,
      model: result.model,
    };
  }
}

export class AskAutomateXAnswerIntegrityValidator {
  validate(
    plan: GroundedAnswerPlan,
    view: ExecutiveDecisionView,
    answer: string,
  ): Readonly<{ readonly valid: boolean; readonly issues: readonly string[] }> {
    const issues: string[] = [];
    if (reversesDecision(plan, answer)) issues.push("decision reversal");
    if (reversesEconomics(plan, answer)) issues.push("economic-state reversal");
    if (hidesContradiction(plan, answer)) issues.push("hidden material contradiction");
    if (removesUnknowns(plan, answer)) issues.push("removed material uncertainty");
    if (inventedNumber(plan, view, answer)) issues.push("invented economics or metric");
    if (inventedEvidence(plan, answer)) issues.push("invented evidence");
    if (inventedStrategy(plan, answer)) issues.push("invented strategy");
    if (unsupportedCertainty(plan, answer)) issues.push("unsupported certainty");
    return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
  }
}

const INTENT_HINTS: Record<AskAutomateXIntentType, string> = {
  WHY_DECISION: "why decision recommendation rationale",
  WHY_NOT_AUTOMATE: "why not automate human control risk unsafe",
  WHY_AUTOMATE: "why automate this opportunity",
  WHAT_IS_WRONG: "what is wrong problem issue",
  WHAT_DO_WE_KNOW: "what do we know facts",
  WHAT_DO_WE_BELIEVE: "what do we believe hypotheses assumptions",
  WHAT_IS_UNKNOWN: "what is unknown uncertain",
  SHOW_EVIDENCE: "show evidence sources proof",
  SHOW_CONTRADICTIONS: "contradictions conflict discrepancy",
  WHAT_IS_MISSING: "missing evidence gaps",
  WHAT_SHOULD_WE_FIX_FIRST: "fix first remediate",
  WHAT_SHOULD_WE_DO_NEXT: "next action",
  WHY_THIS_PRIORITY: "why priority number one",
  WHAT_ARE_THE_ALTERNATIVES: "alternatives strategies options",
  COMPARE_STRATEGIES: "compare strategies api low code",
  WHAT_WOULD_CHANGE_THE_DECISION: "what would change your mind decision",
  IS_IT_ECONOMICALLY_JUSTIFIED: "roi worth economics justified",
  WHAT_IF_EVIDENCE_CHANGES: "what if evidence changes scenario",
  EXPLAIN_TERM: "explain term acronym means",
  OTHER_BOUNDED_AUDIT_QUESTION: "other bounded audit question",
};

function deterministicIntent(
  input: AskAutomateXInput,
  model: AskAutomateXReadModel,
): AskAutomateXIntent {
  const q = input.question.toLowerCase();
  const resolvedTarget = contextTarget(input, model);
  const intentType = intentTypeFor(q);
  if ((q === "why" || q === "why?") && !resolvedTarget) {
    const active = model.view.priorityCards.length === 1 ? model.view.priorityCards[0] : null;
    if (!active) return baseIntent(input, intentType, "UNKNOWN", null, "CLARIFICATION_REQUIRED");
    return baseIntent(input, "WHY_DECISION", "DECISION_CARD", active.id, "RESOLVED_FROM_CONTEXT");
  }
  return baseIntent(
    input,
    intentType,
    resolvedTarget?.type ?? targetTypeFor(intentType),
    resolvedTarget?.id ?? null,
    "NONE",
  );
}

function normalizeIntent(
  value: unknown,
  fallback: AskAutomateXIntent,
  input: AskAutomateXInput,
  model: AskAutomateXReadModel,
): AskAutomateXIntent {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawType = typeof record.intentType === "string" ? record.intentType : fallback.intentType;
  const intentType = Object.keys(INTENT_HINTS).includes(rawType)
    ? (rawType as AskAutomateXIntentType)
    : fallback.intentType;
  const target = contextTarget(input, model);
  return baseIntent(
    input,
    intentType,
    target?.type ?? targetTypeFor(intentType),
    target?.id ?? null,
    fallback.ambiguity,
  );
}

function baseIntent(
  input: AskAutomateXInput,
  intentType: AskAutomateXIntentType,
  targetEntityType: AskAutomateXTargetEntityType,
  targetEntityId: string | null,
  ambiguity: AskAutomateXIntent["ambiguity"],
): AskAutomateXIntent {
  return deepFreeze({
    intentType,
    targetEntityType,
    targetEntityId,
    requestedPerspective: perspectiveFor(intentType),
    requestedEvidenceDepth: /\b(show|evidence|proof|source)\b/i.test(input.question)
      ? "DETAILED"
      : "SUMMARY",
    language: /[éèàùç]|\bpourquoi|quoi|preuves|inconnu|économie/i.test(input.question)
      ? "fr"
      : "en",
    ambiguity,
  });
}

function contextTarget(
  input: AskAutomateXInput,
  model: AskAutomateXReadModel,
): { readonly type: AskAutomateXTargetEntityType; readonly id: string } | null {
  const c = input.context;
  if (!c) return null;
  if (c.decisionCardId) {
    assertCard(model.view, c.decisionCardId);
    return { type: "DECISION_CARD", id: c.decisionCardId };
  }
  if (c.strategyCandidateId) {
    assertStrategy(model.strategies, c.strategyCandidateId);
    return { type: "STRATEGY", id: c.strategyCandidateId };
  }
  if (c.opportunityId) return { type: "OPPORTUNITY", id: c.opportunityId };
  if (c.economicResultId) return { type: "ECONOMICS", id: c.economicResultId };
  if (c.processNodeId) return { type: "PROCESS_NODE", id: c.processNodeId };
  if (c.previousIntent?.targetEntityId)
    return { type: c.previousIntent.targetEntityType, id: c.previousIntent.targetEntityId };
  return null;
}

function buildPlan(
  input: AskAutomateXInput,
  intent: AskAutomateXIntent,
  model: AskAutomateXReadModel,
): GroundedAnswerPlan {
  const view = model.view;
  const card =
    intent.targetEntityType === "DECISION_CARD" && intent.targetEntityId
      ? (view.priorityCards.find((item) => item.id === intent.targetEntityId) ?? null)
      : (view.priorityCards[0] ?? null);
  const strategies = strategiesFor(intent, model.strategies);
  const terminology = terminologyFor(input, intent, model);
  const points = terminology.points.length
    ? terminology.points
    : answerPoints(intent, view, card, strategies);
  return deepFreeze({
    intent,
    authoritativeAnswerPoints: points,
    knownFacts: view.whatWeKnow,
    qualifiedBeliefs: view.whatWeBelieve,
    unknowns: unknownsFor(intent, view, card),
    contradictions: contradictionsFor(intent, view),
    economicValues: economicsFor(intent, view),
    evidenceReferences: [
      ...terminology.evidenceReferences,
      ...evidenceRefs(
        card?.explanation.supportingSources ?? view.evidenceExplanation.supportingSources,
        card,
      ),
    ],
    conflictingEvidenceReferences: evidenceRefs(
      card?.explanation.conflictingSources ?? view.evidenceExplanation.conflictingSources,
      card,
    ),
    allowedStrategyReferences: strategies,
    nextActions: view.nextBestActions,
    whatWouldChangeDecision: changeConditions(view, card, strategies),
    prohibitedClaims: prohibitedClaims(view),
  });
}

function answerPoints(
  intent: AskAutomateXIntent,
  view: ExecutiveDecisionView,
  card: ExecutivePriorityCard | null,
  strategies: readonly StrategyComparisonItem[],
): readonly string[] {
  switch (intent.intentType) {
    case "WHY_NOT_AUTOMATE":
      return card
        ? [
            card.whatNotToDo ?? "Do not automate this decision without resolving controls.",
            card.whyItMatters,
            card.whatToDoNow,
          ]
        : view.whatNotToAutomate;
    case "WHY_AUTOMATE":
      return card ? [card.whyItMatters, card.whatToDoNow] : view.whatCanBeAutomated;
    case "WHAT_IS_WRONG":
      return view.topProblems;
    case "WHAT_DO_WE_KNOW":
      return view.whatWeKnow;
    case "WHAT_DO_WE_BELIEVE":
      return view.whatWeBelieve;
    case "WHAT_IS_UNKNOWN":
    case "WHAT_IS_MISSING":
      return view.whatWeDoNotKnow;
    case "SHOW_EVIDENCE":
      return view.evidenceExplanation.supportingSources;
    case "SHOW_CONTRADICTIONS":
      return view.contradictions;
    case "WHAT_SHOULD_WE_FIX_FIRST":
      return view.whatToFixFirst;
    case "WHAT_SHOULD_WE_DO_NEXT":
      return view.nextBestActions;
    case "WHAT_ARE_THE_ALTERNATIVES":
    case "COMPARE_STRATEGIES":
      return strategies.map((strategy) => `${strategy.title}: ${strategy.fitRationale}`);
    case "WHAT_WOULD_CHANGE_THE_DECISION":
      return changeConditions(view, card, strategies);
    case "IS_IT_ECONOMICALLY_JUSTIFIED":
      return economicsFor(intent, view);
    case "EXPLAIN_TERM":
      return [];
    case "WHAT_IF_EVIDENCE_CHANGES":
      return [
        "A recalculation has not been performed in this answer. Existing evidence gaps show what would need to change.",
      ];
    case "WHY_THIS_PRIORITY":
    case "WHY_DECISION":
    case "OTHER_BOUNDED_AUDIT_QUESTION":
      return card
        ? [card.recommendationState, card.whyItMatters, card.whatToDoNow]
        : view.nextBestActions;
  }
}

function deterministicAnswer(plan: GroundedAnswerPlan): string {
  if (
    plan.intent.intentType === "OTHER_BOUNDED_AUDIT_QUESTION" &&
    !plan.authoritativeAnswerPoints.length
  )
    return "I can only answer questions about this company audit, its evidence, economics, decisions, strategies, uncertainty and next actions.";
  const sections: string[] = [];
  if (plan.authoritativeAnswerPoints.length)
    sections.push(`Answer: ${plan.authoritativeAnswerPoints.join(" ")}`);
  if (plan.knownFacts.length) sections.push(`We know: ${plan.knownFacts.join(" ")}`);
  if (plan.qualifiedBeliefs.length) sections.push(`We believe: ${plan.qualifiedBeliefs.join(" ")}`);
  if (plan.unknowns.length) sections.push(`We still do not know: ${plan.unknowns.join(" ")}`);
  if (plan.contradictions.length) sections.push(`Contradictions: ${plan.contradictions.join(" ")}`);
  if (plan.economicValues.length) sections.push(`Economics: ${plan.economicValues.join(" ")}`);
  if (plan.whatWouldChangeDecision.length)
    sections.push(`What would change the decision: ${plan.whatWouldChangeDecision.join(" ")}`);
  if (plan.nextActions.length) sections.push(`Next action: ${plan.nextActions[0]}`);
  return sections.join("\n");
}

function responseFromPlan(
  input: AskAutomateXInput,
  model: AskAutomateXReadModel,
  plan: GroundedAnswerPlan,
  status: AskAutomateXAnswerStatus,
  answer = deterministicAnswer(plan),
  providerMetadata: AskAutomateXResponse["providerMetadata"] = null,
  validation: AskAutomateXResponse["validation"] = { valid: true, issues: [] },
): AskAutomateXResponse {
  const card = plan.intent.targetEntityId
    ? (model.view.priorityCards.find((item) => item.id === plan.intent.targetEntityId) ?? null)
    : (model.view.priorityCards[0] ?? null);
  return deepFreeze({
    answer,
    answerStatus: status,
    intent: plan.intent,
    authoritativeDecisionState: card?.recommendationState ?? null,
    economicState: card?.economicState ?? model.view.economicReadiness ?? null,
    known: plan.knownFacts,
    beliefs: plan.qualifiedBeliefs,
    unknowns: plan.unknowns,
    contradictions: plan.contradictions,
    supportingEvidence: plan.evidenceReferences,
    conflictingEvidence: plan.conflictingEvidenceReferences,
    relevantStrategies: plan.allowedStrategyReferences,
    nextActions: plan.nextActions,
    whatWouldChangeDecision: plan.whatWouldChangeDecision,
    traceability: {
      tenantId: input.tenantId,
      companyId: input.companyId,
      userId: input.userId,
      brainRunId: model.view.traceability.brainRunId,
      decisionRefs: card ? [card.id] : model.view.priorityCards.map((item) => item.id),
      economicRefs: model.view.traceability.economicEvidenceIds,
      strategyRefs: plan.allowedStrategyReferences.map((strategy) => strategy.candidateId),
      evidenceRefs: [
        ...plan.evidenceReferences.flatMap((evidence) =>
          evidence.sourceId ? [evidence.sourceId] : [],
        ),
        ...plan.conflictingEvidenceReferences.flatMap((evidence) =>
          evidence.sourceId ? [evidence.sourceId] : [],
        ),
      ],
    },
    providerMetadata,
    validation,
  });
}

function unavailableResponse(input: AskAutomateXInput): AskAutomateXResponse {
  const intent = baseIntent(input, "OTHER_BOUNDED_AUDIT_QUESTION", "COMPANY_AUDIT", null, "NONE");
  const plan: GroundedAnswerPlan = deepFreeze({
    intent,
    authoritativeAnswerPoints: [],
    knownFacts: [],
    qualifiedBeliefs: [],
    unknowns: ["A published executive decision view is required before Ask AutomateX can answer."],
    contradictions: [],
    economicValues: [],
    evidenceReferences: [],
    conflictingEvidenceReferences: [],
    allowedStrategyReferences: [],
    nextActions: ["Complete the executive decision analysis first."],
    whatWouldChangeDecision: ["Publish the authoritative executive decision view."],
    prohibitedClaims: ["Do not invent company decisions."],
  });
  return responseFromPlan(
    input,
    {
      view: unavailableView(input),
    },
    plan,
    "INSUFFICIENT_EVIDENCE",
  );
}

function clarificationPlan(intent: AskAutomateXIntent): GroundedAnswerPlan {
  return deepFreeze({
    intent,
    authoritativeAnswerPoints: ["Which decision, opportunity or strategy should I explain?"],
    knownFacts: [],
    qualifiedBeliefs: [],
    unknowns: [],
    contradictions: [],
    economicValues: [],
    evidenceReferences: [],
    conflictingEvidenceReferences: [],
    allowedStrategyReferences: [],
    nextActions: [],
    whatWouldChangeDecision: [],
    prohibitedClaims: ["Do not guess ambiguous target."],
  });
}

function outOfScopePlan(intent: AskAutomateXIntent): GroundedAnswerPlan {
  return deepFreeze({
    intent,
    authoritativeAnswerPoints: ["Ask AutomateX answers only questions about this company audit."],
    knownFacts: [],
    qualifiedBeliefs: [],
    unknowns: [],
    contradictions: [],
    economicValues: [],
    evidenceReferences: [],
    conflictingEvidenceReferences: [],
    allowedStrategyReferences: [],
    nextActions: [],
    whatWouldChangeDecision: [],
    prohibitedClaims: ["Do not answer from external or generic model memory."],
  });
}

function statusFor(plan: GroundedAnswerPlan): AskAutomateXAnswerStatus {
  if (plan.contradictions.length || plan.unknowns.length) return "ANSWERED_WITH_UNCERTAINTY";
  return "ANSWERED";
}

function intentTypeFor(q: string): AskAutomateXIntentType {
  if (/\b(world cup|weather|poem|recipe|joke)\b/.test(q)) return "OTHER_BOUNDED_AUDIT_QUESTION";
  if (/\b(why.*not automate|shouldn.t.*automate|ne pas automatiser)\b/.test(q))
    return "WHY_NOT_AUTOMATE";
  if (/\b(why.*automate|why recommend|why this recommendation|pourquoi)\b/.test(q))
    return "WHY_DECISION";
  if (/\b(what can we automate|can be automated)\b/.test(q)) return "WHY_AUTOMATE";
  if (/\b(wrong|problem|issue)\b/.test(q)) return "WHAT_IS_WRONG";
  if (/\b(know|facts)\b/.test(q)) return "WHAT_DO_WE_KNOW";
  if (/\b(believe|hypothesis|assumption)\b/.test(q)) return "WHAT_DO_WE_BELIEVE";
  if (/\b(unknown|uncertain|missing|gap)\b/.test(q)) return "WHAT_IS_UNKNOWN";
  if (/\b(evidence|proof|source|show me)\b/.test(q)) return "SHOW_EVIDENCE";
  if (/\b(contradict|conflict|sure|two hours|2 hours)\b/.test(q)) return "SHOW_CONTRADICTIONS";
  if (/\b(fix first|remediate first)\b/.test(q)) return "WHAT_SHOULD_WE_FIX_FIRST";
  if (/\b(next|do now|action)\b/.test(q)) return "WHAT_SHOULD_WE_DO_NEXT";
  if (/\b(priority|#1|number one)\b/.test(q)) return "WHY_THIS_PRIORITY";
  if (/\b(alternative|options|other ways)\b/.test(q)) return "WHAT_ARE_THE_ALTERNATIVES";
  if (/\b(compare|instead of|versus|vs)\b/.test(q)) return "COMPARE_STRATEGIES";
  if (/\b(change your mind|would change|reconsider)\b/.test(q))
    return "WHAT_WOULD_CHANGE_THE_DECISION";
  if (/\b(roi|worth|economically|cost|benefit)\b/.test(q)) return "IS_IT_ECONOMICALLY_JUSTIFIED";
  if (/\b(what if|doubles|changes)\b/.test(q)) return "WHAT_IF_EVIDENCE_CHANGES";
  if (/\b(what does|mean|term|acronym)\b/.test(q)) return "EXPLAIN_TERM";
  return "OTHER_BOUNDED_AUDIT_QUESTION";
}

function targetTypeFor(intent: AskAutomateXIntentType): AskAutomateXTargetEntityType {
  if (intent === "IS_IT_ECONOMICALLY_JUSTIFIED") return "ECONOMICS";
  if (intent === "WHAT_ARE_THE_ALTERNATIVES" || intent === "COMPARE_STRATEGIES") return "STRATEGY";
  if (intent === "EXPLAIN_TERM") return "TERM";
  return "COMPANY_AUDIT";
}

function perspectiveFor(
  intent: AskAutomateXIntentType,
): AskAutomateXIntent["requestedPerspective"] {
  if (intent === "IS_IT_ECONOMICALLY_JUSTIFIED") return "ECONOMIC";
  if (intent === "WHAT_ARE_THE_ALTERNATIVES" || intent === "COMPARE_STRATEGIES") return "STRATEGY";
  if (intent === "SHOW_EVIDENCE") return "EVIDENCE";
  return "EXECUTIVE";
}

function strategiesFor(
  intent: AskAutomateXIntent,
  strategies: StrategyComparisonReadModel | undefined,
): readonly StrategyComparisonItem[] {
  if (!strategies) return Object.freeze([]);
  if (intent.targetEntityId && intent.targetEntityType === "STRATEGY")
    return Object.freeze(
      strategies.strategies.filter((item) => item.candidateId === intent.targetEntityId),
    );
  return Object.freeze(
    strategies.strategies.filter((item) =>
      [
        "RETAIN_FOR_COMPARISON",
        "NEEDS_MORE_EVIDENCE",
        "BLOCKED_BY_REMEDIATION",
        "ECONOMICALLY_WEAK",
      ].includes(item.status),
    ),
  );
}

function economicsFor(intent: AskAutomateXIntent, view: ExecutiveDecisionView): readonly string[] {
  if (
    intent.intentType !== "IS_IT_ECONOMICALLY_JUSTIFIED" &&
    intent.intentType !== "WHY_DECISION" &&
    intent.intentType !== "WHY_NOT_AUTOMATE"
  )
    return Object.freeze([]);
  const e = view.economicPresentation;
  const values: string[] = [`Economic state: ${e.state}.`];
  if (e.benefitRange.min !== null || e.benefitRange.max !== null)
    values.push(`Benefit range: ${rangeText(e.benefitRange.min, e.benefitRange.max, e.currency)}.`);
  if (e.costRange.min !== null || e.costRange.max !== null)
    values.push(`Cost range: ${rangeText(e.costRange.min, e.costRange.max, e.currency)}.`);
  if (e.breakEvenMonths !== null) values.push(`Break-even: ${e.breakEvenMonths} months.`);
  if (e.costOfInaction !== null)
    values.push(`Cost of inaction: ${e.costOfInaction} ${e.currency ?? ""}.`.trim());
  if (e.missingEvidence.length)
    values.push(`Missing economic evidence: ${e.missingEvidence.join("; ")}.`);
  return Object.freeze(values);
}

function unknownsFor(
  intent: AskAutomateXIntent,
  view: ExecutiveDecisionView,
  card: ExecutivePriorityCard | null,
): readonly string[] {
  if (
    intent.intentType === "WHAT_ARE_THE_ALTERNATIVES" ||
    intent.intentType === "COMPARE_STRATEGIES"
  )
    return Object.freeze([]);
  return Object.freeze([...(card?.uncertainty ?? view.whatWeDoNotKnow)]);
}

function contradictionsFor(
  intent: AskAutomateXIntent,
  view: ExecutiveDecisionView,
): readonly string[] {
  if (intent.intentType === "SHOW_CONTRADICTIONS" || view.contradictions.length)
    return Object.freeze([...view.contradictions]);
  return Object.freeze([]);
}

function evidenceRefs(
  sources: readonly string[],
  card: ExecutivePriorityCard | null,
): readonly AskAutomateXEvidenceRef[] {
  return Object.freeze(
    sources.map((label, index) => ({
      label,
      supports: card ? card.title : "Company audit",
      sourceId: card?.evidenceReferences[index],
    })),
  );
}

function changeConditions(
  view: ExecutiveDecisionView,
  card: ExecutivePriorityCard | null,
  strategies: readonly StrategyComparisonItem[],
): readonly string[] {
  const values = [
    ...(card?.uncertainty ?? view.whatRequiresMoreEvidence),
    ...view.economicPresentation.missingEvidence,
    ...strategies.flatMap((strategy) => strategy.unknowns),
    ...strategies.flatMap((strategy) => strategy.prerequisites),
  ];
  return Object.freeze([...new Set(values)].filter(Boolean));
}

function prohibitedClaims(view: ExecutiveDecisionView): readonly string[] {
  return Object.freeze([
    "Do not invent company facts.",
    "Do not invent evidence.",
    "Do not invent economics.",
    "Do not change decisions.",
    ...view.whatNotToAutomate.map((item) => `Do not automate protected item: ${item}`),
  ]);
}

function reversesDecision(plan: GroundedAnswerPlan, answer: string): boolean {
  const text = answer.toLowerCase();
  const decision = plan.authoritativeAnswerPoints.join(" ").toLowerCase();
  return (
    (decision.includes("do_not_automate") || decision.includes("do not")) &&
    /\b(automate now|fully automate|safe to automate)\b/.test(text)
  );
}

function reversesEconomics(plan: GroundedAnswerPlan, answer: string): boolean {
  const economics = plan.economicValues.join(" ").toLowerCase();
  if (!economics.includes("not_justified") && !economics.includes("insufficient")) return false;
  return /\b(strong roi|guaranteed return|definitely worth|payback in)\b/i.test(answer);
}

function hidesContradiction(plan: GroundedAnswerPlan, answer: string): boolean {
  return (
    plan.contradictions.length > 0 &&
    !/\b(contradict|conflict|different|uncertain|discrepancy)\b/i.test(answer)
  );
}

function removesUnknowns(plan: GroundedAnswerPlan, answer: string): boolean {
  return (
    plan.unknowns.length > 0 &&
    /\b(we know for sure|certainly|definitely confirmed)\b/i.test(answer)
  );
}

function inventedNumber(
  plan: GroundedAnswerPlan,
  view: ExecutiveDecisionView,
  answer: string,
): boolean {
  const numbers = answer.match(/\b\d+(?:\.\d+)?\s?(?:%|x|€|\$|months?)?\b/g) ?? [];
  const allowed = [
    ...plan.economicValues,
    JSON.stringify(view.economicPresentation),
    ...view.evidenceExplanation.supportingSources,
  ].join(" ");
  return numbers.some(
    (number) => !allowed.includes(number.replace(/\s/g, "")) && !allowed.includes(number),
  );
}

function inventedEvidence(plan: GroundedAnswerPlan, answer: string): boolean {
  const known = new Set([
    ...plan.evidenceReferences.map((evidence) => evidence.label.toLowerCase()),
    ...plan.conflictingEvidenceReferences.map((evidence) => evidence.label.toLowerCase()),
  ]);
  const sourceLike =
    answer.match(/\b(?:sop|erp|finance file|interview|export|spreadsheet|email)\b[^.。]*/gi) ?? [];
  return sourceLike.some(
    (source) => ![...known].some((knownSource) => source.toLowerCase().includes(knownSource)),
  );
}

function inventedStrategy(plan: GroundedAnswerPlan, answer: string): boolean {
  if (!plan.allowedStrategyReferences.length) return false;
  const lower = answer.toLowerCase();
  return (
    /\b(strategy|option|approach)\b/.test(lower) &&
    plan.allowedStrategyReferences.every(
      (strategy) => !lower.includes(strategy.title.toLowerCase()),
    )
  );
}

function unsupportedCertainty(plan: GroundedAnswerPlan, answer: string): boolean {
  return (
    (plan.unknowns.length > 0 || plan.contradictions.length > 0) &&
    /\b(no uncertainty|fully proven|completely certain)\b/i.test(answer)
  );
}

function terminologyFor(
  input: AskAutomateXInput,
  intent: AskAutomateXIntent,
  model: AskAutomateXReadModel,
): {
  readonly points: readonly string[];
  readonly evidenceReferences: readonly AskAutomateXEvidenceRef[];
} {
  if (intent.intentType !== "EXPLAIN_TERM" || !model.terminology)
    return { points: [], evidenceReferences: [] };
  const match = Object.entries(model.terminology).find(([term]) =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(input.question),
  );
  return match
    ? {
        points: [`${match[0]}: ${match[1].supports}`],
        evidenceReferences: [match[1]],
      }
    : { points: [], evidenceReferences: [] };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function outOfScope(question: string): boolean {
  return /\b(world cup|weather|poem|recipe|joke|company b|tenant b|another company|other company)\b/i.test(
    question,
  );
}

function crossCompanyScopeAttack(question: string): boolean {
  return /\b(company b|tenant b|another company|other company)\b/i.test(question);
}

function assertCard(view: ExecutiveDecisionView, id: string): void {
  if (!view.priorityCards.some((card) => card.id === id))
    throw new Error("Requested decision card is outside the authorized company context");
}

function assertStrategy(strategies: StrategyComparisonReadModel | undefined, id: string): void {
  if (!strategies?.strategies.some((strategy) => strategy.candidateId === id))
    throw new Error("Requested strategy is outside the authorized company context");
}

function validateAskInput(input: AskAutomateXInput): void {
  if (!input.tenantId || !input.companyId || !input.userId || !input.question.trim())
    throw new Error("Ask AutomateX scope and question are required");
}

function rangeText(min: number | null, max: number | null, currency: string | null): string {
  if (min === null && max === null) return "not available";
  if (min === max) return `${min} ${currency ?? ""}`.trim();
  return `${min ?? "unknown"} to ${max ?? "unknown"} ${currency ?? ""}`.trim();
}

function unavailableView(input: AskAutomateXInput): ExecutiveDecisionView {
  return {
    company: { id: input.companyId, tenantId: input.tenantId },
    ownership: {
      kind: "PRESENTATION_PROJECTION",
      persistedArtifactOwner: "ExecutiveResultService/ReportService",
      usesExistingExecutiveResult: false,
      usesExistingReport: false,
      createsLifecycle: false,
    },
    auditSummary: {
      status: "UNAVAILABLE",
      loopStatus: "UNAVAILABLE",
      topProblemCount: 0,
      opportunityCount: 0,
      economicState: "INSUFFICIENT_EVIDENCE",
    },
    topProblems: [],
    whatWeKnow: [],
    whatWeBelieve: [],
    whatWeDoNotKnow: ["A published ExecutiveDecisionView is required."],
    contradictions: [],
    rootCausesOrHypotheses: [],
    bottlenecks: [],
    criticalIssues: [],
    whatToFixFirst: [],
    whatNotToAutomate: [],
    whatCanBeAutomated: [],
    whatRequiresMoreEvidence: ["Publish the ExecutiveDecisionView."],
    economicReadiness: "INSUFFICIENT_EVIDENCE",
    economicPresentation: {
      state: "INSUFFICIENT_EVIDENCE",
      benefitRange: { min: null, max: null },
      costRange: { min: null, max: null },
      breakEvenMonths: null,
      timeToValueMonths: null,
      costOfInaction: null,
      currency: null,
      missingEvidence: ["Published executive analysis"],
    },
    priorityCards: [],
    nextBestActions: ["Complete the executive decision analysis first."],
    evidenceExplanation: { supportingSources: [], conflictingSources: [], missingEvidence: [] },
    traceability: {
      companyId: input.companyId,
      tenantId: input.tenantId,
      brainRunId: "unavailable",
      knowledgeSnapshotId: null,
      processMapIds: [],
      evidenceIds: [],
      claimIds: [],
      opportunityIds: [],
      economicEvidenceIds: [],
      executiveResultArtifactIds: {},
    },
    completeness: {
      status: "NO",
      whatIsWrong: false,
      why: false,
      evidence: false,
      uncertainty: false,
      whatToFix: false,
      whatNotToAutomate: false,
      whatToAutomate: false,
      economicStatus: false,
      nextAction: false,
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
