import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, withAuthenticatedDatabase } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  withAuthenticatedDatabase: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));
vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase,
}));

import { evaluateRoiSnapshot, getRoiEvaluationDetail } from "./roi-api";

describe("ROI Evaluation production composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } }, error: null });
  });

  it("splits ROI input resolution from bounded batched write persistence", async () => {
    const roiInput = {
      automationSnapshotId: "automation",
      automationStatus: "published",
      aiSnapshotId: "ai",
      aiStatus: "published",
      analysisId: "analysis",
      analysisStatus: "published",
      processMapId: "process",
      processMapStatus: "published",
      knowledgeSnapshotId: "knowledge",
      currency: "EUR",
      suppliedAssumptions: {},
      unknownAssumptions: [],
      opportunities: [],
      models: [],
      assumptions: [],
    };
    const readDb = {
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue({ organizationId: "org", role: "owner" }),
      },
      automationOpportunitySnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          id: "automation",
          companyId: "company",
          status: "published",
          aiOpportunitySnapshotId: "ai",
          businessAnalysisId: "analysis",
          processMapId: "process",
          knowledgeSnapshotId: "knowledge",
        }),
      },
      aiOpportunitySnapshot: {
        findFirst: vi.fn().mockResolvedValue({ id: "ai", status: "published" }),
      },
      analysisSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ id: "analysis", status: "published" }),
      },
      processMap: { findFirst: vi.fn().mockResolvedValue({ id: "process", status: "published" }) },
      knowledgeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ id: "knowledge", status: "ready" }),
      },
      automationOpportunity: { findMany: vi.fn().mockResolvedValue([]) },
      automationOpportunityEvidence: { findMany: vi.fn().mockResolvedValue([]) },
      automationOpportunityAiLink: { findMany: vi.fn().mockResolvedValue([]) },
      roiModelCatalog: { findMany: vi.fn().mockResolvedValue([]) },
      roiAssumptionCatalog: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const writeDb = {
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue({ organizationId: "org", role: "owner" }),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
      roiEvaluationSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: data.id, organizationId: data.organizationId, status: "draft" }),
          ),
      },
      roiValidation: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    withAuthenticatedDatabase
      .mockImplementationOnce(async (_userId, operation) => operation(readDb))
      .mockImplementationOnce(async (_userId, operation) => operation(writeDb));

    await expect(
      evaluateRoiSnapshot("automation", {
        currency: "EUR",
        suppliedAssumptions: {},
        unknownAssumptions: [],
      }),
    ).resolves.toMatchObject({ status: "draft" });

    expect(readDb.automationOpportunitySnapshot.findFirst).toHaveBeenCalled();
    expect(writeDb.roiEvaluationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          automationOpportunitySnapshotId: roiInput.automationSnapshotId,
          catalogVersionsJson: { models: [], assumptions: [] },
        }),
      }),
    );
    expect(withAuthenticatedDatabase).toHaveBeenNthCalledWith(1, "user-id", expect.any(Function));
    expect(withAuthenticatedDatabase).toHaveBeenNthCalledWith(2, "user-id", expect.any(Function), {
      timeout: 10_000,
    });
  });

  it("hydrates ROI detail through bounded read batches", async () => {
    const contextDb = {
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue({ organizationId: "org", role: "owner" }),
      },
    };
    const snapshot = { id: "roi", organizationId: "org", status: "published" };
    const snapshotDb = {
      roiEvaluationSnapshot: { findFirst: vi.fn().mockResolvedValue(snapshot) },
    };
    const scenariosDb = {
      roiScenario: { findMany: vi.fn().mockResolvedValue([{ id: "scenario" }]) },
      roiEvaluation: { findMany: vi.fn().mockResolvedValue([{ id: "evaluation" }]) },
    };
    const assumptionsDb = {
      roiScenarioAssumption: { findMany: vi.fn().mockResolvedValue([{ scenarioId: "scenario" }]) },
      roiContribution: { findMany: vi.fn().mockResolvedValue([{ evaluationId: "evaluation" }]) },
    };
    const metricsDb = {
      roiMetric: { findMany: vi.fn().mockResolvedValue([{ evaluationId: "evaluation" }]) },
      roiEvidence: { findMany: vi.fn().mockResolvedValue([{ evaluationId: "evaluation" }]) },
      roiValidation: { findMany: vi.fn().mockResolvedValue([{ code: "roi_valid" }]) },
    };
    withAuthenticatedDatabase
      .mockImplementationOnce(async (_userId, operation) => operation(contextDb))
      .mockImplementationOnce(async (_userId, operation) => operation(snapshotDb))
      .mockImplementationOnce(async (_userId, operation) => operation(scenariosDb))
      .mockImplementationOnce(async (_userId, operation) => operation(assumptionsDb))
      .mockImplementationOnce(async (_userId, operation) => operation(metricsDb));

    await expect(getRoiEvaluationDetail("roi")).resolves.toMatchObject({
      snapshot,
      scenarios: [{ id: "scenario" }],
      evaluations: [{ id: "evaluation" }],
      assumptions: [{ scenarioId: "scenario" }],
      contributions: [{ evaluationId: "evaluation" }],
      metrics: [{ evaluationId: "evaluation" }],
      evidence: [{ evaluationId: "evaluation" }],
      validations: [{ code: "roi_valid" }],
    });

    expect(withAuthenticatedDatabase).toHaveBeenCalledTimes(5);
    for (const call of withAuthenticatedDatabase.mock.calls) {
      expect(call[2]).toEqual({ timeout: 10_000 });
    }
  });
});
