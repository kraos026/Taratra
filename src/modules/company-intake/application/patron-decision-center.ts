import {
  ExecutiveExplanationService,
  type ExecutiveExplanation,
  type ExecutiveExplanationLanguage,
} from "./executive-explanation-service";
import type {
  ExecutiveDecisionState,
  ExecutiveDecisionView,
  ExecutiveEconomicState,
  ExecutivePriorityCard,
} from "./executive-decision-view";

export type PatronDecisionCenterStatus =
  "READY" | "ANALYSIS_INCOMPLETE" | "NEEDS_MORE_EVIDENCE" | "UNAVAILABLE";

export type PatronDecisionCenterActionCategory =
  | "PROVIDE_EVIDENCE"
  | "ASK_PERSON"
  | "UPLOAD_DOCUMENT"
  | "IMPORT_SYSTEM_DATA"
  | "FIX_DATA"
  | "STANDARDIZE_PROCESS"
  | "CLARIFY_CONTROL"
  | "APPROVE_AUTOMATION_DESIGN"
  | "DEFER"
  | "DO_NOTHING";

export interface PatronDecisionCenterOverview {
  readonly companyId: string;
  readonly companyName: string;
  readonly auditStatus: string;
  readonly analysisReadiness: PatronDecisionCenterStatus;
  readonly topProblemsCount: number;
  readonly automationReadyCount: number;
  readonly fixBeforeAutomationCount: number;
  readonly doNotAutomateCount: number;
  readonly needsMoreEvidenceCount: number;
  readonly economicReadiness: ExecutiveEconomicState | "NOT_YET_AVAILABLE";
  readonly topNextAction: string | null;
  readonly uncertaintyIndicator: "NONE_DECLARED" | "DECLARED" | "MATERIAL";
}

export interface PatronDecisionCard {
  readonly sourceCardId: string;
  readonly title: string;
  readonly decisionState: ExecutiveDecisionState;
  readonly priority: ExecutivePriorityCard["priority"];
  readonly businessImpact: string;
  readonly evidenceStrength: ExecutivePriorityCard["evidenceStrength"];
  readonly economicState: ExecutiveEconomicState;
  readonly executiveSummary: string;
  readonly whatToDoNow: string;
  readonly whatNotToDo: string | null;
  readonly probableCause: string;
  readonly uncertainty: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly explanation: ExecutiveExplanation | null;
}

export interface PatronDecisionCenterEconomics {
  readonly state: ExecutiveEconomicState | "NOT_YET_AVAILABLE";
  readonly benefitRange: readonly [number | null, number | null];
  readonly costRange: readonly [number | null, number | null];
  readonly breakEvenMonths: number | null;
  readonly timeToValueMonths: number | null;
  readonly costOfInaction: number | null;
  readonly currency: string | null;
  readonly missingEvidence: readonly string[];
}

export interface PatronDecisionCenterNextAction {
  readonly label: string;
  readonly category: PatronDecisionCenterActionCategory;
}

export interface PatronDecisionCenterKnowledge {
  readonly whatWeKnow: readonly string[];
  readonly whatWeBelieve: readonly string[];
  readonly whatWeDoNotKnow: readonly string[];
}

export interface PatronDecisionCenterEvidence {
  readonly supportingSources: readonly string[];
  readonly conflictingSources: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly contradictions: readonly string[];
}

export interface PatronDecisionCenter {
  readonly status: PatronDecisionCenterStatus;
  readonly source: "EXECUTIVE_DECISION_VIEW" | "UNAVAILABLE";
  readonly overview: PatronDecisionCenterOverview;
  readonly executiveSummary: string;
  readonly topProblems: readonly string[];
  readonly rootCausesOrHypotheses: readonly string[];
  readonly bottlenecks: readonly string[];
  readonly criticalIssues: readonly string[];
  readonly priorityCards: readonly PatronDecisionCard[];
  readonly fixBeforeAutomating: readonly PatronDecisionCard[];
  readonly automationOpportunities: readonly PatronDecisionCard[];
  readonly doNotAutomate: readonly PatronDecisionCard[];
  readonly economics: PatronDecisionCenterEconomics;
  readonly evidence: PatronDecisionCenterEvidence;
  readonly knowledge: PatronDecisionCenterKnowledge;
  readonly nextActions: readonly PatronDecisionCenterNextAction[];
  readonly completeness: ExecutiveDecisionView["completeness"] | null;
  readonly sourceView: ExecutiveDecisionView | null;
}

export interface PatronDecisionCenterReadModelPort {
  read(input: {
    readonly userId: string;
    readonly companyId: string;
  }): Promise<ExecutiveDecisionView | null>;
}

export interface PatronDecisionCenterServiceInput {
  readonly userId: string;
  readonly companyId: string;
  readonly language?: ExecutiveExplanationLanguage;
}

export class PatronDecisionCenterService {
  constructor(
    private readonly readModel: PatronDecisionCenterReadModelPort,
    private readonly explanations = new ExecutiveExplanationService(),
  ) {}

  async get(input: PatronDecisionCenterServiceInput): Promise<PatronDecisionCenter> {
    const view = await this.readModel.read({
      userId: input.userId,
      companyId: input.companyId,
    });
    if (!view) return unavailablePatronDecisionCenter(input.companyId);
    if (view.company.id !== input.companyId)
      throw new Error("Executive decision view does not belong to requested company");
    const explanations = await explanationsFor(view, this.explanations, input.language);
    return PatronDecisionCenterPresenter.build(view, explanations);
  }
}

export class PatronDecisionCenterPresenter {
  static build(
    view: ExecutiveDecisionView,
    explanations: ReadonlyMap<string, ExecutiveExplanation> = new Map(),
  ): PatronDecisionCenter {
    const cards = view.priorityCards.map((card) => cardFor(card, explanations.get(card.id)));
    const center: PatronDecisionCenter = {
      status: statusFor(view),
      source: "EXECUTIVE_DECISION_VIEW",
      overview: overviewFor(view),
      executiveSummary: summaryFor(view, explanations),
      topProblems: freeze(view.topProblems),
      rootCausesOrHypotheses: freeze(view.rootCausesOrHypotheses),
      bottlenecks: freeze(view.bottlenecks),
      criticalIssues: freeze(view.criticalIssues),
      priorityCards: freeze(cards),
      fixBeforeAutomating: freeze(
        cards.filter((card) => card.decisionState === "FIX_BEFORE_AUTOMATING"),
      ),
      automationOpportunities: freeze(
        cards.filter(
          (card) =>
            card.decisionState === "AUTOMATE_NOW" ||
            card.decisionState === "AUTOMATE_CONDITIONALLY",
        ),
      ),
      doNotAutomate: freeze(
        cards.filter(
          (card) =>
            card.decisionState === "DO_NOT_AUTOMATE" ||
            card.decisionState === "HUMAN_DECISION_REQUIRED",
        ),
      ),
      economics: economicsFor(view),
      evidence: Object.freeze({
        supportingSources: freeze(view.evidenceExplanation.supportingSources),
        conflictingSources: freeze(view.evidenceExplanation.conflictingSources),
        missingEvidence: freeze(view.evidenceExplanation.missingEvidence),
        contradictions: freeze(view.contradictions),
      }),
      knowledge: Object.freeze({
        whatWeKnow: freeze(view.whatWeKnow),
        whatWeBelieve: freeze(view.whatWeBelieve),
        whatWeDoNotKnow: freeze(view.whatWeDoNotKnow),
      }),
      nextActions: freeze(view.nextBestActions.map(nextActionFor)),
      completeness: view.completeness,
      sourceView: view,
    };
    return deepFreeze(center);
  }
}

export function unavailablePatronDecisionCenter(
  companyId: string,
  companyName = "This company",
): PatronDecisionCenter {
  return deepFreeze({
    status: "UNAVAILABLE",
    source: "UNAVAILABLE",
    overview: {
      companyId,
      companyName,
      auditStatus: "Decision center not published",
      analysisReadiness: "UNAVAILABLE",
      topProblemsCount: 0,
      automationReadyCount: 0,
      fixBeforeAutomationCount: 0,
      doNotAutomateCount: 0,
      needsMoreEvidenceCount: 0,
      economicReadiness: "NOT_YET_AVAILABLE",
      topNextAction: "Complete the executive decision analysis first.",
      uncertaintyIndicator: "DECLARED",
    },
    executiveSummary:
      "The patron decision center is not available yet for this company. AutomateX will not invent executive decisions without a published ExecutiveDecisionView.",
    topProblems: [],
    rootCausesOrHypotheses: [],
    bottlenecks: [],
    criticalIssues: [],
    priorityCards: [],
    fixBeforeAutomating: [],
    automationOpportunities: [],
    doNotAutomate: [],
    economics: {
      state: "NOT_YET_AVAILABLE",
      benefitRange: [null, null],
      costRange: [null, null],
      breakEvenMonths: null,
      timeToValueMonths: null,
      costOfInaction: null,
      currency: null,
      missingEvidence: ["A published ExecutiveDecisionView is required."],
    },
    evidence: {
      supportingSources: [],
      conflictingSources: [],
      missingEvidence: ["A published ExecutiveDecisionView is required."],
      contradictions: [],
    },
    knowledge: {
      whatWeKnow: [],
      whatWeBelieve: [],
      whatWeDoNotKnow: ["The executive decision model has not been published for this company."],
    },
    nextActions: [
      {
        label: "Complete the executive decision analysis first.",
        category: "PROVIDE_EVIDENCE",
      },
    ],
    completeness: null,
    sourceView: null,
  });
}

async function explanationsFor(
  view: ExecutiveDecisionView,
  service: ExecutiveExplanationService,
  language: ExecutiveExplanationLanguage | undefined,
): Promise<ReadonlyMap<string, ExecutiveExplanation>> {
  const entries = await Promise.all(
    view.priorityCards.map(async (card) => {
      try {
        return [
          card.id,
          await service.explain({
            view,
            cardId: card.id,
            language,
          }),
        ] as const;
      } catch {
        return [card.id, null] as const;
      }
    }),
  );
  return new Map(
    entries.filter((entry): entry is readonly [string, ExecutiveExplanation] => !!entry[1]),
  );
}

function overviewFor(view: ExecutiveDecisionView): PatronDecisionCenterOverview {
  return Object.freeze({
    companyId: view.company.id,
    companyName: view.company.name ?? view.company.id,
    auditStatus: view.auditSummary.status,
    analysisReadiness: statusFor(view),
    topProblemsCount: view.auditSummary.topProblemCount,
    automationReadyCount: countStates(view, ["AUTOMATE_NOW", "AUTOMATE_CONDITIONALLY"]),
    fixBeforeAutomationCount: countStates(view, ["FIX_BEFORE_AUTOMATING"]),
    doNotAutomateCount: countStates(view, ["DO_NOT_AUTOMATE", "HUMAN_DECISION_REQUIRED"]),
    needsMoreEvidenceCount: countStates(view, ["NEEDS_MORE_EVIDENCE", "INVESTIGATE_FIRST"]),
    economicReadiness: view.economicReadiness,
    topNextAction: view.nextBestActions[0] ?? null,
    uncertaintyIndicator: uncertaintyIndicatorFor(view),
  });
}

function statusFor(view: ExecutiveDecisionView): PatronDecisionCenterStatus {
  if (
    view.priorityCards.some((card) => card.recommendationState === "NEEDS_MORE_EVIDENCE") ||
    view.economicReadiness === "INSUFFICIENT_EVIDENCE" ||
    view.completeness.status === "NO"
  )
    return "NEEDS_MORE_EVIDENCE";
  if (!view.priorityCards.length) return "ANALYSIS_INCOMPLETE";
  return "READY";
}

function cardFor(
  card: ExecutivePriorityCard,
  explanation: ExecutiveExplanation | undefined,
): PatronDecisionCard {
  return Object.freeze({
    sourceCardId: card.id,
    title: card.title,
    decisionState: card.recommendationState,
    priority: card.priority,
    businessImpact: card.businessImpact,
    evidenceStrength: card.evidenceStrength,
    economicState: card.economicState,
    executiveSummary: explanation?.content.executiveSummary ?? card.executiveSummary,
    whatToDoNow: explanation?.content.recommendedNextStep ?? card.whatToDoNow,
    whatNotToDo: explanation?.content.whatNotToDo ?? card.whatNotToDo,
    probableCause: card.probableCause,
    uncertainty: freeze(card.uncertainty),
    evidenceReferences: freeze(card.evidenceReferences),
    explanation: explanation ?? null,
  });
}

function economicsFor(view: ExecutiveDecisionView): PatronDecisionCenterEconomics {
  const economics = view.economicPresentation;
  return Object.freeze({
    state: economics.state,
    benefitRange: Object.freeze([economics.benefitRange.min, economics.benefitRange.max] satisfies [
      number | null,
      number | null,
    ]),
    costRange: Object.freeze([economics.costRange.min, economics.costRange.max] satisfies [
      number | null,
      number | null,
    ]),
    breakEvenMonths: economics.breakEvenMonths,
    timeToValueMonths: economics.timeToValueMonths,
    costOfInaction: economics.costOfInaction,
    currency: economics.currency,
    missingEvidence: freeze(economics.missingEvidence),
  });
}

function summaryFor(
  view: ExecutiveDecisionView,
  explanations: ReadonlyMap<string, ExecutiveExplanation>,
): string {
  const first = view.priorityCards[0];
  const explanation = first ? explanations.get(first.id) : null;
  if (explanation) return explanation.content.executiveSummary;
  if (first) return first.executiveSummary;
  return "The analysis is incomplete. AutomateX needs more evidence before presenting an executive decision.";
}

function nextActionFor(label: string): PatronDecisionCenterNextAction {
  return Object.freeze({
    label,
    category: actionCategoryFor(label),
  });
}

function actionCategoryFor(label: string): PatronDecisionCenterActionCategory {
  const normalized = label.toLowerCase();
  if (/\bupload|document|sop|policy|file\b/.test(normalized)) return "UPLOAD_DOCUMENT";
  if (/\bimport|erp|system|export|data\b/.test(normalized)) return "IMPORT_SYSTEM_DATA";
  if (/\bfix|clean|stale|master data|quality\b/.test(normalized)) return "FIX_DATA";
  if (/\bstandardize|process\b/.test(normalized)) return "STANDARDIZE_PROCESS";
  if (/\bcontrol|approval|threshold|clarify\b/.test(normalized)) return "CLARIFY_CONTROL";
  if (/\bapprove|design\b/.test(normalized)) return "APPROVE_AUTOMATION_DESIGN";
  if (/\bask|interview|person|manager|owner\b/.test(normalized)) return "ASK_PERSON";
  if (/\bdefer|wait\b/.test(normalized)) return "DEFER";
  if (/\bnothing|no action\b/.test(normalized)) return "DO_NOTHING";
  return "PROVIDE_EVIDENCE";
}

function countStates(
  view: ExecutiveDecisionView,
  states: readonly ExecutiveDecisionState[],
): number {
  return view.priorityCards.filter((card) => states.includes(card.recommendationState)).length;
}

function uncertaintyIndicatorFor(
  view: ExecutiveDecisionView,
): PatronDecisionCenterOverview["uncertaintyIndicator"] {
  if (view.contradictions.length) return "MATERIAL";
  if (view.whatWeDoNotKnow.length || view.whatRequiresMoreEvidence.length) return "DECLARED";
  return "NONE_DECLARED";
}

function freeze<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function deepFreeze<T extends object>(value: T): T {
  for (const item of Object.values(value)) {
    if (item && typeof item === "object" && !Object.isFrozen(item)) deepFreeze(item);
  }
  return Object.freeze(value);
}
