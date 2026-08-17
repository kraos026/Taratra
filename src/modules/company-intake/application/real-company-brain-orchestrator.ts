import {
  BrainIntegrationPipeline,
  type IntegratedBrainResult,
} from "../../../brain-evaluation/brain-integration";
import {
  EnterpriseEvidenceAdapter,
  ProcessMapAdapter,
  type EnterpriseEvidenceRecord,
  type PublishedProcessMap,
} from "../../../brain-evaluation/convergence-adapters";
import type { KnowledgeContext } from "../../../brain-evaluation/knowledge-foundation";
import type { EconomicInput } from "../../../brain-evaluation/economic-intelligence";
import type { UnknownInformation } from "../../../brain-evaluation/brain-contracts";
import { IntakeInterpretationAdapter } from "./intake-interpretation-adapter";
import { IntakeSession, IntakeSource } from "../domain/company-intake";
import type { AIProvider } from "../../../brain-evaluation/ai-interpretation-gateway";
import type { ProductionIntakeState, ProductionReadinessAssessment } from "./intake-readiness";
import { IntakeReadinessAssessmentService } from "./intake-readiness";

export interface RealCompanyBrainInput {
  readonly tenantId: string;
  readonly companyId: string;
  readonly discoverySessionId?: string;
  readonly interviewSessionIds?: readonly string[];
  readonly knowledgeSnapshotId?: string;
  readonly processMapId?: string;
}

export interface ProductionSourceForBrain {
  readonly id: string;
  readonly sourceType: EnterpriseEvidenceRecord["sourceType"];
  readonly sourceReference: string;
  readonly sourceVersion?: number;
  readonly content: string;
  readonly capturedAt: Date;
  readonly reliability: number;
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly rawText?: string;
  readonly interpreted?: boolean;
  readonly sessionId?: string;
  readonly actorId?: string;
  readonly claim?: EnterpriseEvidenceRecord["claim"];
  readonly tenantId: string;
  readonly companyId: string;
}

export interface RealCompanyProductionSnapshot {
  readonly company: { readonly id: string; readonly name: string; readonly organizationId: string };
  readonly readinessState: ProductionIntakeState;
  readonly sources: readonly ProductionSourceForBrain[];
  readonly processMap: PublishedProcessMap;
  readonly knowledge: KnowledgeContext;
  readonly facts: readonly string[];
  readonly unknowns: readonly UnknownInformation[];
  readonly economicInputs: Readonly<Record<string, EconomicInput>>;
}

export interface RealCompanyBrainPorts {
  load(input: RealCompanyBrainInput): Promise<RealCompanyProductionSnapshot>;
  readonly aiProvider?: AIProvider;
  readonly pipeline?: BrainIntegrationPipeline;
}

export interface RealCompanyBrainResult {
  readonly companyId: string;
  readonly tenantId: string;
  readonly readiness: ProductionReadinessAssessment;
  readonly sourceSnapshot: { readonly companyId: string; readonly knowledgeSnapshotId?: string };
  readonly evidence: IntegratedBrainResult["claims"] extends never[]
    ? never
    : IntegratedBrainResult["evidenceSummary"];
  readonly brainEvidence: IntegratedBrainResult["evidence"];
  readonly claims: IntegratedBrainResult["claims"];
  readonly whatWeKnow: readonly string[];
  readonly whatWeBelieve: readonly string[];
  readonly whatWeDoNotKnow: readonly UnknownInformation[];
  readonly contradictions: IntegratedBrainResult["contradictions"];
  readonly processFindings: IntegratedBrainResult["processConclusions"];
  readonly rootCauseHypotheses: IntegratedBrainResult["causes"];
  readonly bottlenecks: IntegratedBrainResult["bottlenecks"];
  readonly criticalIssues: IntegratedBrainResult["criticalIssues"];
  readonly detectedOpportunities: IntegratedBrainResult["opportunities"];
  readonly qualifiedOpportunities: readonly IntegratedBrainResult["opportunities"][number][];
  readonly deferredOpportunities: readonly IntegratedBrainResult["opportunities"][number][];
  readonly rejectedOpportunities: readonly IntegratedBrainResult["opportunities"][number][];
  readonly remediationRequired: readonly IntegratedBrainResult["opportunities"][number][];
  readonly economicState: IntegratedBrainResult["economicEvaluation"];
  readonly nextBestActions: readonly string[];
  readonly traceReferences: Readonly<Record<string, readonly string[]>>;
  readonly brain: IntegratedBrainResult;
}

/**
 * Application-only convergence service. Production repositories remain the
 * authority; this service only loads, adapts and returns a read model.
 */
export class RealCompanyBrainOrchestrator {
  private readonly readiness = new IntakeReadinessAssessmentService();
  private readonly evidenceAdapter = new EnterpriseEvidenceAdapter();
  private readonly processAdapter = new ProcessMapAdapter();

  constructor(private readonly ports: RealCompanyBrainPorts) {}

  async run(input: RealCompanyBrainInput): Promise<RealCompanyBrainResult> {
    if (!input.tenantId || !input.companyId) throw new Error("Tenant and company are required");
    const snapshot = await this.ports.load(input);
    if (
      snapshot.company.id !== input.companyId ||
      snapshot.company.organizationId !== input.tenantId
    )
      throw new Error("Company is outside the requested tenant");

    const readiness = this.readiness.assessProduction(snapshot.readinessState, input.tenantId);
    if (readiness.status !== "READY_FOR_BRAIN") return this.emptyResult(input, readiness, snapshot);
    if (input.processMapId && input.processMapId !== snapshot.processMap.id)
      throw new Error("Requested Process Map was not resolved");
    if (snapshot.processMap.status !== "published")
      throw new Error("Only a published Process Map can enter Brain");

    const records = await this.collectEvidence(input, snapshot);
    for (const record of records) {
      if (record.tenantId !== input.tenantId || record.companyId !== input.companyId)
        throw new Error("Evidence is outside the requested company");
    }
    const adapted = this.evidenceAdapter.toBrain(records);
    const process = this.processAdapter.toBrain(snapshot.processMap);
    const brain = (this.ports.pipeline ?? new BrainIntegrationPipeline()).run({
      companyId: input.companyId,
      scenarioId: `company:${input.companyId}`,
      subject: snapshot.company.name,
      evidence: adapted.evidence,
      claims: adapted.claims,
      unknowns: snapshot.unknowns,
      process,
      knowledge: snapshot.knowledge,
      economicInputs: { ...snapshot.economicInputs },
      facts: snapshot.facts,
    });
    return this.toResult(input, readiness, snapshot, brain);
  }

  private async collectEvidence(
    input: RealCompanyBrainInput,
    snapshot: RealCompanyProductionSnapshot,
  ): Promise<readonly EnterpriseEvidenceRecord[]> {
    const records: EnterpriseEvidenceRecord[] = [];
    const adapter = this.ports.aiProvider
      ? new IntakeInterpretationAdapter(this.ports.aiProvider)
      : null;
    for (const source of snapshot.sources) {
      if (source.tenantId !== input.tenantId || source.companyId !== input.companyId)
        throw new Error("Source is outside the requested company");
      if (source.rawText?.trim() && !source.interpreted) {
        if (!adapter || !source.sessionId)
          throw new Error("Raw source requires an E3 provider and session context");
        const result = await adapter.interpret(
          IntakeSource.create({
            sourceId: source.id,
            tenantId: input.tenantId,
            companyId: input.companyId,
            sourceType: "DOCUMENT",
            title: source.id,
            origin: source.sourceReference,
            rawText: source.rawText,
            actorId: source.actorId,
          }),
          IntakeSession.create({
            sessionId: source.sessionId,
            tenantId: input.tenantId,
            companyId: input.companyId,
          }),
        );
        for (const candidate of result.interpretation.candidates) {
          records.push({
            id: candidate.candidateId,
            sourceType: source.sourceType,
            sourceReference: candidate.sourceReference,
            capturedAt: source.capturedAt,
            reliability: source.reliability,
            content: candidate.statement,
            provenance: {
              ...source.provenance,
              sessionId: source.sessionId,
              actorId: source.actorId,
            },
            tenantId: input.tenantId,
            companyId: input.companyId,
            claim: {
              id: candidate.candidateId,
              statement: candidate.statement,
              kind: candidate.candidateType === "UNKNOWN_CANDIDATE" ? "UNKNOWN" : "INFERENCE",
            },
          });
        }
      } else {
        records.push({ ...source });
      }
    }
    return Object.freeze(records);
  }

  private emptyResult(
    input: RealCompanyBrainInput,
    readiness: ProductionReadinessAssessment,
    snapshot: RealCompanyProductionSnapshot,
  ): RealCompanyBrainResult {
    return Object.freeze({
      companyId: input.companyId,
      tenantId: input.tenantId,
      readiness,
      sourceSnapshot: {
        companyId: input.companyId,
        knowledgeSnapshotId: input.knowledgeSnapshotId,
      },
      evidence: { count: 0, ids: [] },
      brainEvidence: [],
      claims: [],
      whatWeKnow: [],
      whatWeBelieve: [],
      whatWeDoNotKnow: snapshot.unknowns,
      contradictions: [],
      processFindings: [],
      rootCauseHypotheses: [],
      bottlenecks: [],
      criticalIssues: [],
      detectedOpportunities: [],
      qualifiedOpportunities: [],
      deferredOpportunities: [],
      rejectedOpportunities: [],
      remediationRequired: [],
      economicState: {
        status: "NEED_MORE_EVIDENCE" as const,
        netAnnualBenefit: null,
        paybackMonths: null,
        roi12: null,
        roi24: null,
        roi36: null,
        confidence: 0,
        missingInputs: ["readiness"],
        signal: "INSUFFICIENT_EVIDENCE" as const,
        rationale: "Canonical production inputs are not ready for Brain execution",
      },
      nextBestActions: [...readiness.criticalGaps],
      traceReferences: {},
      brain: undefined as never,
    });
  }

  private toResult(
    input: RealCompanyBrainInput,
    readiness: ProductionReadinessAssessment,
    snapshot: RealCompanyProductionSnapshot,
    brain: IntegratedBrainResult,
  ): RealCompanyBrainResult {
    const qualified = brain.opportunities.filter(
      (item) => item.status === "QUALIFIED" || item.status === "RECOMMENDED",
    );
    const deferred = brain.opportunities.filter(
      (item) => item.status === "DEFERRED" || item.status === "UNDER_INVESTIGATION",
    );
    const rejected = brain.opportunities.filter((item) => item.status === "REJECTED");
    const remediation = brain.opportunities.filter(
      (item) => item.status === "REMEDIATION_REQUIRED",
    );
    return Object.freeze({
      companyId: input.companyId,
      tenantId: input.tenantId,
      readiness,
      sourceSnapshot: {
        companyId: input.companyId,
        knowledgeSnapshotId: input.knowledgeSnapshotId,
      },
      evidence: brain.evidenceSummary,
      brainEvidence: brain.evidence,
      claims: brain.claims,
      whatWeKnow: brain.claims
        .filter((claim) => claim.kind === "FACT")
        .map((claim) => claim.statement),
      whatWeBelieve: brain.claims
        .filter((claim) => claim.kind !== "FACT")
        .map((claim) => claim.statement),
      whatWeDoNotKnow: brain.unknowns,
      contradictions: brain.contradictions,
      processFindings: brain.processConclusions,
      rootCauseHypotheses: brain.causes,
      bottlenecks: brain.bottlenecks,
      criticalIssues: brain.criticalIssues,
      detectedOpportunities: brain.opportunities,
      qualifiedOpportunities: qualified,
      deferredOpportunities: deferred,
      rejectedOpportunities: rejected,
      remediationRequired: remediation,
      economicState: brain.economicEvaluation,
      nextBestActions: brain.opportunityActions.map((action) => action.nextBestAction),
      traceReferences: Object.freeze({
        evidence: brain.evidenceSummary.ids,
        claims: brain.claims.map((claim) => claim.claimId),
        processMap: [snapshot.processMap.id],
      }),
      brain,
    });
  }
}
