import type { ExecutiveAuditResult } from "../../executive-results/application/executive-result-model";
import type { AuditReport } from "../../reports/domain/audit-report";
import type { RealCompanyAuditPilotResult } from "./real-company-audit-pilot";

export type ExecutiveDecisionState =
  | "AUTOMATE_NOW"
  | "AUTOMATE_CONDITIONALLY"
  | "FIX_BEFORE_AUTOMATING"
  | "INVESTIGATE_FIRST"
  | "DO_NOT_AUTOMATE"
  | "NOT_ECONOMICALLY_JUSTIFIED"
  | "NEEDS_MORE_EVIDENCE"
  | "HUMAN_DECISION_REQUIRED";

export type ExecutiveEvidenceStrength = "STRONG" | "MODERATE" | "LIMITED" | "INSUFFICIENT";

export type ExecutiveEconomicState =
  | "ECONOMICALLY_JUSTIFIED"
  | "POTENTIALLY_JUSTIFIED"
  | "NOT_JUSTIFIED"
  | "INSUFFICIENT_EVIDENCE"
  | "CURRENCY_NORMALIZATION_REQUIRED";

export interface ExecutiveEvidenceExplanation {
  readonly supportingSources: readonly string[];
  readonly conflictingSources: readonly string[];
  readonly missingEvidence: readonly string[];
}

export interface ExecutiveTraceability {
  readonly companyId: string;
  readonly tenantId: string;
  readonly brainRunId: string;
  readonly knowledgeSnapshotId: string | null;
  readonly processMapIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly opportunityIds: readonly string[];
  readonly economicEvidenceIds: readonly string[];
  readonly executiveResultArtifactIds: Readonly<{
    readonly processMapId?: string;
    readonly analysisId?: string;
    readonly automationOpportunitySnapshotId?: string;
    readonly roiId?: string;
    readonly recommendationPortfolioId?: string;
  }>;
}

export interface ExecutivePriorityCard {
  readonly id: string;
  readonly title: string;
  readonly executiveSummary: string;
  readonly priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  readonly businessImpact: string;
  readonly evidenceStrength: ExecutiveEvidenceStrength;
  readonly uncertainty: readonly string[];
  readonly problem: string;
  readonly probableCause: string;
  readonly recommendationState: ExecutiveDecisionState;
  readonly economicState: ExecutiveEconomicState;
  readonly whyItMatters: string;
  readonly whatToDoNow: string;
  readonly whatNotToDo: string | null;
  readonly nextBestAction: string;
  readonly evidenceReferences: readonly string[];
  readonly explanation: ExecutiveEvidenceExplanation;
  readonly traceability: ExecutiveTraceability;
}

export interface ExecutiveCompletenessCheck {
  readonly status: "YES" | "NO";
  readonly whatIsWrong: boolean;
  readonly why: boolean;
  readonly evidence: boolean;
  readonly uncertainty: boolean;
  readonly whatToFix: boolean;
  readonly whatNotToAutomate: boolean;
  readonly whatToAutomate: boolean;
  readonly economicStatus: boolean;
  readonly nextAction: boolean;
}

export interface ExecutiveDecisionViewOwnership {
  readonly kind: "PRESENTATION_PROJECTION";
  readonly persistedArtifactOwner: "ExecutiveResultService/ReportService";
  readonly usesExistingExecutiveResult: boolean;
  readonly usesExistingReport: boolean;
  readonly createsLifecycle: false;
}

export interface ExecutiveDecisionView {
  readonly company: { readonly id: string; readonly tenantId: string; readonly name?: string };
  readonly ownership: ExecutiveDecisionViewOwnership;
  readonly auditSummary: {
    readonly status: string;
    readonly loopStatus: string;
    readonly topProblemCount: number;
    readonly opportunityCount: number;
    readonly economicState: ExecutiveEconomicState;
  };
  readonly topProblems: readonly string[];
  readonly whatWeKnow: readonly string[];
  readonly whatWeBelieve: readonly string[];
  readonly whatWeDoNotKnow: readonly string[];
  readonly contradictions: readonly string[];
  readonly rootCausesOrHypotheses: readonly string[];
  readonly bottlenecks: readonly string[];
  readonly criticalIssues: readonly string[];
  readonly whatToFixFirst: readonly string[];
  readonly whatNotToAutomate: readonly string[];
  readonly whatCanBeAutomated: readonly string[];
  readonly whatRequiresMoreEvidence: readonly string[];
  readonly economicReadiness: ExecutiveEconomicState;
  readonly economicPresentation: {
    readonly state: ExecutiveEconomicState;
    readonly benefitRange: { readonly min: number | null; readonly max: number | null };
    readonly costRange: { readonly min: number | null; readonly max: number | null };
    readonly breakEvenMonths: number | null;
    readonly timeToValueMonths: number | null;
    readonly costOfInaction: number | null;
    readonly currency: string | null;
    readonly missingEvidence: readonly string[];
  };
  readonly priorityCards: readonly ExecutivePriorityCard[];
  readonly nextBestActions: readonly string[];
  readonly evidenceExplanation: ExecutiveEvidenceExplanation;
  readonly traceability: ExecutiveTraceability;
  readonly completeness: ExecutiveCompletenessCheck;
}

export interface ExecutiveDecisionViewInput {
  readonly pilot: RealCompanyAuditPilotResult;
  readonly executiveResult?: ExecutiveAuditResult | null;
  readonly report?: AuditReport | null;
}

export class ExecutiveDecisionViewBuilder {
  build(input: ExecutiveDecisionViewInput): ExecutiveDecisionView {
    const pilot = input.pilot;
    const result = pilot.finalBrainResult;
    const traceability = traceabilityFor(input);
    const economicState = economicStateFor(pilot.economic.state);
    const explanation = explanationFor(pilot);
    const cards = cardsFor(pilot, traceability, explanation, economicState);
    const view: ExecutiveDecisionView = {
      company: { id: result.companyId, tenantId: result.tenantId },
      ownership: Object.freeze({
        kind: "PRESENTATION_PROJECTION",
        persistedArtifactOwner: "ExecutiveResultService/ReportService",
        usesExistingExecutiveResult: Boolean(input.executiveResult),
        usesExistingReport: Boolean(input.report),
        createsLifecycle: false,
      }),
      auditSummary: Object.freeze({
        status: result.readiness.status,
        loopStatus: pilot.finalLoop.loop.stoppingState,
        topProblemCount: pilot.product.topProblems.length,
        opportunityCount: result.detectedOpportunities.length,
        economicState,
      }),
      topProblems: pilot.product.topProblems,
      whatWeKnow: pilot.product.whatWeKnow,
      whatWeBelieve: pilot.product.whatWeBelieve,
      whatWeDoNotKnow: pilot.product.whatWeDoNotKnow,
      contradictions: pilot.product.contradictions,
      rootCausesOrHypotheses: pilot.product.rootCausesHypotheses,
      bottlenecks: pilot.product.bottlenecks,
      criticalIssues: pilot.product.criticalIssues,
      whatToFixFirst: pilot.product.whatToFixFirst,
      whatNotToAutomate: pilot.product.whatNotToAutomate,
      whatCanBeAutomated: pilot.product.whatCanBeAutomated,
      whatRequiresMoreEvidence: pilot.product.whatNeedsMoreEvidence,
      economicReadiness: economicState,
      economicPresentation: economicPresentationFor(pilot, input.report),
      priorityCards: cards,
      nextBestActions: pilot.product.nextBestActions,
      evidenceExplanation: explanation,
      traceability,
      completeness: completenessFor(pilot, cards, economicState),
    };
    return deepFreeze(view);
  }
}

function cardsFor(
  pilot: RealCompanyAuditPilotResult,
  traceability: ExecutiveTraceability,
  explanation: ExecutiveEvidenceExplanation,
  economicState: ExecutiveEconomicState,
): readonly ExecutivePriorityCard[] {
  const result = pilot.finalBrainResult;
  const cards: ExecutivePriorityCard[] = [];
  for (const issue of result.criticalIssues) {
    cards.push(
      card({
        id: issue.issueId,
        title: issue.subject,
        problem: issue.reason,
        probableCause: rootCause(result),
        priority: issue.severity,
        state:
          issue.issueType === "MANDATORY_CONTROL_RISK"
            ? "HUMAN_DECISION_REQUIRED"
            : "FIX_BEFORE_AUTOMATING",
        economicState,
        whyItMatters: issue.downstreamImpact,
        whatToDoNow: issue.blockingDecision
          ? "Fix or clarify this issue before approving automation."
          : "Track this issue while evaluating the automation candidate.",
        whatNotToDo:
          issue.issueType === "MANDATORY_CONTROL_RISK"
            ? "Do not automate this control away."
            : "Do not proceed as if this issue were resolved.",
        nextBestAction: pilot.product.nextBestActions[0] ?? "Review the supporting evidence.",
        evidenceReferences: issue.evidence,
        uncertainty: pilot.product.whatWeDoNotKnow,
        explanation,
        traceability,
      }),
    );
  }
  for (const opportunity of result.detectedOpportunities) {
    const state = decisionStateFor(opportunity, economicState);
    cards.push(
      card({
        id: opportunity.opportunityId,
        title: opportunity.subject,
        problem: opportunity.problemStatement,
        probableCause: rootCause(result),
        priority: priorityFor(opportunity.status, opportunity.confidence),
        state,
        economicState,
        whyItMatters: businessImpactFor(opportunity, economicState),
        whatToDoNow: actionFor(state),
        whatNotToDo: notActionFor(state),
        nextBestAction: nextActionFor(state, pilot),
        evidenceReferences: opportunity.supportingEvidenceIds ?? [],
        uncertainty: uncertaintyFor(state, pilot),
        explanation,
        traceability,
      }),
    );
  }
  return Object.freeze(deduplicateCards(cards));
}

function card(input: {
  readonly id: string;
  readonly title: string;
  readonly problem: string;
  readonly probableCause: string;
  readonly priority: ExecutivePriorityCard["priority"];
  readonly state: ExecutiveDecisionState;
  readonly economicState: ExecutiveEconomicState;
  readonly whyItMatters: string;
  readonly whatToDoNow: string;
  readonly whatNotToDo: string | null;
  readonly nextBestAction: string;
  readonly evidenceReferences: readonly string[];
  readonly uncertainty: readonly string[];
  readonly explanation: ExecutiveEvidenceExplanation;
  readonly traceability: ExecutiveTraceability;
}): ExecutivePriorityCard {
  return Object.freeze({
    id: input.id,
    title: input.title,
    executiveSummary: `${input.problem} ${input.whatToDoNow}`.trim(),
    priority: input.priority,
    businessImpact: input.whyItMatters,
    evidenceStrength: evidenceStrength(
      input.evidenceReferences,
      input.explanation,
      input.uncertainty,
    ),
    uncertainty: Object.freeze([...input.uncertainty]),
    problem: input.problem,
    probableCause: input.probableCause,
    recommendationState: input.state,
    economicState: input.economicState,
    whyItMatters: input.whyItMatters,
    whatToDoNow: input.whatToDoNow,
    whatNotToDo: input.whatNotToDo,
    nextBestAction: input.nextBestAction,
    evidenceReferences: Object.freeze([...input.evidenceReferences]),
    explanation: input.explanation,
    traceability: input.traceability,
  });
}

function decisionStateFor(
  opportunity: RealCompanyAuditPilotResult["finalBrainResult"]["detectedOpportunities"][number],
  economics: ExecutiveEconomicState,
): ExecutiveDecisionState {
  if (opportunity.candidateType === "DO_NOT_AUTOMATE" || opportunity.status === "REJECTED")
    return "DO_NOT_AUTOMATE";
  if (opportunity.status === "REMEDIATION_REQUIRED") return "FIX_BEFORE_AUTOMATING";
  if (opportunity.status === "ECONOMICALLY_UNQUALIFIED" || economics === "NOT_JUSTIFIED")
    return "NOT_ECONOMICALLY_JUSTIFIED";
  if (opportunity.status === "DEFERRED" || opportunity.status === "UNDER_INVESTIGATION")
    return "INVESTIGATE_FIRST";
  if (economics === "INSUFFICIENT_EVIDENCE" || economics === "CURRENCY_NORMALIZATION_REQUIRED")
    return "NEEDS_MORE_EVIDENCE";
  if (opportunity.status === "CONDITIONALLY_QUALIFIED") return "AUTOMATE_CONDITIONALLY";
  if (opportunity.status === "QUALIFIED" || opportunity.status === "RECOMMENDED")
    return economics === "ECONOMICALLY_JUSTIFIED" ? "AUTOMATE_NOW" : "AUTOMATE_CONDITIONALLY";
  return "NEEDS_MORE_EVIDENCE";
}

function economicStateFor(state: string): ExecutiveEconomicState {
  if (state === "QUALIFIED") return "ECONOMICALLY_JUSTIFIED";
  if (state === "PARTIALLY_QUALIFIED") return "POTENTIALLY_JUSTIFIED";
  if (state === "ECONOMICALLY_UNQUALIFIED") return "NOT_JUSTIFIED";
  if (state === "CURRENCY_NORMALIZATION_REQUIRED") return "CURRENCY_NORMALIZATION_REQUIRED";
  return "INSUFFICIENT_EVIDENCE";
}

function economicPresentationFor(
  pilot: RealCompanyAuditPilotResult,
  report?: AuditReport | null,
): ExecutiveDecisionView["economicPresentation"] {
  const values = pilot.economic.values;
  const benefitRange = range(
    values.filter((value) => benefitConcepts.has(value.concept)).map((value) => value.value),
  );
  const costRange = range(
    values.filter((value) => costConcepts.has(value.concept)).map((value) => value.value),
  );
  return Object.freeze({
    state: economicStateFor(pilot.economic.state),
    benefitRange,
    costRange,
    breakEvenMonths: report?.roi.paybackMonths ?? null,
    timeToValueMonths: report?.roi.paybackMonths ?? null,
    costOfInaction: benefitRange.max,
    currency: pilot.economic.currencies[0] ?? report?.roi.currency ?? null,
    missingEvidence: pilot.economic.gaps,
  });
}

const benefitConcepts = new Set([
  "TRANSACTION_VOLUME",
  "TASK_FREQUENCY",
  "TASK_DURATION",
  "LABOR_COST",
  "EXPECTED_TIME_REDUCTION",
  "EXPECTED_AUTOMATION_COVERAGE",
  "EXPECTED_ADOPTION_RATE",
]);
const costConcepts = new Set([
  "IMPLEMENTATION_COST",
  "MAINTENANCE_COST",
  "TRAINING_COST",
  "INFRASTRUCTURE_COST",
  "SOFTWARE_COST",
]);

function range(values: readonly (number | null)[]): {
  readonly min: number | null;
  readonly max: number | null;
} {
  const numbers = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return Object.freeze({
    min: numbers.length ? Math.min(...numbers) : null,
    max: numbers.length ? Math.max(...numbers) : null,
  });
}

function explanationFor(pilot: RealCompanyAuditPilotResult): ExecutiveEvidenceExplanation {
  const result = pilot.finalBrainResult;
  const supporting = new Set<string>([
    ...(result.traceReferences.evidence ?? []),
    ...pilot.economic.values.map((value) => value.evidenceId),
  ]);
  const conflicting = new Set<string>(
    result.contradictions.flatMap((contradiction) => [
      ...contradiction.leftEvidenceIds,
      ...contradiction.rightEvidenceIds,
    ]),
  );
  return Object.freeze({
    supportingSources: Object.freeze([...supporting].sort()),
    conflictingSources: Object.freeze([...conflicting].sort()),
    missingEvidence: Object.freeze([...pilot.product.whatNeedsMoreEvidence]),
  });
}

function traceabilityFor(input: ExecutiveDecisionViewInput): ExecutiveTraceability {
  const result = input.pilot.finalBrainResult;
  return Object.freeze({
    companyId: result.companyId,
    tenantId: result.tenantId,
    brainRunId: result.brain.scenarioId,
    knowledgeSnapshotId: result.sourceSnapshot.knowledgeSnapshotId ?? null,
    processMapIds: Object.freeze([...(result.traceReferences.processMap ?? [])]),
    evidenceIds: Object.freeze([...(result.traceReferences.evidence ?? [])]),
    claimIds: Object.freeze([...(result.traceReferences.claims ?? [])]),
    opportunityIds: Object.freeze(result.detectedOpportunities.map((item) => item.opportunityId)),
    economicEvidenceIds: Object.freeze(
      input.pilot.economic.values.map((value) => value.evidenceId),
    ),
    executiveResultArtifactIds: Object.freeze({
      ...(input.executiveResult?.provenance ?? {}),
    }),
  });
}

function completenessFor(
  pilot: RealCompanyAuditPilotResult,
  cards: readonly ExecutivePriorityCard[],
  economicState: ExecutiveEconomicState,
): ExecutiveCompletenessCheck {
  const checks = {
    whatIsWrong: pilot.product.topProblems.length > 0,
    why: pilot.product.rootCausesHypotheses.length > 0 || cards.some((card) => card.probableCause),
    evidence: cards.every((card) => card.evidenceReferences.length > 0) && cards.length > 0,
    uncertainty:
      pilot.product.whatWeDoNotKnow.length > 0 || pilot.product.contradictions.length > 0,
    whatToFix: pilot.product.whatToFixFirst.length > 0,
    whatNotToAutomate: pilot.product.whatNotToAutomate.length > 0,
    whatToAutomate: pilot.product.whatCanBeAutomated.length > 0,
    economicStatus: Boolean(economicState),
    nextAction: pilot.product.nextBestActions.length > 0,
  };
  return Object.freeze({
    ...checks,
    status: Object.values(checks).every(Boolean) ? "YES" : "NO",
  });
}

function evidenceStrength(
  evidenceReferences: readonly string[],
  explanation: ExecutiveEvidenceExplanation,
  uncertainty: readonly string[],
): ExecutiveEvidenceStrength {
  if (!evidenceReferences.length) return "INSUFFICIENT";
  if (explanation.conflictingSources.length || uncertainty.length) return "MODERATE";
  if (evidenceReferences.length >= 3) return "STRONG";
  return "LIMITED";
}

function priorityFor(status: string, confidence: number): ExecutivePriorityCard["priority"] {
  if (status === "REMEDIATION_REQUIRED" || status === "REJECTED") return "HIGH";
  if (confidence >= 0.75) return "HIGH";
  if (confidence >= 0.5) return "MEDIUM";
  return "LOW";
}

function businessImpactFor(
  opportunity: RealCompanyAuditPilotResult["finalBrainResult"]["detectedOpportunities"][number],
  economics: ExecutiveEconomicState,
): string {
  if (opportunity.candidateType === "DO_NOT_AUTOMATE")
    return "This is a control decision, not an automation shortcut.";
  if (economics === "ECONOMICALLY_JUSTIFIED") return "Source-backed economics support action.";
  if (economics === "NOT_JUSTIFIED") return "The current economics do not justify automation.";
  return "More evidence is required before a confident economic decision.";
}

function actionFor(state: ExecutiveDecisionState): string {
  switch (state) {
    case "AUTOMATE_NOW":
      return "Approve a controlled automation design.";
    case "AUTOMATE_CONDITIONALLY":
      return "Proceed only after the listed conditions are addressed.";
    case "FIX_BEFORE_AUTOMATING":
      return "Fix the process or data prerequisite before automation.";
    case "INVESTIGATE_FIRST":
      return "Collect targeted evidence before deciding.";
    case "DO_NOT_AUTOMATE":
      return "Do not automate this item.";
    case "NOT_ECONOMICALLY_JUSTIFIED":
      return "Do not invest until economics change.";
    case "HUMAN_DECISION_REQUIRED":
      return "Keep the human decision/control in place.";
    case "NEEDS_MORE_EVIDENCE":
      return "Provide the missing evidence.";
  }
}

function notActionFor(state: ExecutiveDecisionState): string | null {
  if (state === "DO_NOT_AUTOMATE" || state === "HUMAN_DECISION_REQUIRED")
    return "Do not remove the required human control.";
  if (state === "FIX_BEFORE_AUTOMATING") return "Do not automate before remediation.";
  if (state === "NEEDS_MORE_EVIDENCE") return "Do not manufacture missing ROI or process facts.";
  if (state === "NOT_ECONOMICALLY_JUSTIFIED") return "Do not present this as a quick win.";
  return null;
}

function nextActionFor(state: ExecutiveDecisionState, pilot: RealCompanyAuditPilotResult): string {
  if (state === "NEEDS_MORE_EVIDENCE")
    return pilot.product.whatNeedsMoreEvidence[0] ?? "Provide evidence.";
  if (state === "FIX_BEFORE_AUTOMATING")
    return pilot.product.whatToFixFirst[0] ?? "Fix prerequisite.";
  return pilot.product.nextBestActions[0] ?? actionFor(state);
}

function uncertaintyFor(
  state: ExecutiveDecisionState,
  pilot: RealCompanyAuditPilotResult,
): readonly string[] {
  if (state === "AUTOMATE_NOW") return Object.freeze([]);
  return Object.freeze([...pilot.product.whatWeDoNotKnow, ...pilot.product.contradictions]);
}

function rootCause(result: RealCompanyAuditPilotResult["finalBrainResult"]): string {
  return result.rootCauseHypotheses[0]?.statement ?? "Cause still under investigation";
}

function deduplicateCards(
  cards: readonly ExecutivePriorityCard[],
): readonly ExecutivePriorityCard[] {
  const seen = new Set<string>();
  return Object.freeze(
    cards.filter((card) => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    }),
  );
}

function deepFreeze<T extends object>(value: T): T {
  for (const item of Object.values(value)) {
    if (item && typeof item === "object" && !Object.isFrozen(item)) deepFreeze(item);
  }
  return Object.freeze(value);
}
