import type { ReasoningTrace } from "./brain-contracts";
import type { BrainOpportunityQualification } from "./opportunity-qualification-bridge";
import type { BrainEconomicQualification } from "./economic-qualification-bridge";

export type PortfolioEligibility =
  | "ELIGIBLE"
  | "ELIGIBLE_WITH_CONDITIONS"
  | "DEFER"
  | "REJECT"
  | "NEED_MORE_EVIDENCE"
  | "HUMAN_ASSISTED_ONLY";
export type InitiativeClass =
  "FOUNDATIONAL" | "QUICK_WIN" | "CORE_TRANSFORMATION" | "DEPENDENT" | "OPTIONAL" | "DEFERRED";
export type PortfolioComparisonKind =
  | "AGREE"
  | "SOFT_DIFFERENCE"
  | "MATERIAL_DIFFERENCE"
  | "BRAIN_HARD_GATE_CONFLICT"
  | "DEPENDENCY_CONFLICT";

export interface ProductionPortfolioOpportunity {
  opportunityId: string;
  tenantId: string;
  title: string;
  description?: string;
  priority: "critical" | "high" | "medium" | "low" | "future";
  priorityScore: number;
  processIds?: readonly string[];
  departmentIds?: readonly string[];
  systemIds?: readonly string[];
  evidenceIds?: readonly string[];
}

export interface PortfolioDependency {
  id: string;
  description: string;
  prerequisiteId?: string;
  dependentId?: string;
  blocking: boolean;
  reason: string;
}

export interface PortfolioCandidateQualification {
  candidateId: string;
  tenantId: string;
  title: string;
  eligibility: PortfolioEligibility;
  initiativeClass: InitiativeClass;
  priorityScore: number;
  brainDecision: BrainOpportunityQualification["brainDecision"];
  economicSignal: BrainEconomicQualification["economicSignal"];
  roiEligibility: string;
  prerequisites: readonly PortfolioDependency[];
  blockingReasons: readonly string[];
  warnings: readonly string[];
  humanControl: BrainOpportunityQualification["humanControl"];
  confidence: number;
  processIds: readonly string[];
  evidenceIds: readonly string[];
  reasoningTrace: ReasoningTrace;
}

export interface BrainPortfolioCandidateInput {
  production: ProductionPortfolioOpportunity;
  opportunity: BrainOpportunityQualification;
  economic: BrainEconomicQualification;
  dependencies?: readonly PortfolioDependency[];
}

/** Structural adapter: production portfolio aggregates are never imported or mutated. */
export class BrainPortfolioCandidateAdapter {
  map(input: BrainPortfolioCandidateInput): PortfolioCandidateQualification {
    if (
      input.production.tenantId !== input.opportunity.productionSourceIds.tenantId ||
      input.production.tenantId !== input.economic.tenantId
    ) {
      throw new Error("Portfolio candidate tenant mismatch");
    }
    if (
      input.production.opportunityId !== input.opportunity.candidateId ||
      input.production.opportunityId !== input.economic.opportunityId
    ) {
      throw new Error("Portfolio candidate identity mismatch");
    }
    const dependencies = Object.freeze([...(input.dependencies ?? [])]);
    const blocking = [
      ...input.opportunity.blockingReasons,
      ...input.economic.blockingReasons,
      ...dependencies.filter((d) => d.blocking).map((d) => d.reason),
    ];
    const warnings = [...input.opportunity.warnings, ...input.economic.warnings];
    const eligibility = new PortfolioEligibilityBridge().evaluate(
      input.opportunity,
      input.economic,
      dependencies,
    );
    const initiativeClass = classifyInitiative(input, dependencies);
    return Object.freeze({
      candidateId: input.production.opportunityId,
      tenantId: input.production.tenantId,
      title: input.production.title,
      eligibility,
      initiativeClass,
      priorityScore: input.production.priorityScore,
      brainDecision: input.opportunity.brainDecision,
      economicSignal: input.economic.economicSignal,
      roiEligibility: input.economic.economicGuard.status,
      prerequisites: dependencies,
      blockingReasons: Object.freeze(blocking),
      warnings: Object.freeze(warnings),
      humanControl: input.opportunity.humanControl,
      confidence: Math.min(input.opportunity.confidence, input.economic.confidence),
      processIds: Object.freeze([
        ...(input.production.processIds ?? input.opportunity.productionSourceIds.processIds),
      ]),
      evidenceIds: Object.freeze([
        ...(input.production.evidenceIds ?? input.opportunity.productionSourceIds.evidenceIds),
      ]),
      reasoningTrace: input.opportunity.reasoningTrace,
    });
  }
}

export class PortfolioEligibilityBridge {
  evaluate(
    opportunity: BrainOpportunityQualification,
    economic: BrainEconomicQualification,
    dependencies: readonly PortfolioDependency[] = [],
  ): PortfolioEligibility {
    if (opportunity.brainDecision === "REJECT") return "REJECT";
    if (opportunity.brainDecision === "DEFER") return "DEFER";
    if (opportunity.brainDecision === "NEED_MORE_EVIDENCE") return "NEED_MORE_EVIDENCE";
    if (opportunity.brainDecision === "HUMAN_ASSISTED") return "HUMAN_ASSISTED_ONLY";
    if (economic.economicSignal === "NEGATIVE_VALUE") return "REJECT";
    if (economic.economicGuard.status === "BLOCKED") return "DEFER";
    if (economic.economicGuard.status === "INSUFFICIENT") return "NEED_MORE_EVIDENCE";
    if (dependencies.some((d) => d.blocking)) return "ELIGIBLE_WITH_CONDITIONS";
    if (economic.economicGuard.status === "SUFFICIENT_WITH_ASSUMPTIONS")
      return "ELIGIBLE_WITH_CONDITIONS";
    return "ELIGIBLE";
  }
}

export interface PrerequisiteGraph {
  nodes: readonly string[];
  edges: readonly PortfolioDependency[];
  hasCycle: boolean;
}

export class PrerequisiteGraphProjector {
  project(dependencies: readonly PortfolioDependency[]): PrerequisiteGraph {
    const edges = [...dependencies].sort((a, b) => a.id.localeCompare(b.id));
    const nodes = [
      ...new Set(
        edges.flatMap((e) =>
          [e.prerequisiteId, e.dependentId].filter((id): id is string => Boolean(id)),
        ),
      ),
    ].sort();
    const graph = new Map<string, string[]>();
    for (const edge of edges)
      if (edge.prerequisiteId && edge.dependentId)
        graph.set(edge.prerequisiteId, [
          ...(graph.get(edge.prerequisiteId) ?? []),
          edge.dependentId,
        ]);
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      if ((graph.get(node) ?? []).some(visit)) return true;
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    return Object.freeze({
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      hasCycle: nodes.some(visit),
    });
  }
}

export interface ProductionPortfolioPriority {
  priority: ProductionPortfolioOpportunity["priority"];
  score: number;
}
export interface PortfolioDualRunComparison {
  production: ProductionPortfolioPriority;
  brain: PortfolioCandidateQualification;
  classification: PortfolioComparisonKind;
  agreement: boolean;
  reason: string;
}
export class PortfolioDualRunHarness {
  compare(
    production: ProductionPortfolioPriority,
    brain: PortfolioCandidateQualification,
  ): PortfolioDualRunComparison {
    const hard = ["DEFER", "REJECT", "NEED_MORE_EVIDENCE", "HUMAN_ASSISTED_ONLY"].includes(
      brain.eligibility,
    );
    const high =
      production.priority === "critical" ||
      production.priority === "high" ||
      production.score >= 70;
    const dependencyConflict = brain.prerequisites.some((d) => d.blocking) && high;
    const classification: PortfolioComparisonKind = dependencyConflict
      ? "DEPENDENCY_CONFLICT"
      : hard && high
        ? "BRAIN_HARD_GATE_CONFLICT"
        : Math.abs(production.score - brain.confidence * 100) <= 15
          ? "AGREE"
          : "SOFT_DIFFERENCE";
    return Object.freeze({
      production,
      brain,
      classification,
      agreement: classification === "AGREE",
      reason:
        classification === "AGREE"
          ? "Priority and qualification agree"
          : "Brain qualification remains authoritative for portfolio entry",
    });
  }
}

function classifyInitiative(
  input: BrainPortfolioCandidateInput,
  dependencies: readonly PortfolioDependency[],
): InitiativeClass {
  if (
    input.opportunity.brainDecision === "DEFER" ||
    input.opportunity.brainDecision === "NEED_MORE_EVIDENCE"
  )
    return "DEFERRED";
  if (dependencies.some((d) => d.blocking)) return "DEPENDENT";
  if (input.economic.economicSignal === "NEGATIVE_VALUE") return "OPTIONAL";
  if (input.production.priority === "high" || input.production.priority === "critical")
    return "CORE_TRANSFORMATION";
  if (input.production.priority === "low" && input.production.priorityScore < 45)
    return "QUICK_WIN";
  return "FOUNDATIONAL";
}
