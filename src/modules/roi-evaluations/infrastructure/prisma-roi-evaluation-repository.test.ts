import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { RoiConflictError } from "../application/roi-errors";
import {
  prepareRoiPersistencePlan,
  PrismaRoiEvaluationRepository,
  readFrozenAssumptions,
} from "./prisma-roi-evaluation-repository";

describe("ROI frozen assumption provenance", () => {
  it("restores known zero and unknown as distinct values", () => {
    expect(
      readFrozenAssumptions({
        assumptionInputs: [
          { code: "maintenance_cost", status: "known", value: 0 },
          { code: "training_cost", status: "unknown" },
        ],
      }),
    ).toEqual({
      suppliedAssumptions: { maintenance_cost: 0 },
      unknownAssumptions: ["training_cost"],
    });
  });

  it("rejects malformed or unknown frozen assumption records", () => {
    expect(
      readFrozenAssumptions({
        assumptionInputs: [{ code: "not_a_real_assumption", status: "unknown" }],
      }),
    ).toBeNull();
    expect(
      readFrozenAssumptions({
        assumptionInputs: [{ code: "maintenance_cost", status: "known" }],
      }),
    ).toBeNull();
  });
});

const persistenceInput = {
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
  suppliedAssumptions: { maintenance_cost: 0 },
  unknownAssumptions: ["training_cost" as const],
  opportunities: [],
  models: [],
  assumptions: [],
};
const persistenceResult = {
  scenarios: [],
  validations: [{ code: "unknown_assumption", severity: "error" as const, message: "Missing" }],
  catalogVersions: { models: [], assumptions: [] },
};

function persistenceDatabase(latest: {
  id: string;
  versionNumber: number;
  lockVersion: number;
  status: "draft";
}) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    roiEvaluationSnapshot: {
      findFirst: vi.fn().mockResolvedValue(latest),
      create: vi.fn().mockResolvedValue({
        id: "roi-v2",
        previousVersionId: "roi-v1",
        versionNumber: 2,
        status: "draft",
      }),
    },
    roiValidation: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as TransactionClient;
}

describe("ROI revision lineage concurrency", () => {
  it("creates the next immutable version from the exact expected predecessor", async () => {
    const db = persistenceDatabase({
      id: "roi-v1",
      versionNumber: 1,
      lockVersion: 1,
      status: "draft",
    });
    const result = await new PrismaRoiEvaluationRepository(db).persist(
      "organization",
      "company",
      "actor",
      persistenceInput,
      persistenceResult,
      "roi-v1",
      1,
      "draft",
    );
    expect(result).toMatchObject({ id: "roi-v2", previousVersionId: "roi-v1", versionNumber: 2 });
    expect(db.roiEvaluationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previousVersionId: "roi-v1", versionNumber: 2 }),
      }),
    );
  });

  it("rejects a concurrent revision after another version has won", async () => {
    const db = persistenceDatabase({
      id: "roi-v2",
      versionNumber: 2,
      lockVersion: 1,
      status: "draft",
    });
    await expect(
      new PrismaRoiEvaluationRepository(db).persist(
        "organization",
        "company",
        "actor",
        persistenceInput,
        persistenceResult,
        "roi-v1",
        1,
        "draft",
      ),
    ).rejects.toBeInstanceOf(RoiConflictError);
    expect(db.roiEvaluationSnapshot.create).not.toHaveBeenCalled();
  });
});

const completePersistenceInput = {
  ...persistenceInput,
  opportunities: [
    {
      id: "opportunity",
      identifier: "invoice",
      title: "Invoice automation",
      description: "Automate invoices",
      automationCoverage: 80,
      confidence: 80,
      evidence: [
        { id: "automation-evidence", businessFindingId: "finding", knowledgeFactId: "fact" },
      ],
      aiOpportunityIds: ["ai-opportunity"],
    },
  ],
  assumptions: [
    {
      id: "hourly_cost",
      code: "hourly_cost" as const,
      version: 1,
      unit: "currency/hour",
      defaultValue: null,
      required: true,
    },
  ],
};

const completePersistenceResult = {
  catalogVersions: {
    models: [{ id: "model", code: "automation_economic_impact", version: 1 }],
    assumptions: [{ id: "hourly_cost", code: "hourly_cost" as const, version: 1 }],
  },
  validations: [{ code: "roi_valid", severity: "information" as const, message: "Valid" }],
  scenarios: [
    {
      type: "expected" as const,
      volumeFactor: 1,
      costFactor: 1,
      model: {
        id: "model",
        code: "automation_economic_impact",
        version: 1,
        formula: { type: "documented" },
        requiredInputs: ["hourly_cost"],
        outputs: [],
      },
      assumptions: [
        {
          definition: completePersistenceInput.assumptions[0]!,
          value: 50,
          source: "provided" as const,
        },
      ],
      evaluations: [
        {
          opportunity: completePersistenceInput.opportunities[0]!,
          confidence: 90,
          contributions: [
            {
              assumption: completePersistenceInput.assumptions[0]!,
              inputValue: 50,
              contribution: 50,
              calculation: { source: "provided" },
            },
          ],
          metrics: [
            {
              code: "annual_benefit",
              value: 1000,
              specialValue: null,
              unit: "currency/year",
              calculation: { formula: "test" },
            },
          ],
        },
      ],
    },
  ],
};

function batchDatabase() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    roiEvaluationSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: data.id,
          previousVersionId: data.previousVersionId,
          versionNumber: data.versionNumber,
          status: "draft",
        }),
      ),
    },
    roiScenario: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    roiScenarioAssumption: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    roiEvaluation: {
      create: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    roiContribution: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    roiMetric: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    roiEvidence: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    roiValidation: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as TransactionClient;
}

describe("ROI batched persistence plan", () => {
  it("pre-generates snapshot, scenario, and evaluation IDs while preserving child lineage", () => {
    const plan = prepareRoiPersistencePlan(
      "organization",
      completePersistenceInput,
      completePersistenceResult,
    );

    expect(plan.scenarioRows).toHaveLength(1);
    expect(plan.assumptionRows).toHaveLength(1);
    expect(plan.evaluationRows).toHaveLength(1);
    expect(plan.contributionRows).toHaveLength(1);
    expect(plan.metricRows).toHaveLength(1);
    expect(plan.evidenceRows).toHaveLength(1);
    expect(plan.validationRows).toHaveLength(1);
    expect(plan.scenarioRows[0]!.snapshotId).toBe(plan.snapshotId);
    expect(plan.evaluationRows[0]!.snapshotId).toBe(plan.snapshotId);
    expect(plan.evaluationRows[0]!.scenarioId).toBe(plan.scenarioRows[0]!.id);
    expect(plan.metricRows[0]!.evaluationId).toBe(plan.evaluationRows[0]!.id);
    expect(plan.contributionRows[0]!.evaluationId).toBe(plan.evaluationRows[0]!.id);
    expect(plan.evidenceRows[0]!.evaluationId).toBe(plan.evaluationRows[0]!.id);
    expect(plan.provenanceJson).toMatchObject({
      automationOpportunitySnapshotId: "automation",
      aiOpportunitySnapshotId: "ai",
      businessAnalysisId: "analysis",
      processMapId: "process",
      knowledgeSnapshotId: "knowledge",
    });
  });

  it("persists prepared children through bounded createMany batches", async () => {
    const db = batchDatabase();
    const plan = prepareRoiPersistencePlan(
      "organization",
      completePersistenceInput,
      completePersistenceResult,
    );

    await new PrismaRoiEvaluationRepository(db).persistPrepared(
      "organization",
      "company",
      "actor",
      completePersistenceInput,
      plan,
      null,
    );

    expect(db.roiEvaluationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: plan.snapshotId }) }),
    );
    expect(db.roiScenario.createMany).toHaveBeenCalledWith({ data: plan.scenarioRows });
    expect(db.roiScenarioAssumption.createMany).toHaveBeenCalledWith({
      data: plan.assumptionRows,
    });
    expect(db.roiEvaluation.createMany).toHaveBeenCalledWith({ data: plan.evaluationRows });
    expect(db.roiEvaluation.create).not.toHaveBeenCalled();
    expect(db.roiContribution.createMany).toHaveBeenCalledWith({ data: plan.contributionRows });
    expect(db.roiMetric.createMany).toHaveBeenCalledWith({ data: plan.metricRows });
    expect(db.roiEvidence.createMany).toHaveBeenCalledWith({ data: plan.evidenceRows });
    expect(db.roiValidation.createMany).toHaveBeenCalledWith({ data: plan.validationRows });
  });

  it("propagates a child batch failure so the outer transaction can roll back atomically", async () => {
    const db = batchDatabase();
    db.roiMetric.createMany = vi.fn().mockRejectedValue(new Error("metric batch failed"));
    const plan = prepareRoiPersistencePlan(
      "organization",
      completePersistenceInput,
      completePersistenceResult,
    );

    await expect(
      new PrismaRoiEvaluationRepository(db).persistPrepared(
        "organization",
        "company",
        "actor",
        completePersistenceInput,
        plan,
        null,
      ),
    ).rejects.toThrow("metric batch failed");
    expect(db.roiValidation.createMany).not.toHaveBeenCalled();
  });
});
