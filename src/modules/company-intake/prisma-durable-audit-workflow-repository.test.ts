import { describe, expect, it, vi } from "vitest";
import { PrismaDurableAuditWorkflowRepository } from "./infrastructure/prisma-durable-audit-workflow-repository";
import type { DurableDiscoveryLoopSnapshot } from "./application/durable-audit-workflow";

describe("PrismaDurableAuditWorkflowRepository", () => {
  it("persists loop orchestration with tenant/company scoped durable identity", async () => {
    const upsert = vi.fn().mockImplementation(async (input) => ({
      organizationId: input.create.organizationId,
      companyId: input.create.companyId,
      loopId: input.create.loopId,
      initialBrainRunId: input.create.initialBrainRunId,
      currentBrainRunId: input.create.currentBrainRunId,
      iterationNumber: input.create.iterationNumber,
      materialGapIdsJson: input.create.materialGapIdsJson,
      resolvedGapIdsJson: input.create.resolvedGapIdsJson,
      openGapIdsJson: input.create.openGapIdsJson,
      pendingActionIdsJson: input.create.pendingActionIdsJson,
      approvedActionIdsJson: input.create.approvedActionIdsJson,
      executedActionIdsJson: input.create.executedActionIdsJson,
      rejectedActionIdsJson: input.create.rejectedActionIdsJson,
      stoppingState: input.create.stoppingState,
      remainingQuestionBudget: input.create.remainingQuestionBudget,
      canonicalRefsJson: input.create.canonicalRefsJson,
      status: input.create.status,
      lockVersion: input.create.lockVersion,
    }));
    const repository = new PrismaDurableAuditWorkflowRepository({
      auditDiscoveryLoopRecord: { upsert },
    } as never);

    const saved = await repository.saveLoop(loop());

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_companyId_loopId: {
            organizationId: "tenant-a",
            companyId: "company-a",
            loopId: "loop-a",
          },
        },
      }),
    );
    expect(saved.canonicalRefs).toEqual({ knowledgeSnapshotId: "knowledge-1" });
  });

  it("persists action executions idempotently by tenant/company/execution id", async () => {
    const upsert = vi.fn().mockImplementation(async (input) => ({
      organizationId: input.create.organizationId,
      companyId: input.create.companyId,
      executionId: input.create.executionId,
      brainRunId: input.create.brainRunId,
      actionId: input.create.actionId,
      status: input.create.status,
      originalQuestionIntentJson: input.create.originalQuestionIntentJson,
    }));
    const repository = new PrismaDurableAuditWorkflowRepository({
      auditDiscoveryActionExecutionRecord: { upsert },
    } as never);

    await repository.saveActionExecution(
      {
        executionId: "tenant-a:company-a:brain-1:action-1",
        tenantId: "tenant-a",
        companyId: "company-a",
        brainRunId: "brain-1",
        actionId: "action-1",
        status: "EXECUTED",
        originalQuestionIntent: questionIntent(),
      },
      { knowledgeSnapshotId: "knowledge-1" },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_companyId_executionId: {
            organizationId: "tenant-a",
            companyId: "company-a",
            executionId: "tenant-a:company-a:brain-1:action-1",
          },
        },
      }),
    );
  });

  it("lists evidence requests only through tenant/company scope", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaDurableAuditWorkflowRepository({
      auditEvidenceAcquisitionRequestRecord: { findMany },
    } as never);

    await repository.listEvidenceRequests({ tenantId: "tenant-a", companyId: "company-a" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "tenant-a", companyId: "company-a" },
      }),
    );
  });
});

function loop(): DurableDiscoveryLoopSnapshot {
  return Object.freeze({
    tenantId: "tenant-a",
    companyId: "company-a",
    loopId: "loop-a",
    initialBrainRunId: "brain-1",
    currentBrainRunId: "brain-1",
    iterationNumber: 0,
    materialGapIds: ["gap-1"],
    resolvedGapIds: [],
    openGapIds: ["gap-1"],
    pendingRecommendedActionIds: ["action-1"],
    approvedActionIds: [],
    executedActionIds: [],
    rejectedActionIds: [],
    stoppingState: "CONTINUE_DISCOVERY",
    remainingQuestionBudget: 3,
    status: "ACTIVE",
    canonicalRefs: { knowledgeSnapshotId: "knowledge-1" },
    lockVersion: 1,
  });
}

function questionIntent() {
  return {
    gapId: "gap-1",
    targetSource: "MANAGER_INTERVIEW" as const,
    businessConcept: "approval delay",
    reason: "unknown",
    expectedEvidenceType: "INTERVIEW" as const,
    materiality: "HIGH" as const,
    decisionBlocked: true,
    traceability: {
      companyId: "company-a",
      tenantId: "tenant-a",
      unknownIds: [],
      contradictionIds: [],
      evidenceIds: [],
      affectedDecisionIds: [],
    },
  };
}
