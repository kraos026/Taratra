import { IntakeInterpretationAdapter } from "./intake-interpretation-adapter";
import type { AIProvider } from "../../../brain-evaluation/ai-interpretation-gateway";
import type { EnterpriseEvidenceRecord } from "../../../brain-evaluation/convergence-adapters";
import type { QuestionIntent } from "./adaptive-discovery-production-bridge";
import {
  AdaptiveDiscoveryProductionBridge,
  type AdaptiveDiscoveryPlan,
} from "./adaptive-discovery-production-bridge";
import {
  RealCompanyBrainOrchestrator,
  type RealCompanyBrainInput,
  type RealCompanyBrainResult,
} from "./real-company-brain-orchestrator";
import { IntakeSession, IntakeSource } from "../domain/company-intake";

export type ProductionResponseType = "InterviewAnswer" | "DiscoveryAnswer";

export interface ProductionResponse {
  readonly productionResponseId: string;
  readonly type: ProductionResponseType;
  readonly tenantId: string;
  readonly companyId: string;
  readonly productionQuestionId: string;
  readonly questionText: string;
  readonly rawAnswer: string;
  readonly actorId: string;
  readonly sessionId: string;
  readonly capturedAt: Date;
  readonly reliability: number;
  readonly sourceReference: string;
}

export interface ResponseLineage {
  readonly tenantId: string;
  readonly companyId: string;
  readonly originalBrainRunId: string;
  readonly actionId: string;
  readonly gapId: string;
  readonly questionIntent: QuestionIntent;
  readonly productionQuestionId: string;
  readonly originatingKnowledgeSnapshotId?: string;
  readonly originatingProcessMapId?: string;
  readonly originalResult?: RealCompanyBrainResult;
}

export interface KnowledgeUpdateSummary {
  readonly previousKnowledgeSnapshotId?: string;
  readonly newKnowledgeSnapshotId?: string;
  readonly evidenceIds: readonly string[];
  readonly rawSourceId: string;
}

export interface DiscoveryResponseKnowledgePort {
  loadResponse(
    tenantId: string,
    companyId: string,
    productionResponseId: string,
  ): Promise<ProductionResponse | null>;
  loadLineage(
    tenantId: string,
    companyId: string,
    productionResponseId: string,
  ): Promise<ResponseLineage | null>;
  currentBrainRunId(tenantId: string, companyId: string): Promise<string>;
  integrateKnowledge(input: {
    response: ProductionResponse;
    lineage: ResponseLineage;
    evidence: readonly EnterpriseEvidenceRecord[];
  }): Promise<KnowledgeUpdateSummary>;
  findProcessed(processingId: string): Promise<DiscoveryResponseProcessingResult | null>;
  saveProcessed(processingId: string, result: DiscoveryResponseProcessingResult): Promise<void>;
}

export interface DiscoveryResponseProcessingPorts {
  readonly production: DiscoveryResponseKnowledgePort;
  readonly aiProvider: AIProvider;
  readonly orchestrator: Pick<RealCompanyBrainOrchestrator, "run">;
  readonly discoveryBridge?: Pick<AdaptiveDiscoveryProductionBridge, "plan">;
}

export type GapResolutionState =
  "RESOLVED" | "PARTIALLY_RESOLVED" | "STILL_OPEN" | "NEW_CONTRADICTION" | "NEW_MATERIAL_GAP";

export interface DiscoveryResponseProcessingResult {
  readonly companyId: string;
  readonly tenantId: string;
  readonly originalBrainRunId: string;
  readonly newBrainRunId: string;
  readonly actionId: string;
  readonly gapId: string;
  readonly productionQuestionId: string;
  readonly productionResponseId: string;
  readonly rawAnswer: string;
  readonly e3Candidates: readonly {
    readonly candidateId: string;
    readonly candidateType: string;
    readonly status: string;
  }[];
  readonly knowledgeUpdate: KnowledgeUpdateSummary;
  readonly gapResolution: GapResolutionState;
  readonly contradictionsIntroduced: readonly string[];
  readonly decisionChanges: Readonly<Record<string, boolean>>;
  readonly nextDiscoveryPlan: AdaptiveDiscoveryPlan;
  readonly traceability: Readonly<Record<string, readonly string[]>>;
  readonly staleOrigin: boolean;
}

/**
 * Processes an existing production answer without replacing any production
 * answer, knowledge or Brain lifecycle.
 */
export class DiscoveryResponseProcessor {
  private readonly discoveryBridge: Pick<AdaptiveDiscoveryProductionBridge, "plan">;

  constructor(private readonly ports: DiscoveryResponseProcessingPorts) {
    this.discoveryBridge = ports.discoveryBridge ?? new AdaptiveDiscoveryProductionBridge();
  }

  async process(input: {
    tenantId: string;
    companyId: string;
    productionResponseId: string;
  }): Promise<DiscoveryResponseProcessingResult> {
    const processingId = `${input.tenantId}:${input.companyId}:${input.productionResponseId}`;
    const previous = await this.ports.production.findProcessed(processingId);
    if (previous) return previous;
    const response = await this.ports.production.loadResponse(
      input.tenantId,
      input.companyId,
      input.productionResponseId,
    );
    if (!response) throw new Error("Production response was not found");
    if (response.tenantId !== input.tenantId || response.companyId !== input.companyId)
      throw new Error("Production response is outside the requested company");
    const lineage = await this.ports.production.loadLineage(
      input.tenantId,
      input.companyId,
      input.productionResponseId,
    );
    if (!lineage || lineage.tenantId !== input.tenantId || lineage.companyId !== input.companyId)
      throw new Error("Response lineage is invalid");
    if (lineage.productionQuestionId !== response.productionQuestionId)
      throw new Error("Response does not belong to the approved production question");

    const currentBrainRunId = await this.ports.production.currentBrainRunId(
      input.tenantId,
      input.companyId,
    );
    const staleOrigin = currentBrainRunId !== lineage.originalBrainRunId;
    const interpreted = await new IntakeInterpretationAdapter(this.ports.aiProvider).interpret(
      IntakeSource.create({
        sourceId: response.productionResponseId,
        tenantId: input.tenantId,
        companyId: input.companyId,
        sourceType: response.type === "InterviewAnswer" ? "MANAGER_INTERVIEW" : "OWNER_INPUT",
        title: response.questionText,
        origin: response.sourceReference,
        rawText: response.rawAnswer,
        actorId: response.actorId,
      }),
      IntakeSession.create({
        sessionId: response.sessionId,
        tenantId: input.tenantId,
        companyId: input.companyId,
      }),
    );
    const evidence = this.toEvidence(response, interpreted.interpretation.candidates);
    const knowledgeUpdate = await this.ports.production.integrateKnowledge({
      response,
      lineage,
      evidence,
    });
    const brainInput: RealCompanyBrainInput = {
      tenantId: input.tenantId,
      companyId: input.companyId,
      knowledgeSnapshotId: knowledgeUpdate.newKnowledgeSnapshotId,
      processMapId: lineage.originatingProcessMapId,
    };
    const brain = await this.ports.orchestrator.run(brainInput);
    const nextDiscoveryPlan = await this.discoveryBridge.plan(brain);
    const result: DiscoveryResponseProcessingResult = Object.freeze({
      companyId: input.companyId,
      tenantId: input.tenantId,
      originalBrainRunId: lineage.originalBrainRunId,
      newBrainRunId: brain.brain.scenarioId,
      actionId: lineage.actionId,
      gapId: lineage.gapId,
      productionQuestionId: response.productionQuestionId,
      productionResponseId: response.productionResponseId,
      rawAnswer: response.rawAnswer,
      e3Candidates: Object.freeze(
        interpreted.interpretation.candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          candidateType: candidate.candidateType,
          status: candidate.status,
        })),
      ),
      knowledgeUpdate,
      gapResolution: this.resolveGap(lineage.gapId, brain),
      contradictionsIntroduced: Object.freeze(
        brain.contradictions.map((contradiction) => contradiction.contradictionId),
      ),
      decisionChanges: this.decisionChanges(lineage.originalResult, brain),
      nextDiscoveryPlan,
      traceability: Object.freeze({
        response: [response.productionResponseId],
        question: [response.productionQuestionId],
        action: [lineage.actionId],
        gap: [lineage.gapId],
        evidence: evidence.map((item) => item.id),
      }),
      staleOrigin,
    });
    await this.ports.production.saveProcessed(processingId, result);
    return result;
  }

  private toEvidence(
    response: ProductionResponse,
    candidates: readonly {
      candidateId: string;
      candidateType: string;
      statement: string;
      sourceReference: string;
    }[],
  ): readonly EnterpriseEvidenceRecord[] {
    const records: EnterpriseEvidenceRecord[] = [
      {
        id: `response:${response.productionResponseId}`,
        sourceType: response.type === "InterviewAnswer" ? "INTERVIEW" : "DECLARED",
        sourceReference: response.sourceReference,
        sourceModule: response.type === "InterviewAnswer" ? "interview" : "discovery",
        capturedAt: response.capturedAt,
        reliability: response.reliability,
        content: response.rawAnswer,
        provenance: {
          productionResponseId: response.productionResponseId,
          productionQuestionId: response.productionQuestionId,
          sessionId: response.sessionId,
          actorId: response.actorId,
        },
        tenantId: response.tenantId,
        companyId: response.companyId,
      },
    ];
    return Object.freeze([
      ...records,
      ...candidates.map((candidate) => ({
        id: `candidate:${candidate.candidateId}`,
        sourceType: "INTERVIEW" as const,
        sourceReference: candidate.sourceReference,
        sourceModule: "interview" as const,
        capturedAt: response.capturedAt,
        reliability: response.reliability,
        content: candidate.statement,
        provenance: {
          productionResponseId: response.productionResponseId,
          productionQuestionId: response.productionQuestionId,
        },
        tenantId: response.tenantId,
        companyId: response.companyId,
        claim: {
          id: `claim:${candidate.candidateId}`,
          statement: candidate.statement,
          kind: (candidate.candidateType === "UNKNOWN_CANDIDATE" ? "UNKNOWN" : "INFERENCE") as
            "UNKNOWN" | "INFERENCE",
        },
      })),
    ]);
  }

  private resolveGap(gapId: string, brain: RealCompanyBrainResult): GapResolutionState {
    if (brain.contradictions.length) return "NEW_CONTRADICTION";
    return brain.whatWeDoNotKnow.some((unknown) => `gap:${unknown.unknownId}` === gapId)
      ? "STILL_OPEN"
      : "RESOLVED";
  }

  private decisionChanges(
    previous: RealCompanyBrainResult | undefined,
    current: RealCompanyBrainResult,
  ): Readonly<Record<string, boolean>> {
    if (!previous)
      return Object.freeze({
        rootCause: false,
        bottleneck: false,
        opportunity: false,
        economics: false,
      });
    return Object.freeze({
      rootCause: previous.rootCauseHypotheses.length !== current.rootCauseHypotheses.length,
      bottleneck: previous.bottlenecks.length !== current.bottlenecks.length,
      opportunity: previous.detectedOpportunities.length !== current.detectedOpportunities.length,
      economics: previous.economicState.status !== current.economicState.status,
    });
  }
}
