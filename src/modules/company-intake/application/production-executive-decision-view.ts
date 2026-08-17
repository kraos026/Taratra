import type { ExecutiveAuditResult } from "../../executive-results/application/executive-result-model";
import type {
  ExecutiveCompletenessCheck,
  ExecutiveDecisionState,
  ExecutiveDecisionView,
  ExecutiveEconomicState,
  ExecutiveEvidenceExplanation,
  ExecutiveEvidenceStrength,
  ExecutivePriorityCard,
  ExecutiveTraceability,
} from "./executive-decision-view";

export type ProductionExecutiveDecisionViewUnavailableReason =
  | "AUDIT_NOT_READY"
  | "EXECUTIVE_RESULT_NOT_PUBLISHED"
  | "MISSING_CANONICAL_ARTIFACT"
  | "DRAFT_PROCESS_MAP";

export interface ProductionExecutiveDecisionViewBuildInput {
  readonly tenantId: string;
  readonly result: ExecutiveAuditResult;
}

export interface ProductionExecutiveDecisionViewBuildResult {
  readonly view: ExecutiveDecisionView | null;
  readonly unavailableReason: ProductionExecutiveDecisionViewUnavailableReason | null;
}

/**
 * Presentation projection from the authoritative published production audit.
 *
 * This does not publish, mutate or create a second decision lifecycle. It only
 * reconstructs the patron-facing view from the current ExecutiveResultService
 * read model.
 */
export class ProductionExecutiveDecisionViewBuilder {
  build(
    input: ProductionExecutiveDecisionViewBuildInput,
  ): ProductionExecutiveDecisionViewBuildResult {
    const reason = unavailableReasonFor(input.result);
    if (reason) return deepFreeze({ view: null, unavailableReason: reason });

    const result = input.result;
    const traceability = traceabilityFor(input);
    const economicState = economicStateFor(result);
    const explanation = evidenceExplanationFor(result);
    const cards = cardsFor(result, traceability, explanation, economicState);
    const nextBestActions = nextActionsFor(result, cards);
    const view: ExecutiveDecisionView = {
      company: { id: result.company.id, tenantId: input.tenantId, name: result.company.name },
      ownership: {
        kind: "PRESENTATION_PROJECTION",
        persistedArtifactOwner: "ExecutiveResultService/ReportService",
        usesExistingExecutiveResult: true,
        usesExistingReport: false,
        createsLifecycle: false,
      },
      auditSummary: {
        status: "READY",
        loopStatus: "PUBLISHED_AUDIT",
        topProblemCount: result.findings.length,
        opportunityCount: result.opportunities.length,
        economicState,
      },
      topProblems: freeze(result.findings.map((item) => item.title)),
      whatWeKnow: freeze(whatWeKnowFor(result)),
      whatWeBelieve: freeze(whatWeBelieveFor(result)),
      whatWeDoNotKnow: freeze(unknownsFor(result)),
      contradictions: freeze([]),
      rootCausesOrHypotheses: freeze(rootCausesFor(result)),
      bottlenecks: freeze(bottlenecksFor(result)),
      criticalIssues: freeze(criticalIssuesFor(result)),
      whatToFixFirst: freeze(whatToFixFirstFor(result)),
      whatNotToAutomate: freeze(whatNotToAutomateFor(result)),
      whatCanBeAutomated: freeze(whatCanBeAutomatedFor(result)),
      whatRequiresMoreEvidence: freeze(unknownsFor(result)),
      economicReadiness: economicState,
      economicPresentation: economicPresentationFor(result, economicState),
      priorityCards: freeze(cards),
      nextBestActions,
      evidenceExplanation: explanation,
      traceability,
      completeness: completenessFor(result, cards, economicState, nextBestActions),
    };
    return deepFreeze({ view, unavailableReason: null });
  }
}

function unavailableReasonFor(
  result: ExecutiveAuditResult,
): ProductionExecutiveDecisionViewUnavailableReason | null {
  if (!result.complete || result.audit.currentStage !== "COMPLETED")
    return "EXECUTIVE_RESULT_NOT_PUBLISHED";
  if (!result.provenance || !result.process || !result.roi) return "MISSING_CANONICAL_ARTIFACT";
  const processStage = result.audit.stages.find((stage) => stage.stage === "PROCESS_MAP");
  if (processStage?.artifact?.status !== "published") return "DRAFT_PROCESS_MAP";
  return null;
}

function cardsFor(
  result: ExecutiveAuditResult,
  traceability: ExecutiveTraceability,
  explanation: ExecutiveEvidenceExplanation,
  economicState: ExecutiveEconomicState,
): readonly ExecutivePriorityCard[] {
  return freeze(
    dedupeCards([
      ...result.findings.map((finding) =>
        card({
          id: `finding:${finding.id}`,
          title: finding.title,
          problem: finding.description,
          probableCause: finding.impact,
          priority: priorityFromSeverity(finding.severity),
          state: "FIX_BEFORE_AUTOMATING",
          economicState,
          whyItMatters: finding.impact,
          whatToDoNow: `Fix or validate this issue before automating: ${finding.title}`,
          whatNotToDo: "Do not automate before remediation.",
          nextBestAction: `Review finding: ${finding.title}`,
          evidenceReferences: evidenceFor(result, finding.id),
          uncertainty: unknownsFor(result),
          explanation,
          traceability,
        }),
      ),
      ...result.opportunities.map((opportunity) =>
        card({
          id: `opportunity:${opportunity.id}`,
          title: opportunity.title,
          problem: opportunity.problem,
          probableCause: probableCauseFor(result, opportunity.problem),
          priority: priorityFromOpportunity(opportunity),
          state: decisionStateFor(opportunity, economicState),
          economicState,
          whyItMatters: `Business impact ${opportunity.impact}; readiness ${opportunity.readiness}; confidence ${opportunity.confidence}.`,
          whatToDoNow: actionFor(decisionStateFor(opportunity, economicState)),
          whatNotToDo: notActionFor(decisionStateFor(opportunity, economicState)),
          nextBestAction:
            result.recommendations.find((item) => item.title === opportunity.title)?.action ??
            actionFor(decisionStateFor(opportunity, economicState)),
          evidenceReferences: evidenceFor(result, opportunity.id),
          uncertainty: uncertaintyFor(opportunity, result),
          explanation,
          traceability,
        }),
      ),
      ...result.recommendations
        .filter(
          (recommendation) =>
            !result.opportunities.some((opportunity) => opportunity.title === recommendation.title),
        )
        .map((recommendation) =>
          card({
            id: `recommendation:${recommendation.id}`,
            title: recommendation.title,
            problem: recommendation.description,
            probableCause: recommendation.phase,
            priority: priorityFromRecommendation(recommendation.priority),
            state: recommendationStateFor(recommendation, economicState),
            economicState,
            whyItMatters: recommendation.description,
            whatToDoNow: recommendation.action,
            whatNotToDo: notActionFor(recommendationStateFor(recommendation, economicState)),
            nextBestAction: recommendation.action,
            evidenceReferences: evidenceFor(result, recommendation.id),
            uncertainty: unknownsFor(result),
            explanation,
            traceability,
          }),
        ),
    ]),
  );
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
  return {
    id: input.id,
    title: input.title,
    executiveSummary: `${input.problem} ${input.whatToDoNow}`.trim(),
    priority: input.priority,
    businessImpact: input.whyItMatters,
    evidenceStrength: evidenceStrengthFor(input.evidenceReferences, input.uncertainty),
    uncertainty: freeze(input.uncertainty),
    problem: input.problem,
    probableCause: input.probableCause,
    recommendationState: input.state,
    economicState: input.economicState,
    whyItMatters: input.whyItMatters,
    whatToDoNow: input.whatToDoNow,
    whatNotToDo: input.whatNotToDo,
    nextBestAction: input.nextBestAction,
    evidenceReferences: freeze(input.evidenceReferences),
    explanation: input.explanation,
    traceability: input.traceability,
  };
}

function traceabilityFor(input: ProductionExecutiveDecisionViewBuildInput): ExecutiveTraceability {
  const provenance = input.result.provenance;
  const processMapId = provenance?.processMapId ?? input.result.process?.id;
  return {
    companyId: input.result.company.id,
    tenantId: input.tenantId,
    brainRunId: `production-reconstruction:${input.result.company.id}:${[
      provenance?.processMapId,
      provenance?.analysisId,
      provenance?.automationOpportunitySnapshotId,
      provenance?.roiId,
      provenance?.recommendationPortfolioId,
    ]
      .filter(Boolean)
      .join(":")}`,
    knowledgeSnapshotId: null,
    processMapIds: freeze(processMapId ? [processMapId] : []),
    evidenceIds: freeze(evidenceFor(input.result)),
    claimIds: freeze([]),
    opportunityIds: freeze(input.result.opportunities.map((item) => item.id)),
    economicEvidenceIds: freeze(input.result.roi?.evaluations.map((item) => item.id) ?? []),
    executiveResultArtifactIds: Object.freeze({
      ...(provenance ?? {}),
    }),
  };
}

function evidenceExplanationFor(result: ExecutiveAuditResult): ExecutiveEvidenceExplanation {
  return {
    supportingSources: freeze(evidenceFor(result)),
    conflictingSources: freeze([]),
    missingEvidence: freeze(unknownsFor(result)),
  };
}

function evidenceFor(result: ExecutiveAuditResult, extra?: string): readonly string[] {
  return freeze(
    [
      result.provenance?.processMapId,
      result.provenance?.analysisId,
      result.provenance?.automationOpportunitySnapshotId,
      result.provenance?.roiId,
      result.provenance?.recommendationPortfolioId,
      ...(extra ? [extra] : []),
    ].filter((item): item is string => Boolean(item)),
  );
}

function economicStateFor(result: ExecutiveAuditResult): ExecutiveEconomicState {
  if (!result.roi?.evaluations.length) return "INSUFFICIENT_EVIDENCE";
  const values = result.roi.evaluations;
  if (values.some((item) => item.roiSpecialValue === "infinite")) return "ECONOMICALLY_JUSTIFIED";
  const numericRoi = values.map((item) => item.roi).filter(isNumber);
  const benefits = values.map((item) => item.annualBenefit).filter(isNumber);
  if (!numericRoi.length && !benefits.length) return "INSUFFICIENT_EVIDENCE";
  if (numericRoi.some((item) => item > 0) || benefits.some((item) => item > 0))
    return "ECONOMICALLY_JUSTIFIED";
  return "NOT_JUSTIFIED";
}

function economicPresentationFor(
  result: ExecutiveAuditResult,
  state: ExecutiveEconomicState,
): ExecutiveDecisionView["economicPresentation"] {
  const benefits = result.roi?.evaluations.map((item) => item.annualBenefit).filter(isNumber) ?? [];
  const paybacks = result.roi?.evaluations.map((item) => item.payback).filter(isNumber) ?? [];
  return {
    state,
    benefitRange: {
      min: benefits.length ? Math.min(...benefits) : null,
      max: benefits.length ? Math.max(...benefits) : null,
    },
    costRange: { min: null, max: null },
    breakEvenMonths: paybacks.length ? Math.min(...paybacks) : null,
    timeToValueMonths: paybacks.length ? Math.min(...paybacks) : null,
    costOfInaction: benefits.length ? Math.max(...benefits) : null,
    currency: result.roi?.currency ?? null,
    missingEvidence: freeze(unknownsFor(result)),
  };
}

function whatWeKnowFor(result: ExecutiveAuditResult): readonly string[] {
  return [
    `${result.company.name} has a published automation audit result.`,
    ...(result.process ? [`Published process map: ${result.process.name}.`] : []),
    ...result.findings.slice(0, 3).map((item) => `Finding: ${item.title}.`),
  ];
}

function whatWeBelieveFor(result: ExecutiveAuditResult): readonly string[] {
  return [
    ...result.opportunities.slice(0, 3).map((item) => `Opportunity candidate: ${item.title}.`),
    ...result.recommendations.slice(0, 3).map((item) => `Recommended initiative: ${item.title}.`),
  ];
}

function unknownsFor(result: ExecutiveAuditResult): readonly string[] {
  const missing: string[] = [];
  if (!result.roi?.evaluations.length) missing.push("Published ROI evaluation is unavailable.");
  if (!result.recommendations.length) missing.push("Published recommendation portfolio is empty.");
  if (!result.opportunities.length) missing.push("Published automation opportunities are empty.");
  if (result.opportunities.some((item) => item.confidence < 50 || item.readiness < 50))
    missing.push("Some opportunities require stronger readiness or confidence evidence.");
  return freeze(missing);
}

function rootCausesFor(result: ExecutiveAuditResult): readonly string[] {
  return result.findings.map((item) => item.impact).filter(Boolean);
}

function bottlenecksFor(result: ExecutiveAuditResult): readonly string[] {
  return result.findings
    .filter((item) => /delay|wait|bottleneck|queue|manual|handoff/i.test(item.description))
    .map((item) => item.title);
}

function criticalIssuesFor(result: ExecutiveAuditResult): readonly string[] {
  return result.findings
    .filter((item) => /critical|high/i.test(item.severity))
    .map((item) => item.title);
}

function whatToFixFirstFor(result: ExecutiveAuditResult): readonly string[] {
  return result.findings
    .filter((item) => /critical|high/i.test(item.severity))
    .map((item) => item.title);
}

function whatNotToAutomateFor(result: ExecutiveAuditResult): readonly string[] {
  const controls = result.findings
    .filter((item) =>
      /approval|control|compliance|human/i.test(`${item.title} ${item.description}`),
    )
    .map((item) => item.title);
  return controls.length
    ? controls
    : ["Do not automate controls or approvals without confirmed published evidence."];
}

function whatCanBeAutomatedFor(result: ExecutiveAuditResult): readonly string[] {
  return result.opportunities
    .filter((item) => decisionStateFor(item, economicStateFor(result)) !== "NEEDS_MORE_EVIDENCE")
    .map((item) => item.title);
}

function nextActionsFor(
  result: ExecutiveAuditResult,
  cards: readonly ExecutivePriorityCard[],
): readonly string[] {
  return freeze([
    ...result.recommendations.map((item) => item.action),
    ...(cards[0] ? [cards[0].nextBestAction] : []),
  ]);
}

function probableCauseFor(result: ExecutiveAuditResult, problem: string): string {
  return (
    result.findings.find(
      (item) => problem.includes(item.title) || item.description.includes(problem),
    )?.impact ??
    result.findings[0]?.impact ??
    "Cause is derived from the published audit artifacts."
  );
}

function decisionStateFor(
  opportunity: ExecutiveAuditResult["opportunities"][number],
  economics: ExecutiveEconomicState,
): ExecutiveDecisionState {
  if (opportunity.confidence < 50 || opportunity.readiness < 50) return "NEEDS_MORE_EVIDENCE";
  if (economics === "NOT_JUSTIFIED") return "NOT_ECONOMICALLY_JUSTIFIED";
  if (economics === "INSUFFICIENT_EVIDENCE" || economics === "CURRENCY_NORMALIZATION_REQUIRED")
    return "NEEDS_MORE_EVIDENCE";
  if (opportunity.readiness >= 75 && opportunity.confidence >= 70) return "AUTOMATE_NOW";
  return "AUTOMATE_CONDITIONALLY";
}

function recommendationStateFor(
  recommendation: ExecutiveAuditResult["recommendations"][number],
  economics: ExecutiveEconomicState,
): ExecutiveDecisionState {
  if (recommendation.confidence < 50) return "NEEDS_MORE_EVIDENCE";
  if (economics === "NOT_JUSTIFIED") return "NOT_ECONOMICALLY_JUSTIFIED";
  if (economics === "INSUFFICIENT_EVIDENCE") return "NEEDS_MORE_EVIDENCE";
  return recommendation.priority === "critical" || recommendation.priority === "high"
    ? "AUTOMATE_NOW"
    : "AUTOMATE_CONDITIONALLY";
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
  if (state === "FIX_BEFORE_AUTOMATING") return "Do not automate before remediation.";
  if (state === "NEEDS_MORE_EVIDENCE") return "Do not manufacture missing ROI or process facts.";
  if (state === "NOT_ECONOMICALLY_JUSTIFIED") return "Do not present this as a quick win.";
  if (state === "DO_NOT_AUTOMATE" || state === "HUMAN_DECISION_REQUIRED")
    return "Do not remove the required human control.";
  return null;
}

function uncertaintyFor(
  opportunity: ExecutiveAuditResult["opportunities"][number],
  result: ExecutiveAuditResult,
): readonly string[] {
  if (opportunity.confidence >= 70 && opportunity.readiness >= 75) return freeze([]);
  return unknownsFor(result);
}

function evidenceStrengthFor(
  evidenceReferences: readonly string[],
  uncertainty: readonly string[],
): ExecutiveEvidenceStrength {
  if (!evidenceReferences.length) return "INSUFFICIENT";
  if (uncertainty.length) return "MODERATE";
  if (evidenceReferences.length >= 3) return "STRONG";
  return "LIMITED";
}

function priorityFromSeverity(severity: string): ExecutivePriorityCard["priority"] {
  if (/critical/i.test(severity)) return "CRITICAL";
  if (/high/i.test(severity)) return "HIGH";
  if (/medium/i.test(severity)) return "MEDIUM";
  return "LOW";
}

function priorityFromOpportunity(
  opportunity: ExecutiveAuditResult["opportunities"][number],
): ExecutivePriorityCard["priority"] {
  if (opportunity.impact >= 75) return "HIGH";
  if (opportunity.impact >= 50) return "MEDIUM";
  return "LOW";
}

function priorityFromRecommendation(priority: string): ExecutivePriorityCard["priority"] {
  if (priority === "critical") return "CRITICAL";
  if (priority === "high") return "HIGH";
  if (priority === "medium") return "MEDIUM";
  return "LOW";
}

function completenessFor(
  result: ExecutiveAuditResult,
  cards: readonly ExecutivePriorityCard[],
  economicState: ExecutiveEconomicState,
  nextBestActions: readonly string[],
): ExecutiveCompletenessCheck {
  const checks = {
    whatIsWrong: result.findings.length > 0,
    why: rootCausesFor(result).length > 0,
    evidence: cards.length > 0 && cards.every((card) => card.evidenceReferences.length > 0),
    uncertainty: true,
    whatToFix: whatToFixFirstFor(result).length > 0,
    whatNotToAutomate: whatNotToAutomateFor(result).length > 0,
    whatToAutomate: whatCanBeAutomatedFor(result).length > 0,
    economicStatus: Boolean(economicState),
    nextAction: nextBestActions.length > 0,
  };
  return {
    ...checks,
    status: Object.values(checks).every(Boolean) ? "YES" : "NO",
  };
}

function dedupeCards(cards: readonly ExecutivePriorityCard[]): readonly ExecutivePriorityCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function freeze<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
