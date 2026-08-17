import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionExecutionRecord } from "./application/approved-discovery-action-write-bridge";
import {
  DurableAuditWorkflowService,
  type DurableAuditWorkflowRepository,
  type DurableDiscoveryLoopSnapshot,
  type DurableEvidenceAcquisitionRequest,
} from "./application/durable-audit-workflow";
import { ProductionEvidenceIngestionService } from "./application/production-evidence-ingestion";
import type { DiscoveryResponseProcessingResult } from "./application/discovery-response-processing";
import type { RealCompanyBrainResult } from "./application/real-company-brain-orchestrator";

const { planMock } = vi.hoisted(() => ({ planMock: vi.fn() }));

vi.mock("./application/adaptive-discovery-production-bridge", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./application/adaptive-discovery-production-bridge")>();
  return {
    ...actual,
    AdaptiveDiscoveryProductionBridge: vi.fn().mockImplementation(function () {
      return { plan: planMock };
    }),
  };
});

const action = {
  questionId: "action-1",
  targetSource: "MANAGER_INTERVIEW" as const,
  questionIntent: {
    gapId: "gap-1",
    targetSource: "MANAGER_INTERVIEW" as const,
    businessConcept: "approval delay",
    reason: "material uncertainty",
    expectedEvidenceType: "INTERVIEW" as const,
    materiality: "HIGH" as const,
    decisionBlocked: true,
    traceability: {
      companyId: "company-a",
      tenantId: "tenant-a",
      unknownIds: ["unknown-1"],
      contradictionIds: [],
      evidenceIds: [],
      affectedDecisionIds: ["decision-1"],
    },
  },
  whyThisMatters: "Resolve material uncertainty",
  decisionUnlocked: ["decision-1"],
  priority: "HIGH" as const,
  evidenceRequested: "INTERVIEW" as const,
  valueScore: 0.9,
};

describe("DurableAuditWorkflowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planMock.mockResolvedValue(plan([action]));
  });

  it("reconstructs loop state after restart and preserves canonical references only", async () => {
    const repository = new MemoryDurableRepository();
    const first = await new DurableAuditWorkflowService(repository).loadOrResumeLoop({
      tenantId: "tenant-a",
      companyId: "company-a",
      loopId: "loop-a",
      latestBrainResult: brain("brain-1"),
      canonicalRefs: { executiveDecisionViewId: "view-1" },
    });

    const resumed = await new DurableAuditWorkflowService(repository).loadOrResumeLoop({
      tenantId: "tenant-a",
      companyId: "company-a",
      loopId: "loop-a",
      latestBrainResult: brain("brain-2"),
      canonicalRefs: { processMapId: "process-map-1" },
    });

    expect(first.resumed).toBe(false);
    expect(resumed.resumed).toBe(true);
    expect(resumed.loop.initialBrainRunId).toBe("brain-1");
    expect(resumed.loop.currentBrainRunId).toBe("brain-2");
    expect(resumed.loop.canonicalRefs).toMatchObject({
      executiveDecisionViewId: "view-1",
      knowledgeSnapshotId: "knowledge-2",
      processMapIds: ["process-map-2"],
      processMapId: "process-map-1",
    });
  });

  it("remembers rejected actions across restart and filters them from resumed proposals", async () => {
    const repository = new MemoryDurableRepository();
    const service = new DurableAuditWorkflowService(repository);
    await service.loadOrResumeLoop({
      tenantId: "tenant-a",
      companyId: "company-a",
      loopId: "loop-a",
      latestBrainResult: brain("brain-1"),
    });
    await service.rememberRejection({
      tenantId: "tenant-a",
      companyId: "company-a",
      brainRunId: "brain-1",
      actionId: "action-1",
      rejectedBy: "11111111-1111-1111-1111-111111111111",
      reasonCode: "ALREADY_KNOWN",
    });

    const resumed = await new DurableAuditWorkflowService(repository).loadOrResumeLoop({
      tenantId: "tenant-a",
      companyId: "company-a",
      loopId: "loop-a",
      latestBrainResult: brain("brain-2"),
    });

    expect(resumed.loop.pendingRecommendedActionIds).toEqual([]);
    expect(resumed.loop.rejectedActionIds).toEqual(["action-1"]);
  });

  it("stores evidence request lifecycle and duplicate ingestion idempotently", async () => {
    const repository = new MemoryDurableRepository();
    const ingestionRepository = new MemoryEvidenceRepository();
    const service = new DurableAuditWorkflowService(repository);
    const request = await service.requestEvidence({
      tenantId: "tenant-a",
      companyId: "company-a",
      target: "SYSTEM_EVIDENCE",
      requestedEvidenceType: "SYSTEM_RECORD",
      reason: "monthly volume required",
      gapId: "gap-volume",
      actionId: "action-volume",
      requestedBy: "11111111-1111-1111-1111-111111111111",
      authoritativeContext: { brainRunId: "brain-1" },
    });

    const command = {
      tenantId: "tenant-a",
      companyId: "company-a",
      sourceId: "erp-export",
      sourceVersion: 1,
      sourceType: "CSV_EXPORT" as const,
      origin: "upload://erp-export.csv",
      receivedAt: new Date("2026-01-01T00:00:00Z"),
      structured: { columns: ["id"], rows: [{ id: "1" }] },
    };
    const first = await service.provideEvidence({
      tenantId: "tenant-a",
      companyId: "company-a",
      requestId: request.requestId,
      command,
      ingestion: new ProductionEvidenceIngestionService(ingestionRepository),
    });
    const duplicate = await service.provideEvidence({
      tenantId: "tenant-a",
      companyId: "company-a",
      requestId: request.requestId,
      command,
      ingestion: new ProductionEvidenceIngestionService(ingestionRepository),
    });

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(repository.requests.get(request.requestId)?.status).toBe("INGESTED");
    expect(ingestionRepository.sources).toHaveLength(1);
  });
});

function plan(actions: readonly (typeof action)[]) {
  return {
    companyId: "company-a",
    tenantId: "tenant-a",
    brainRunReference: "brain-1",
    contextReferences: {},
    materialGaps: [
      {
        gapId: "gap-1",
        subject: "approval",
        domain: "process",
        description: "unknown approval delay",
        reasonMissing: "missing source",
        affectedClaimIds: [],
        affectedDecisionIds: ["decision-1"],
        affectedTargets: ["decision"],
        materiality: "HIGH",
        urgency: "HIGH",
        confidenceImpact: 0.8,
        requiredEvidenceType: "INTERVIEW",
        preferredSourceType: "manager",
        candidateRespondentRole: "manager",
        resolutionStatus: "OPEN",
      },
    ],
    recommendedActions: actions,
    stoppingReason: "CONTINUE_DISCOVERY",
    readiness: {
      outcome: "CONTINUE_DISCOVERY",
      rationale: "CONTINUE_DISCOVERY",
      blockingGapIds: ["gap-1"],
      declaredUncertaintyGapIds: [],
    },
    remainingQuestionBudget: 3,
  };
}

function brain(scenarioId: string): RealCompanyBrainResult {
  const suffix = scenarioId.endsWith("2") ? "2" : "1";
  return {
    tenantId: "tenant-a",
    companyId: "company-a",
    sourceSnapshot: { companyId: "company-a", knowledgeSnapshotId: `knowledge-${suffix}` },
    traceReferences: { processMap: [`process-map-${suffix}`] },
    brain: { scenarioId },
  } as unknown as RealCompanyBrainResult;
}

class MemoryDurableRepository implements DurableAuditWorkflowRepository {
  loops = new Map<string, DurableDiscoveryLoopSnapshot>();
  actions = new Map<string, ActionExecutionRecord>();
  requests = new Map<string, DurableEvidenceAcquisitionRequest>();

  async loadLoop(input: { tenantId: string; companyId: string; loopId: string }) {
    return this.loops.get(key(input.tenantId, input.companyId, input.loopId)) ?? null;
  }
  async saveLoop(loop: DurableDiscoveryLoopSnapshot) {
    this.loops.set(key(loop.tenantId, loop.companyId, loop.loopId), loop);
    return loop;
  }
  async saveActionExecution(record: ActionExecutionRecord) {
    this.actions.set(record.executionId, record);
    return record;
  }
  async findActionExecution(input: { executionId: string }) {
    return this.actions.get(input.executionId) ?? null;
  }
  async listActionExecutions(input: { tenantId: string; companyId: string }) {
    return [...this.actions.values()].filter(
      (record) => record.tenantId === input.tenantId && record.companyId === input.companyId,
    );
  }
  async findProcessedResponse() {
    return null;
  }
  async saveProcessedResponse(processingId: string, result: DiscoveryResponseProcessingResult) {
    void processingId;
    void result;
  }
  async createEvidenceRequest(request: DurableEvidenceAcquisitionRequest) {
    const existing = this.requests.get(request.requestId);
    if (existing) return existing;
    this.requests.set(request.requestId, request);
    return request;
  }
  async listEvidenceRequests(input: { tenantId: string; companyId: string }) {
    return [...this.requests.values()].filter(
      (request) => request.tenantId === input.tenantId && request.companyId === input.companyId,
    );
  }
  async updateEvidenceRequestStatus(input: {
    tenantId: string;
    companyId: string;
    requestId: string;
    status: DurableEvidenceAcquisitionRequest["status"];
  }) {
    const request = this.requests.get(input.requestId);
    if (!request || request.tenantId !== input.tenantId || request.companyId !== input.companyId)
      throw new Error("Evidence request was not found");
    const updated = Object.freeze({ ...request, status: input.status });
    this.requests.set(input.requestId, updated);
    return updated;
  }
}

class MemoryEvidenceRepository {
  sources: unknown[] = [];
  async isVersionIngested(input: {
    tenantId: string;
    companyId: string;
    sourceId: string;
    sourceVersion: number;
  }) {
    return this.sources.some((source) => JSON.stringify(source).includes(input.sourceId));
  }
  async persistSource(input: unknown) {
    this.sources.push(input);
  }
  async persistEvidence() {}
}

function key(...parts: readonly string[]) {
  return parts.join(":");
}
