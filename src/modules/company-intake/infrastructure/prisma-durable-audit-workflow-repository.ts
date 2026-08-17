import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { ActionExecutionRecord } from "../application/approved-discovery-action-write-bridge";
import type { QuestionIntent } from "../application/adaptive-discovery-production-bridge";
import type { DiscoveryResponseProcessingResult } from "../application/discovery-response-processing";
import {
  type DurableAuditWorkflowRepository,
  type DurableDiscoveryLoopSnapshot,
  type DurableEvidenceAcquisitionRequest,
  type EvidenceAcquisitionStatus,
  serializeProcessingResult,
} from "../application/durable-audit-workflow";

type LoopRecord = Awaited<ReturnType<TransactionClient["auditDiscoveryLoopRecord"]["findFirst"]>>;
type ActionRecord = Awaited<
  ReturnType<TransactionClient["auditDiscoveryActionExecutionRecord"]["findFirst"]>
>;
type EvidenceRequestRecord = Awaited<
  ReturnType<TransactionClient["auditEvidenceAcquisitionRequestRecord"]["findFirst"]>
>;

export class PrismaDurableAuditWorkflowRepository implements DurableAuditWorkflowRepository {
  constructor(private readonly db: TransactionClient) {}

  async loadLoop(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly loopId: string;
  }): Promise<DurableDiscoveryLoopSnapshot | null> {
    const record = await this.db.auditDiscoveryLoopRecord.findFirst({
      where: {
        organizationId: input.tenantId,
        companyId: input.companyId,
        loopId: input.loopId,
      },
    });
    return record ? toLoop(record) : null;
  }

  async saveLoop(loop: DurableDiscoveryLoopSnapshot): Promise<DurableDiscoveryLoopSnapshot> {
    const data = {
      initialBrainRunId: loop.initialBrainRunId,
      currentBrainRunId: loop.currentBrainRunId,
      iterationNumber: loop.iterationNumber,
      materialGapIdsJson: json(loop.materialGapIds),
      resolvedGapIdsJson: json(loop.resolvedGapIds),
      openGapIdsJson: json(loop.openGapIds),
      pendingActionIdsJson: json(loop.pendingRecommendedActionIds),
      approvedActionIdsJson: json(loop.approvedActionIds),
      executedActionIdsJson: json(loop.executedActionIds),
      rejectedActionIdsJson: json(loop.rejectedActionIds),
      stoppingState: loop.stoppingState,
      remainingQuestionBudget: loop.remainingQuestionBudget,
      canonicalRefsJson: json(loop.canonicalRefs),
      status: loop.status,
      lockVersion: loop.lockVersion,
    };
    const saved = await this.db.auditDiscoveryLoopRecord.upsert({
      where: {
        organizationId_companyId_loopId: {
          organizationId: loop.tenantId,
          companyId: loop.companyId,
          loopId: loop.loopId,
        },
      },
      create: {
        organizationId: loop.tenantId,
        companyId: loop.companyId,
        loopId: loop.loopId,
        ...data,
      },
      update: data,
    });
    return toLoop(saved);
  }

  async saveActionExecution(
    record: ActionExecutionRecord,
    context: Readonly<Record<string, unknown>>,
  ): Promise<ActionExecutionRecord> {
    const data = {
      loopId: loopIdFor(record),
      brainRunId: record.brainRunId,
      actionId: record.actionId,
      status: record.status,
      originalQuestionIntentJson: json(record.originalQuestionIntent),
      approvedQuestionText: record.approvedQuestionText,
      productionReference: record.productionReference,
      executedBy: record.executedBy,
      rejectionReason: record.rejectionReason,
      notes: record.notes,
      authoritativeContextJson: json(context),
    };
    const saved = await this.db.auditDiscoveryActionExecutionRecord.upsert({
      where: {
        organizationId_companyId_executionId: {
          organizationId: record.tenantId,
          companyId: record.companyId,
          executionId: record.executionId,
        },
      },
      create: {
        organizationId: record.tenantId,
        companyId: record.companyId,
        executionId: record.executionId,
        ...data,
      },
      update: data,
    });
    return toActionExecution(saved);
  }

  async findActionExecution(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly executionId: string;
  }): Promise<ActionExecutionRecord | null> {
    const record = await this.db.auditDiscoveryActionExecutionRecord.findFirst({
      where: {
        organizationId: input.tenantId,
        companyId: input.companyId,
        executionId: input.executionId,
      },
    });
    return record ? toActionExecution(record) : null;
  }

  async listActionExecutions(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly loopId: string;
  }): Promise<readonly ActionExecutionRecord[]> {
    const records = await this.db.auditDiscoveryActionExecutionRecord.findMany({
      where: {
        organizationId: input.tenantId,
        companyId: input.companyId,
        loopId: input.loopId,
      },
      orderBy: { createdAt: "asc" },
    });
    return Object.freeze(records.map(toActionExecution));
  }

  async findProcessedResponse(
    processingId: string,
  ): Promise<DiscoveryResponseProcessingResult | null> {
    const record = await this.db.auditDiscoveryResponseProcessingRecord.findFirst({
      where: { processingId },
    });
    return record ? (record.resultJson as unknown as DiscoveryResponseProcessingResult) : null;
  }

  async saveProcessedResponse(
    processingId: string,
    result: DiscoveryResponseProcessingResult,
  ): Promise<void> {
    await this.db.auditDiscoveryResponseProcessingRecord.upsert({
      where: {
        organizationId_companyId_processingId: {
          organizationId: result.tenantId,
          companyId: result.companyId,
          processingId,
        },
      },
      create: {
        organizationId: result.tenantId,
        companyId: result.companyId,
        processingId,
        productionResponseId: result.productionResponseId,
        resultJson: serializeProcessingResult(result),
      },
      update: {
        productionResponseId: result.productionResponseId,
        resultJson: serializeProcessingResult(result),
      },
    });
  }

  async createEvidenceRequest(
    request: DurableEvidenceAcquisitionRequest,
  ): Promise<DurableEvidenceAcquisitionRequest> {
    const data = {
      target: request.target,
      requestedEvidenceType: request.requestedEvidenceType,
      reason: request.reason,
      gapId: request.gapId,
      actionId: request.actionId,
      status: request.status,
      requestedBy: request.requestedBy,
      receivedSourceId: request.receivedSourceId,
      authoritativeContextJson: json(request.authoritativeContext),
    };
    const saved = await this.db.auditEvidenceAcquisitionRequestRecord.upsert({
      where: {
        organizationId_companyId_requestId: {
          organizationId: request.tenantId,
          companyId: request.companyId,
          requestId: request.requestId,
        },
      },
      create: {
        organizationId: request.tenantId,
        companyId: request.companyId,
        requestId: request.requestId,
        ...data,
      },
      update: data,
    });
    return toEvidenceRequest(saved);
  }

  async listEvidenceRequests(input: {
    readonly tenantId: string;
    readonly companyId: string;
  }): Promise<readonly DurableEvidenceAcquisitionRequest[]> {
    const records = await this.db.auditEvidenceAcquisitionRequestRecord.findMany({
      where: { organizationId: input.tenantId, companyId: input.companyId },
      orderBy: { updatedAt: "desc" },
    });
    return Object.freeze(records.map(toEvidenceRequest));
  }

  async updateEvidenceRequestStatus(input: {
    readonly tenantId: string;
    readonly companyId: string;
    readonly requestId: string;
    readonly status: EvidenceAcquisitionStatus;
    readonly receivedSourceId?: string;
  }): Promise<DurableEvidenceAcquisitionRequest> {
    const record = await this.db.auditEvidenceAcquisitionRequestRecord.update({
      where: {
        organizationId_companyId_requestId: {
          organizationId: input.tenantId,
          companyId: input.companyId,
          requestId: input.requestId,
        },
      },
      data: {
        status: input.status,
        receivedSourceId: input.receivedSourceId,
      },
    });
    return toEvidenceRequest(record);
  }
}

function toLoop(record: NonNullable<LoopRecord>): DurableDiscoveryLoopSnapshot {
  return Object.freeze({
    tenantId: record.organizationId,
    companyId: record.companyId,
    loopId: record.loopId,
    initialBrainRunId: record.initialBrainRunId,
    currentBrainRunId: record.currentBrainRunId,
    iterationNumber: record.iterationNumber,
    materialGapIds: stringArray(record.materialGapIdsJson),
    resolvedGapIds: stringArray(record.resolvedGapIdsJson),
    openGapIds: stringArray(record.openGapIdsJson),
    pendingRecommendedActionIds: stringArray(record.pendingActionIdsJson),
    approvedActionIds: stringArray(record.approvedActionIdsJson),
    executedActionIds: stringArray(record.executedActionIdsJson),
    rejectedActionIds: stringArray(record.rejectedActionIdsJson),
    stoppingState: record.stoppingState as DurableDiscoveryLoopSnapshot["stoppingState"],
    remainingQuestionBudget: record.remainingQuestionBudget,
    status: record.status as DurableDiscoveryLoopSnapshot["status"],
    canonicalRefs: objectValue(record.canonicalRefsJson),
    lockVersion: record.lockVersion,
  });
}

function toActionExecution(record: NonNullable<ActionRecord>): ActionExecutionRecord {
  return Object.freeze({
    executionId: record.executionId,
    tenantId: record.organizationId,
    companyId: record.companyId,
    brainRunId: record.brainRunId,
    actionId: record.actionId,
    status: record.status as ActionExecutionRecord["status"],
    originalQuestionIntent: record.originalQuestionIntentJson as unknown as QuestionIntent,
    approvedQuestionText: record.approvedQuestionText ?? undefined,
    productionReference: record.productionReference ?? undefined,
    executedBy: record.executedBy ?? undefined,
    rejectionReason: record.rejectionReason ?? undefined,
    notes: record.notes ?? undefined,
  });
}

function toEvidenceRequest(
  record: NonNullable<EvidenceRequestRecord>,
): DurableEvidenceAcquisitionRequest {
  return Object.freeze({
    requestId: record.requestId,
    tenantId: record.organizationId,
    companyId: record.companyId,
    target: record.target as DurableEvidenceAcquisitionRequest["target"],
    requestedEvidenceType: record.requestedEvidenceType,
    reason: record.reason,
    gapId: record.gapId,
    actionId: record.actionId,
    status: record.status as EvidenceAcquisitionStatus,
    requestedBy: record.requestedBy,
    receivedSourceId: record.receivedSourceId ?? undefined,
    authoritativeContext: objectValue(record.authoritativeContextJson),
  });
}

function loopIdFor(record: ActionExecutionRecord): string {
  return `${record.tenantId}:${record.companyId}:${record.brainRunId}`;
}

function stringArray(value: Prisma.JsonValue): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze(value.filter((item): item is string => typeof item === "string"))
    : Object.freeze([]);
}

function objectValue(value: Prisma.JsonValue): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.freeze({ ...(value as Record<string, unknown>) })
    : Object.freeze({});
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
