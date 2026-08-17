import type { Prisma } from "@/generated/prisma/client";
import type {
  ActionExecutionRecord,
  RejectDiscoveryActionCommand,
} from "./approved-discovery-action-write-bridge";
import type {
  ClosedLoopStatus,
  ClosedLoopStoppingState,
  DiscoveryLoopState,
} from "./closed-loop-discovery-orchestrator";
import type { DiscoveryResponseProcessingResult } from "./discovery-response-processing";
import type {
  EvidenceAcquisitionRequest,
  IngestProductionEvidenceCommand,
  ProductionEvidenceIngestionResult,
} from "./production-evidence-ingestion";
import { ProductionEvidenceIngestionService } from "./production-evidence-ingestion";
import type { RealCompanyBrainResult } from "./real-company-brain-orchestrator";
import {
  AdaptiveDiscoveryProductionBridge,
  type ProductionDiscoveryTarget,
} from "./adaptive-discovery-production-bridge";

export type EvidenceAcquisitionStatus =
  "REQUESTED" | "RECEIVED" | "INGESTED" | "REJECTED" | "CANCELLED";

export interface DurableDiscoveryLoopSnapshot extends DiscoveryLoopState {
  readonly canonicalRefs: Readonly<Record<string, unknown>>;
  readonly lockVersion: number;
}

export interface DurableEvidenceAcquisitionRequest extends Omit<
  EvidenceAcquisitionRequest,
  "status"
> {
  readonly status: EvidenceAcquisitionStatus;
  readonly requestedBy: string;
  readonly receivedSourceId?: string;
  readonly authoritativeContext: Readonly<Record<string, unknown>>;
}

export interface DurableAuditWorkflowRepository {
  loadLoop(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly loopId: string;
  }): Promise<DurableDiscoveryLoopSnapshot | null>;
  saveLoop(loop: DurableDiscoveryLoopSnapshot): Promise<DurableDiscoveryLoopSnapshot>;
  saveActionExecution(
    record: ActionExecutionRecord,
    context: Readonly<Record<string, unknown>>,
  ): Promise<ActionExecutionRecord>;
  findActionExecution(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly executionId: string;
  }): Promise<ActionExecutionRecord | null>;
  listActionExecutions(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly loopId: string;
  }): Promise<readonly ActionExecutionRecord[]>;
  findProcessedResponse(processingId: string): Promise<DiscoveryResponseProcessingResult | null>;
  saveProcessedResponse(
    processingId: string,
    result: DiscoveryResponseProcessingResult,
  ): Promise<void>;
  createEvidenceRequest(
    request: DurableEvidenceAcquisitionRequest,
  ): Promise<DurableEvidenceAcquisitionRequest>;
  listEvidenceRequests(input: {
    readonly tenantId: string;
    readonly companyId: string;
  }): Promise<readonly DurableEvidenceAcquisitionRequest[]>;
  updateEvidenceRequestStatus(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly requestId: string;
    readonly status: EvidenceAcquisitionStatus;
    readonly receivedSourceId?: string;
  }): Promise<DurableEvidenceAcquisitionRequest>;
}

export interface DurableAuditWorkflowResumeResult {
  readonly loop: DurableDiscoveryLoopSnapshot;
  readonly resumed: boolean;
  readonly staleActionIds: readonly string[];
  readonly alreadyResolvedActionIds: readonly string[];
}

export class DurableAuditWorkflowService {
  private readonly discoveryBridge = new AdaptiveDiscoveryProductionBridge();

  constructor(private readonly repository: DurableAuditWorkflowRepository) {}

  async loadOrResumeLoop(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly loopId: string;
    readonly latestBrainResult: RealCompanyBrainResult;
    readonly maximumQuestions?: number;
    readonly canonicalRefs?: Readonly<Record<string, unknown>>;
  }): Promise<DurableAuditWorkflowResumeResult> {
    const latestPlan = await this.discoveryBridge.plan(input.latestBrainResult, {
      maximumQuestions: input.maximumQuestions ?? 10,
    });
    const existing = await this.repository.loadLoop(input);
    const rejected = existing
      ? new Set(
          (await this.repository.listActionExecutions(input))
            .filter((record) => record.status === "REJECTED")
            .map((record) => record.actionId),
        )
      : new Set<string>();
    const pending = latestPlan.recommendedActions
      .map((action) => action.questionId)
      .filter((id) => !rejected.has(id));
    const snapshot: DurableDiscoveryLoopSnapshot = Object.freeze({
      tenantId: input.tenantId,
      companyId: input.companyId,
      loopId: input.loopId,
      initialBrainRunId: existing?.initialBrainRunId ?? input.latestBrainResult.brain.scenarioId,
      currentBrainRunId: input.latestBrainResult.brain.scenarioId,
      iterationNumber: existing ? existing.iterationNumber + 1 : 0,
      materialGapIds: latestPlan.materialGaps.map((gap) => gap.gapId),
      resolvedGapIds: existing?.resolvedGapIds ?? [],
      openGapIds: latestPlan.materialGaps.map((gap) => gap.gapId),
      pendingRecommendedActionIds: pending,
      approvedActionIds: existing?.approvedActionIds ?? [],
      executedActionIds: existing?.executedActionIds ?? [],
      rejectedActionIds: [...rejected],
      stoppingState: latestPlan.readiness.outcome,
      remainingQuestionBudget: latestPlan.remainingQuestionBudget,
      status: terminal(latestPlan.readiness.outcome, latestPlan.remainingQuestionBudget)
        ? "STOPPED"
        : "ACTIVE",
      canonicalRefs: Object.freeze({
        ...(existing?.canonicalRefs ?? {}),
        ...(input.canonicalRefs ?? {}),
        knowledgeSnapshotId: input.latestBrainResult.sourceSnapshot.knowledgeSnapshotId,
        processMapIds: input.latestBrainResult.traceReferences.processMap,
      }),
      lockVersion: existing ? existing.lockVersion + 1 : 1,
    });
    const saved = await this.repository.saveLoop(snapshot);
    return Object.freeze({
      loop: saved,
      resumed: Boolean(existing),
      staleActionIds: Object.freeze(staleActionIds(existing, saved)),
      alreadyResolvedActionIds: Object.freeze(
        pending.filter((id) => saved.resolvedGapIds.some((gap) => id.includes(gap))),
      ),
    });
  }

  async rememberRejection(command: RejectDiscoveryActionCommand): Promise<ActionExecutionRecord> {
    return this.repository.saveActionExecution(
      {
        executionId: `${command.tenantId}:${command.companyId}:${command.brainRunId}:${command.actionId}`,
        tenantId: command.tenantId,
        companyId: command.companyId,
        brainRunId: command.brainRunId,
        actionId: command.actionId,
        status: "REJECTED",
        originalQuestionIntent: {
          gapId: command.actionId,
          targetSource: "DISCOVERY",
          businessConcept: command.actionId,
          reason: command.reasonCode,
          expectedEvidenceType: "OBSERVATION",
          materiality: "MEDIUM",
          decisionBlocked: false,
          traceability: {
            companyId: command.companyId,
            tenantId: command.tenantId,
            unknownIds: [],
            contradictionIds: [],
            evidenceIds: [],
            affectedDecisionIds: [],
          },
        },
        rejectionReason: command.reasonCode,
        executedBy: command.rejectedBy,
        notes: command.note,
      },
      { rejectionReason: command.reasonCode },
    );
  }

  async requestEvidence(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly target: Extract<
      ProductionDiscoveryTarget,
      "SYSTEM_EVIDENCE" | "KNOWLEDGE_DOCUMENT" | "PROCESS_EVIDENCE"
    >;
    readonly requestedEvidenceType: string;
    readonly reason: string;
    readonly gapId: string;
    readonly actionId: string;
    readonly requestedBy: string;
    readonly authoritativeContext: Readonly<Record<string, unknown>>;
  }): Promise<DurableEvidenceAcquisitionRequest> {
    const requestId = `${input.tenantId}:${input.companyId}:${input.actionId}`;
    return this.repository.createEvidenceRequest(
      Object.freeze({ ...input, requestId, status: "REQUESTED" as const }),
    );
  }

  async provideEvidence(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly requestId: string;
    readonly command: IngestProductionEvidenceCommand;
    readonly ingestion: ProductionEvidenceIngestionService;
  }): Promise<ProductionEvidenceIngestionResult> {
    await this.repository.updateEvidenceRequestStatus({
      tenantId: input.tenantId,
      companyId: input.companyId,
      requestId: input.requestId,
      status: "RECEIVED",
    });
    const result = await input.ingestion.ingest(input.command);
    await this.repository.updateEvidenceRequestStatus({
      tenantId: input.tenantId,
      companyId: input.companyId,
      requestId: input.requestId,
      status: "INGESTED",
    });
    return result;
  }
}

export function serializeProcessingResult(
  result: DiscoveryResponseProcessingResult,
): Prisma.InputJsonValue {
  return {
    ...result,
    brainResult: {
      companyId: result.brainResult.companyId,
      tenantId: result.brainResult.tenantId,
      brain: result.brainResult.brain,
      sourceSnapshot: result.brainResult.sourceSnapshot,
      traceReferences: result.brainResult.traceReferences,
    },
  } as unknown as Prisma.InputJsonValue;
}

function staleActionIds(
  previous: DurableDiscoveryLoopSnapshot | null,
  current: DurableDiscoveryLoopSnapshot,
): readonly string[] {
  if (!previous) return [];
  return previous.pendingRecommendedActionIds.filter(
    (id) =>
      !current.pendingRecommendedActionIds.includes(id) && !current.rejectedActionIds.includes(id),
  );
}

function terminal(state: ClosedLoopStoppingState, budget: number): boolean {
  return (
    state === "READY_FOR_ANALYSIS" || state === "READY_WITH_DECLARED_UNCERTAINTY" || budget <= 0
  );
}

export function isTerminalLoopStatus(status: ClosedLoopStatus): boolean {
  return status === "STOPPED";
}
