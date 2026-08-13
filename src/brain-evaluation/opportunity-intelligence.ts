import type { ReasoningTrace } from "./brain-contracts";
import type { CauseCandidate } from "./process-causal";

export type OpportunityType =
  | "AUTOMATION"
  | "AI_ASSISTED"
  | "HUMAN_ASSISTED"
  | "PROCESS_REDESIGN"
  | "INTEGRATION"
  | "DATA_QUALITY"
  | "CONTROL_IMPROVEMENT"
  | "OBSERVABILITY"
  | "DO_NOT_AUTOMATE";
export type OpportunityStatus = "CANDIDATE" | "DEFERRED" | "REJECTED" | "READY";
export type OpportunityDecision =
  "RECOMMEND_CANDIDATE" | "DEFER" | "REJECT" | "HUMAN_ASSISTED" | "NEED_MORE_EVIDENCE";
export type Readiness = "READY" | "READY_WITH_CONDITIONS" | "NOT_READY" | "NEED_MORE_EVIDENCE";
export type DataReadiness = "READY" | "PARTIAL" | "NOT_READY" | "UNKNOWN";
export type AISuitability =
  "AI_NOT_NEEDED" | "AI_ASSISTED" | "AI_WITH_HUMAN_VALIDATION" | "AI_UNSUITABLE";
export type Feasibility = "FEASIBLE" | "PARTIALLY_FEASIBLE" | "UNKNOWN" | "BLOCKED";
export type EvidenceGuardStatus =
  "SUFFICIENT" | "SUFFICIENT_WITH_UNCERTAINTY" | "INSUFFICIENT" | "BLOCKED";
export type HumanControlKind =
  "WASTE" | "USEFUL_CONTROL" | "MANDATORY_CONTROL" | "HUMAN_JUDGMENT" | "UNKNOWN";
export type RejectionReason =
  | "LOW_VOLUME"
  | "LOW_MANUAL_COST"
  | "PROCESS_NOT_STABLE"
  | "ROOT_CAUSE_NOT_CONFIRMED"
  | "DATA_NOT_READY"
  | "INTEGRATION_NOT_AVAILABLE"
  | "CAPABILITY_UNKNOWN"
  | "EXCESSIVE_RISK"
  | "CONTROL_MUST_REMAIN_HUMAN"
  | "TOO_MANY_EXCEPTIONS"
  | "CHANGE_COST_TOO_HIGH"
  | "INSUFFICIENT_EVIDENCE";
const freeze = <T extends object>(v: T) => Object.freeze(v);
const bounded = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
export interface ValueSignals {
  timeConsumed?: number;
  frequency?: number;
  volume?: number;
  errorRate?: number;
  errorImpact?: number;
  delayImpact?: number;
  laborDependency?: number;
  customerImpact?: number;
  revenueRisk?: number;
  complianceExposure?: number;
  capacityConstraint?: number;
}
export interface OpportunityCandidateInput {
  opportunityId: string;
  subject: string;
  problemIds?: readonly string[];
  symptomIds?: readonly string[];
  causeIds?: readonly string[];
  processStepIds?: readonly string[];
  supportingClaimIds?: readonly string[];
  supportingEvidenceIds?: readonly string[];
  knowledgePatternIds?: readonly string[];
  solutionPatternIds?: readonly string[];
  problemStatement: string;
  targetOutcome: string;
  currentState: string;
  desiredState: string;
  candidateType: OpportunityType;
  confidence: number;
  status?: OpportunityStatus;
  valueSignals?: ValueSignals;
  prerequisites?: readonly OpportunityPrerequisite[];
  trace: ReasoningTrace;
}
export class OpportunityCandidate {
  readonly opportunityId: string;
  readonly subject: string;
  readonly problemIds: readonly string[];
  readonly symptomIds: readonly string[];
  readonly causeIds: readonly string[];
  readonly processStepIds: readonly string[];
  readonly supportingClaimIds: readonly string[];
  readonly supportingEvidenceIds: readonly string[];
  readonly knowledgePatternIds: readonly string[];
  readonly solutionPatternIds: readonly string[];
  readonly problemStatement: string;
  readonly targetOutcome: string;
  readonly currentState: string;
  readonly desiredState: string;
  readonly candidateType: OpportunityType;
  readonly confidence: number;
  readonly status: OpportunityStatus;
  readonly valueSignals: ValueSignals;
  readonly prerequisites: readonly OpportunityPrerequisite[];
  readonly trace: ReasoningTrace;
  private constructor(i: OpportunityCandidateInput) {
    this.opportunityId = i.opportunityId.trim();
    this.subject = i.subject.trim();
    if (!this.opportunityId || !this.subject) throw new Error("Opportunity identity is required");
    this.problemIds = Object.freeze([...(i.problemIds ?? [])]);
    this.symptomIds = Object.freeze([...(i.symptomIds ?? [])]);
    this.causeIds = Object.freeze([...(i.causeIds ?? [])]);
    this.processStepIds = Object.freeze([...(i.processStepIds ?? [])]);
    this.supportingClaimIds = Object.freeze([...(i.supportingClaimIds ?? [])]);
    this.supportingEvidenceIds = Object.freeze([...(i.supportingEvidenceIds ?? [])]);
    this.knowledgePatternIds = Object.freeze([...(i.knowledgePatternIds ?? [])]);
    this.solutionPatternIds = Object.freeze([...(i.solutionPatternIds ?? [])]);
    this.problemStatement = i.problemStatement;
    this.targetOutcome = i.targetOutcome;
    this.currentState = i.currentState;
    this.desiredState = i.desiredState;
    this.candidateType = i.candidateType;
    this.confidence = bounded(i.confidence);
    this.status = i.status ?? "CANDIDATE";
    this.valueSignals = freeze({ ...i.valueSignals });
    this.prerequisites = Object.freeze([...(i.prerequisites ?? [])]);
    this.trace = i.trace;
    freeze(this);
  }
  static create(i: OpportunityCandidateInput) {
    return new OpportunityCandidate(i);
  }
}
export interface OpportunityPrerequisite {
  id: string;
  description: string;
  reason: string;
  blocking: boolean;
}
export interface Assessment<T extends string> {
  status: T;
  score: number;
  factorBreakdown: Readonly<Record<string, number>>;
  rationale: string;
  blockingFactors: readonly string[];
  warnings: readonly string[];
}
export class AutomationSuitabilityAssessment {
  assess(
    s: ValueSignals,
    input: {
      ruleClarity: number;
      inputStructure: number;
      outputStructure: number;
      exceptionRate: number;
      decisionComplexity: number;
      humanJudgmentDependency: number;
      dataAvailability: number;
      processStability: number;
      integrationAvailability: number;
      controlRequirements: number;
      currentManualEffort: number;
    },
  ): Assessment<"SUITABLE" | "CONDITIONAL" | "UNSUITABLE"> {
    const f = {
      repetitiveness: bounded((s.frequency ?? 0) / 100),
      frequency: bounded((s.frequency ?? 0) / 100),
      volume: bounded((s.volume ?? 0) / 1000),
      ruleClarity: bounded(input.ruleClarity),
      inputStructure: bounded(input.inputStructure),
      outputStructure: bounded(input.outputStructure),
      exceptionRate: 1 - bounded(input.exceptionRate),
      decisionComplexity: 1 - bounded(input.decisionComplexity),
      dataAvailability: bounded(input.dataAvailability),
      processStability: bounded(input.processStability),
      integrationAvailability: bounded(input.integrationAvailability),
      manualEffort: bounded(input.currentManualEffort / 100),
    };
    const score = bounded(Object.values(f).reduce((a, b) => a + b, 0) / Object.keys(f).length);
    const blocking: string[] = [];
    if (input.integrationAvailability < 0.3) blocking.push("integration unavailable");
    if (input.processStability < 0.3) blocking.push("process unstable");
    if (input.dataAvailability < 0.3) blocking.push("data unavailable");
    return freeze({
      status: blocking.length ? "UNSUITABLE" : score >= 0.7 ? "SUITABLE" : "CONDITIONAL",
      score,
      factorBreakdown: f,
      rationale: "Deterministic suitability factors",
      blockingFactors: blocking,
      warnings: input.controlRequirements > 0.7 ? ["control requirements remain material"] : [],
    });
  }
}
export interface AIInput {
  unstructuredText: boolean;
  classification: boolean;
  extraction: boolean;
  semanticMatching: boolean;
  summarization: boolean;
  financialConsequence: number;
  legalConsequence: number;
  safetyConsequence: number;
  explainabilityTolerance: number;
  validationPath: number;
  hallucinationSensitivity: number;
}
export class AISuitabilityAssessment {
  assess(i: AIInput): Assessment<AISuitability> {
    const need = bounded(
      (Number(i.unstructuredText) +
        Number(i.classification) +
        Number(i.extraction) +
        Number(i.semanticMatching) +
        Number(i.summarization)) /
        5,
    );
    const risk = bounded(
      (i.financialConsequence +
        i.legalConsequence +
        i.safetyConsequence +
        (1 - i.explainabilityTolerance) +
        (1 - i.validationPath) +
        i.hallucinationSensitivity) /
        6,
    );
    const status =
      risk > 0.75
        ? "AI_UNSUITABLE"
        : need < 0.2
          ? "AI_NOT_NEEDED"
          : i.validationPath < 0.6
            ? "AI_ASSISTED"
            : "AI_WITH_HUMAN_VALIDATION";
    return freeze({
      status,
      score: bounded(need * (1 - risk)),
      factorBreakdown: { need, risk },
      rationale: "AI suitability is separate from automation suitability",
      blockingFactors:
        status === "AI_UNSUITABLE" ? ["high consequence or insufficient safeguards"] : [],
      warnings: [],
    });
  }
}
export interface TechnicalInput {
  requiredCapabilities: readonly string[];
  knownCapabilities: readonly string[];
  integrationAvailable: number;
  apiWrite: number;
  dataAccessible: number;
  authentication: number;
  trigger: number;
  batch: number;
  humanApproval: number;
  observability: number;
}
export class TechnicalFeasibilityAssessment {
  assess(i: TechnicalInput): Assessment<Feasibility> {
    const unknown = i.requiredCapabilities.filter((c) => !i.knownCapabilities.includes(c));
    const score = bounded(
      (i.integrationAvailable +
        i.apiWrite +
        i.dataAccessible +
        i.authentication +
        i.trigger +
        i.observability) /
        6,
    );
    const status = unknown.length
      ? "UNKNOWN"
      : score > 0.7
        ? "FEASIBLE"
        : score > 0.35
          ? "PARTIALLY_FEASIBLE"
          : "BLOCKED";
    return freeze({
      status,
      score,
      factorBreakdown: {
        integration: i.integrationAvailable,
        apiWrite: i.apiWrite,
        data: i.dataAccessible,
        authentication: i.authentication,
        trigger: i.trigger,
        observability: i.observability,
      },
      rationale: "Unknown capabilities are never inferred feasible",
      blockingFactors: unknown.map((c) => `unknown capability: ${c}`),
      warnings: [],
    });
  }
}
export class ProcessReadinessAssessment {
  assess(i: {
    ownership: number;
    definition: number;
    variation: number;
    rootCause: number;
    dataQuality: number;
    contradiction: number;
    exceptions: number;
    controls: number;
  }): Assessment<Readiness> {
    const blocking = [] as string[];
    if (i.ownership < 0.4) blocking.push("unclear ownership");
    if (i.definition < 0.4) blocking.push("undefined process");
    if (i.rootCause < 0.4) blocking.push("unknown root cause");
    if (i.contradiction > 0.6) blocking.push("unresolved contradiction");
    const score = bounded(
      (i.ownership +
        i.definition +
        (1 - i.variation) +
        i.rootCause +
        i.dataQuality +
        (1 - i.contradiction) +
        (1 - i.exceptions) +
        i.controls) /
        8,
    );
    return freeze({
      status: blocking.length ? "NOT_READY" : score > 0.75 ? "READY" : "READY_WITH_CONDITIONS",
      score,
      factorBreakdown: { ...i },
      rationale: "Process readiness checks prerequisites before automation",
      blockingFactors: blocking,
      warnings: [],
    });
  }
}
export class DataReadinessAssessment {
  assess(i: {
    availability: number;
    completeness: number;
    consistency: number;
    structure: number;
    freshness: number;
    sourceOfTruth: number;
    accessibility: number;
    traceability: number;
  }): Assessment<DataReadiness> {
    const score = bounded(Object.values(i).reduce((a, b) => a + b, 0) / 8);
    return freeze({
      status:
        score > 0.75 ? "READY" : score > 0.4 ? "PARTIAL" : score === 0 ? "UNKNOWN" : "NOT_READY",
      score,
      factorBreakdown: { ...i },
      rationale: "Data quality remains distinct from automation value",
      blockingFactors: score < 0.4 ? ["data readiness insufficient"] : [],
      warnings: [],
    });
  }
}
export class HumanControlAssessment {
  assess(i: { intentional: boolean; required: boolean; judgment: number; duplicate: boolean }): {
    kind: HumanControlKind;
    rationale: string;
  } {
    if (i.required) return { kind: "MANDATORY_CONTROL", rationale: "Control is required" };
    if (i.judgment > 0.7) return { kind: "HUMAN_JUDGMENT", rationale: "Judgment remains material" };
    if (i.duplicate && !i.intentional)
      return { kind: "WASTE", rationale: "Duplicate control without declared purpose" };
    return {
      kind: i.intentional ? "USEFUL_CONTROL" : "UNKNOWN",
      rationale: "Control purpose retained",
    };
  }
}
export interface RiskAssessment {
  operationalRisk: number;
  dataRisk: number;
  securityRisk: number;
  complianceRisk: number;
  financialRisk: number;
  vendorDependencyRisk: number;
  changeManagementRisk: number;
  failureImpact: number;
  reversibility: number;
  overall: number;
}
export class OpportunityRiskAssessment {
  assess(i: Omit<RiskAssessment, "overall">): RiskAssessment {
    const overall = bounded(
      (i.operationalRisk +
        i.dataRisk +
        i.securityRisk +
        i.complianceRisk +
        i.financialRisk +
        i.vendorDependencyRisk +
        i.changeManagementRisk +
        i.failureImpact +
        (1 - i.reversibility)) /
        9,
    );
    return freeze({ ...i, overall });
  }
}
export class OpportunityEvidenceGuard {
  assess(i: {
    criticalEvidenceMissing: boolean;
    rootCauseUncertain: boolean;
    materialContradiction: boolean;
    feasibility: Feasibility;
    capabilityUnknown: boolean;
    dataReadiness: DataReadiness;
  }): { status: EvidenceGuardStatus; rationale: string } {
    if (i.materialContradiction || i.capabilityUnknown || i.feasibility === "UNKNOWN")
      return { status: "BLOCKED", rationale: "Material uncertainty blocks readiness" };
    if (i.criticalEvidenceMissing || i.rootCauseUncertain || i.dataReadiness === "UNKNOWN")
      return { status: "INSUFFICIENT", rationale: "Critical evidence is missing" };
    if (i.dataReadiness !== "READY" || i.feasibility !== "FEASIBLE")
      return {
        status: "SUFFICIENT_WITH_UNCERTAINTY",
        rationale: "Evidence supports a conditional candidate",
      };
    return { status: "SUFFICIENT", rationale: "Required evidence is present" };
  }
}
export class OpportunityDecisionEngine {
  decide(i: {
    candidateType: OpportunityType;
    suitability: Assessment<string>;
    ai?: Assessment<AISuitability>;
    feasibility: Assessment<Feasibility>;
    process: Assessment<Readiness>;
    data: Assessment<DataReadiness>;
    risk: RiskAssessment;
    evidence: { status: EvidenceGuardStatus };
    human: HumanControlKind;
    value: number;
  }): { decision: OpportunityDecision; reasons: readonly RejectionReason[]; rationale: string } {
    const reasons: RejectionReason[] = [];
    if (i.evidence.status === "BLOCKED" || i.evidence.status === "INSUFFICIENT")
      reasons.push("INSUFFICIENT_EVIDENCE");
    if (i.feasibility.status === "UNKNOWN") reasons.push("CAPABILITY_UNKNOWN");
    if (i.data.status === "NOT_READY") reasons.push("DATA_NOT_READY");
    if (i.process.status === "NOT_READY") reasons.push("PROCESS_NOT_STABLE");
    if (i.risk.overall > 0.75) reasons.push("EXCESSIVE_RISK");
    if (i.human === "MANDATORY_CONTROL" || i.human === "HUMAN_JUDGMENT")
      return {
        decision: "HUMAN_ASSISTED",
        reasons: ["CONTROL_MUST_REMAIN_HUMAN", ...reasons],
        rationale: "Human control is preserved",
      };
    if (reasons.includes("INSUFFICIENT_EVIDENCE") || reasons.includes("CAPABILITY_UNKNOWN"))
      return {
        decision: "NEED_MORE_EVIDENCE",
        reasons,
        rationale: "Decision guard requires more evidence",
      };
    if (reasons.length)
      return { decision: "DEFER", reasons, rationale: "Prerequisites are unresolved" };
    if (i.value < 0.2)
      return { decision: "REJECT", reasons: ["LOW_VOLUME"], rationale: "Value signal is too low" };
    return {
      decision: "RECOMMEND_CANDIDATE",
      reasons,
      rationale: "Candidate passes explicit gates",
    };
  }
}
export class OpportunityIntelligenceEngine {
  evaluate(input: {
    candidate: OpportunityCandidate;
    suitability: Assessment<string>;
    ai?: Assessment<AISuitability>;
    feasibility: Assessment<Feasibility>;
    process: Assessment<Readiness>;
    data: Assessment<DataReadiness>;
    risk: RiskAssessment;
    evidence: { status: EvidenceGuardStatus };
    human: HumanControlKind;
  }): ReturnType<OpportunityDecisionEngine["decide"]> {
    const value = bounded(
      ((input.candidate.valueSignals?.frequency ?? 0) / 100 +
        (input.candidate.valueSignals?.volume ?? 0) / 1000 +
        (input.candidate.valueSignals?.timeConsumed ?? 0) / 100) /
        3,
    );
    return new OpportunityDecisionEngine().decide({
      ...input,
      candidateType: input.candidate.candidateType,
      value,
    });
  }
}
export function causalOpportunity(input: {
  cause: CauseCandidate;
  candidate: OpportunityCandidate;
}): OpportunityCandidate {
  return OpportunityCandidate.create({
    ...input.candidate,
    causeIds: [...input.candidate.causeIds, input.cause.causeId],
    confidence: Math.min(input.candidate.confidence, input.cause.confidence),
    trace: input.candidate.trace,
  });
}
