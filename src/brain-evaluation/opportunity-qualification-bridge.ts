import {
  Claim,
  Confidence,
  Evidence,
  ReasoningTrace,
  type BrainModule,
  type EvidenceFreshness,
  type EvidenceSourceType,
} from "./brain-contracts";
import {
  OpportunityCandidate,
  OpportunityIntelligenceEngine,
  type Assessment,
  type AISuitability,
  type DataReadiness,
  type Feasibility,
  type HumanControlKind,
  type OpportunityDecision,
  type OpportunityPrerequisite,
  type OpportunityType,
  type Readiness,
  type RiskAssessment,
} from "./opportunity-intelligence";
import {
  BrainIdentityMap,
  ConfidenceAdapter,
  EnterpriseEvidenceAdapter,
  ProvenanceAdapter,
} from "./convergence-adapters";

export interface ProductionOpportunityEvidence {
  id: string;
  sourceType: EvidenceSourceType;
  sourceReference: string;
  sourceModule?: BrainModule;
  capturedAt: Date;
  freshness?: EvidenceFreshness;
  reliability: number;
  content: string;
  structuredValue?: unknown;
  provenance: Readonly<Record<string, unknown>>;
  tenantId: string;
  companyId?: string;
  claim?: { id: string; statement: string; kind: "FACT" | "INFERENCE" | "HYPOTHESIS" | "UNKNOWN" };
}

export interface ProductionOpportunityInput {
  opportunityId: string;
  tenantId: string;
  companyId?: string;
  subject: string;
  problemStatement: string;
  targetOutcome: string;
  currentState: string;
  desiredState: string;
  candidateType: OpportunityType;
  productionConfidence: number;
  processIds?: readonly string[];
  processStepIds?: readonly string[];
  knowledgePatternIds?: readonly string[];
  solutionPatternIds?: readonly string[];
  problemIds?: readonly string[];
  symptomIds?: readonly string[];
  causeIds?: readonly string[];
  valueSignals?: OpportunityCandidate["valueSignals"];
  prerequisites?: readonly OpportunityPrerequisite[];
  evidence: readonly ProductionOpportunityEvidence[];
  capturedAt?: Date;
}

export interface ProductionOpportunityInputResult {
  candidate: OpportunityCandidate;
  evidence: readonly Evidence[];
  claims: readonly Claim[];
  identityMap: BrainIdentityMap;
  tenantId: string;
  companyId?: string;
  processIds: readonly string[];
}

/** Converts production evidence and identifiers without importing production aggregates. */
export class ProductionOpportunityInputAdapter {
  private readonly provenance = new ProvenanceAdapter();
  private readonly evidenceAdapter = new EnterpriseEvidenceAdapter();

  map(input: ProductionOpportunityInput): ProductionOpportunityInputResult {
    const identityMap = new BrainIdentityMap();
    identityMap.bind("opportunity", input.opportunityId, input.opportunityId);
    for (const id of input.processIds ?? []) identityMap.bind("process", id, id);
    for (const id of input.processStepIds ?? []) identityMap.bind("process", id, id);
    for (const record of input.evidence) identityMap.bind("evidence", record.id, record.id);
    for (const record of input.evidence)
      if (record.claim) identityMap.bind("claim", record.claim.id, record.claim.id);

    const mapped = this.evidenceAdapter.toBrain(input.evidence);
    const traceSources = input.evidence.map((record) => ({
      sourceId: record.id,
      sourceType: record.sourceType,
      capturedAt: record.capturedAt,
      sourceModule: record.sourceModule,
      sourceVersion:
        typeof record.provenance.version === "number" ? record.provenance.version : undefined,
      parentSourceId:
        typeof record.provenance.parentSourceId === "string"
          ? record.provenance.parentSourceId
          : undefined,
    }));
    const candidate = OpportunityCandidate.create({
      opportunityId: input.opportunityId,
      subject: input.subject,
      problemIds: input.problemIds,
      symptomIds: input.symptomIds,
      causeIds: input.causeIds,
      processStepIds: input.processStepIds,
      supportingClaimIds: mapped.claims.map((claim) => claim.claimId),
      supportingEvidenceIds: mapped.evidence.map((evidence) => evidence.evidenceId),
      knowledgePatternIds: input.knowledgePatternIds,
      solutionPatternIds: input.solutionPatternIds,
      problemStatement: input.problemStatement,
      targetOutcome: input.targetOutcome,
      currentState: input.currentState,
      desiredState: input.desiredState,
      candidateType: input.candidateType,
      confidence: ConfidenceAdapter.toBrain(input.productionConfidence),
      valueSignals: input.valueSignals,
      prerequisites: input.prerequisites,
      trace: this.provenance.toTrace(traceSources, input.opportunityId),
    });
    return Object.freeze({
      candidate,
      evidence: mapped.evidence,
      claims: mapped.claims,
      identityMap,
      tenantId: input.tenantId,
      companyId: input.companyId,
      processIds: Object.freeze([...(input.processIds ?? [])]),
    });
  }
}

export interface BrainOpportunityQualification {
  candidateId: string;
  productionSourceIds: Readonly<{
    opportunityId: string;
    tenantId: string;
    companyId?: string;
    processIds: readonly string[];
    evidenceIds: readonly string[];
    claimIds: readonly string[];
  }>;
  brainDecision: OpportunityDecision;
  automationSuitability: Assessment<string>;
  aiSuitability?: Assessment<AISuitability>;
  technicalFeasibility: Assessment<Feasibility>;
  processReadiness: Assessment<Readiness>;
  dataReadiness: Assessment<DataReadiness>;
  humanControl: HumanControlKind;
  riskAssessment: RiskAssessment;
  evidenceGuard: { status: string; rationale: string };
  blockingReasons: readonly string[];
  warnings: readonly string[];
  prerequisites: readonly OpportunityPrerequisite[];
  remainingUnknowns: readonly string[];
  confidence: number;
  reasoningTrace: ReasoningTrace;
}

export interface QualificationInputs {
  automationSuitability: Assessment<string>;
  aiSuitability?: Assessment<AISuitability>;
  technicalFeasibility: Assessment<Feasibility>;
  processReadiness: Assessment<Readiness>;
  dataReadiness: Assessment<DataReadiness>;
  humanControl: HumanControlKind;
  riskAssessment: RiskAssessment;
  evidenceGuard: {
    status: "SUFFICIENT" | "SUFFICIENT_WITH_UNCERTAINTY" | "INSUFFICIENT" | "BLOCKED";
    rationale: string;
  };
  remainingUnknowns?: readonly string[];
}

export class BrainOpportunityQualificationService {
  qualify(
    mapped: ProductionOpportunityInputResult,
    input: QualificationInputs,
  ): BrainOpportunityQualification {
    const decision = new OpportunityIntelligenceEngine().evaluate({
      candidate: mapped.candidate,
      suitability: input.automationSuitability,
      ai: input.aiSuitability,
      feasibility: input.technicalFeasibility,
      process: input.processReadiness,
      data: input.dataReadiness,
      risk: input.riskAssessment,
      evidence: input.evidenceGuard,
      human: input.humanControl,
    });
    const blockingReasons = Object.freeze([...decision.reasons]);
    const warnings = Object.freeze([
      ...input.automationSuitability.warnings,
      ...input.technicalFeasibility.warnings,
      ...input.processReadiness.warnings,
      ...input.dataReadiness.warnings,
      ...(input.riskAssessment.overall > 0.75 ? ["operational risk remains material"] : []),
    ]);
    return Object.freeze({
      candidateId: mapped.candidate.opportunityId,
      productionSourceIds: Object.freeze({
        opportunityId: mapped.candidate.opportunityId,
        tenantId: mapped.tenantId,
        companyId: mapped.companyId,
        processIds: mapped.processIds,
        evidenceIds: Object.freeze([...mapped.candidate.supportingEvidenceIds]),
        claimIds: Object.freeze([...mapped.candidate.supportingClaimIds]),
      }),
      brainDecision: decision.decision,
      automationSuitability: input.automationSuitability,
      aiSuitability: input.aiSuitability,
      technicalFeasibility: input.technicalFeasibility,
      processReadiness: input.processReadiness,
      dataReadiness: input.dataReadiness,
      humanControl: input.humanControl,
      riskAssessment: input.riskAssessment,
      evidenceGuard: input.evidenceGuard,
      blockingReasons,
      warnings: Object.freeze(warnings),
      prerequisites: Object.freeze([...mapped.candidate.prerequisites]),
      remainingUnknowns: Object.freeze([...(input.remainingUnknowns ?? [])]),
      confidence: mapped.candidate.confidence,
      reasoningTrace: mapped.candidate.trace,
    });
  }
}

export interface ProductionEligibilityOutcome {
  eligible: boolean;
  publicationReady: boolean;
  requiresHumanControl: boolean;
  reason: string;
  blockingReasons: readonly string[];
  prerequisites: readonly OpportunityPrerequisite[];
  qualification: BrainOpportunityQualification;
}

export class ProductionOpportunityEligibilityBridge {
  evaluate(qualification: BrainOpportunityQualification): ProductionEligibilityOutcome {
    const decision = qualification.brainDecision;
    const human = decision === "HUMAN_ASSISTED";
    const eligible = decision === "RECOMMEND_CANDIDATE" || human;
    return Object.freeze({
      eligible,
      publicationReady: decision === "RECOMMEND_CANDIDATE",
      requiresHumanControl: human,
      reason: human
        ? "Explicit human control is required"
        : eligible
          ? "Brain gates passed"
          : `Brain decision ${decision} blocks eligibility`,
      blockingReasons: qualification.blockingReasons,
      prerequisites: qualification.prerequisites,
      qualification,
    });
  }
}

export type OpportunityComparisonKind =
  "AGREE" | "SOFT_DIFFERENCE" | "MATERIAL_DIFFERENCE" | "BRAIN_HARD_GATE_CONFLICT";
export interface ProductionOpportunityAssessment {
  score: number;
  readiness: number;
  status?: string;
}
export interface OpportunityDualRunComparison {
  production: ProductionOpportunityAssessment;
  brain: BrainOpportunityQualification;
  classification: OpportunityComparisonKind;
  agreement: boolean;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export class OpportunityDualRunHarness {
  compare(
    production: ProductionOpportunityAssessment,
    brain: BrainOpportunityQualification,
  ): OpportunityDualRunComparison {
    const hardGate =
      brain.brainDecision === "NEED_MORE_EVIDENCE" ||
      brain.brainDecision === "DEFER" ||
      brain.brainDecision === "REJECT";
    const productionReady = production.readiness >= 70 || production.score >= 70;
    const classification: OpportunityComparisonKind =
      hardGate && productionReady
        ? "BRAIN_HARD_GATE_CONFLICT"
        : (brain.brainDecision === "RECOMMEND_CANDIDATE" && productionReady) ||
            (hardGate && !productionReady)
          ? "AGREE"
          : Math.abs(production.score - ConfidenceAdapter.toProduction(brain.confidence)) <= 15
            ? "SOFT_DIFFERENCE"
            : "MATERIAL_DIFFERENCE";
    const reason =
      classification === "BRAIN_HARD_GATE_CONFLICT"
        ? `Production score/readiness suggests ready, Brain decision is ${brain.brainDecision}: ${brain.blockingReasons.join(", ") || brain.evidenceGuard.rationale}`
        : classification === "AGREE"
          ? "Production and Brain qualification agree"
          : "Production heuristic and Brain qualification differ";
    return Object.freeze({
      production,
      brain,
      classification,
      agreement: classification === "AGREE",
      reason,
      severity:
        classification === "BRAIN_HARD_GATE_CONFLICT" || classification === "MATERIAL_DIFFERENCE"
          ? "HIGH"
          : classification === "SOFT_DIFFERENCE"
            ? "MEDIUM"
            : "LOW",
    });
  }
}

/** Creates a trace-preserving claim confidence for callers building qualification inputs. */
export function adaptedClaimConfidence(reliability: number, capturedAt: Date): Confidence {
  return Confidence.create(
    ConfidenceAdapter.toBrain(reliability * 100),
    {
      supportingEvidenceCount: 1,
      averageSourceReliability: reliability,
      sourceAgreement: 1,
      freshness: 1,
      directness: 1,
      contradictionPenalty: 0,
      missingDataPenalty: 0,
    },
    `Production evidence captured at ${capturedAt.toISOString()}`,
  );
}
