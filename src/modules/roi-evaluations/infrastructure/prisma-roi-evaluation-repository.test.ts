import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { RoiConflictError } from "../application/roi-errors";
import {
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
