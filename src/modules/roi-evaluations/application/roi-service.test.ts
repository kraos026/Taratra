import { describe, expect, it, vi } from "vitest";
import type { PrismaRoiEvaluationRepository } from "../infrastructure/prisma-roi-evaluation-repository";
import type { RoiEvaluationEngine } from "../domain/roi-engine";
import { RoiConflictError, RoiForbiddenError, RoiValidationError } from "./roi-errors";
import { RoiEvaluationService } from "./roi-service";

function repositoryWithUnknownValidation() {
  return {
    context: vi.fn().mockResolvedValue({ organizationId: "organization", role: "owner" }),
    detail: vi.fn().mockResolvedValue({
      validations: [
        { code: "unknown_assumption", severity: "error", message: "Missing assumptions" },
      ],
      scenarios: [],
      evaluations: [],
      metrics: [],
      evidence: [],
    }),
    transition: vi.fn(),
  } as unknown as PrismaRoiEvaluationRepository;
}

describe("ROI incomplete publication safety", () => {
  it("does not validate an ROI with unknown assumptions", async () => {
    const repository = repositoryWithUnknownValidation();
    const service = new RoiEvaluationService(repository, "owner");
    await expect(service.validate("roi", 1)).rejects.toBeInstanceOf(RoiValidationError);
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it("does not publish an ROI with unknown assumptions", async () => {
    const repository = repositoryWithUnknownValidation();
    const service = new RoiEvaluationService(repository, "owner");
    await expect(service.publish("roi", 1)).rejects.toBeInstanceOf(RoiValidationError);
    expect(repository.transition).not.toHaveBeenCalled();
  });
});

function revisionFixture(status = "draft", role = "consultant") {
  const current = {
    id: "roi-v1",
    companyId: "company",
    automationOpportunitySnapshotId: "automation",
    status,
    lockVersion: 1,
  };
  const repository = {
    context: vi.fn().mockResolvedValue({ organizationId: "organization", role }),
    snapshot: vi.fn().mockResolvedValue(current),
    input: vi.fn().mockResolvedValue({ source: "canonical-input" }),
    persist: vi.fn().mockResolvedValue({
      id: "roi-v2",
      previousVersionId: "roi-v1",
      versionNumber: 2,
      status: "draft",
    }),
  } as unknown as PrismaRoiEvaluationRepository;
  const engine = {
    evaluate: vi.fn().mockReturnValue({ scenarios: [], validations: [] }),
  } as unknown as RoiEvaluationEngine;
  return { current, repository, engine };
}

const revisionRequest = {
  lockVersion: 1,
  currency: "EUR",
  suppliedAssumptions: { maintenance_cost: 0 },
  unknownAssumptions: ["training_cost" as const],
};

describe("ROI draft revision", () => {
  it("creates a linked draft version without mutating the existing ROI", async () => {
    const { current, repository, engine } = revisionFixture();
    const before = structuredClone(current);
    const result = await new RoiEvaluationService(repository, "consultant", engine).revise(
      "roi-v1",
      revisionRequest,
    );
    expect(result).toMatchObject({
      id: "roi-v2",
      previousVersionId: "roi-v1",
      versionNumber: 2,
      status: "draft",
    });
    expect(current).toEqual(before);
    expect(repository.input).toHaveBeenCalledWith(
      "organization",
      "automation",
      "EUR",
      { maintenance_cost: 0 },
      ["training_cost"],
    );
    expect(repository.persist).toHaveBeenCalledWith(
      "organization",
      "company",
      "consultant",
      { source: "canonical-input" },
      { scenarios: [], validations: [] },
      "roi-v1",
      1,
      "draft",
    );
  });

  it("rejects a stale lock version", async () => {
    const { repository, engine } = revisionFixture();
    await expect(
      new RoiEvaluationService(repository, "consultant", engine).revise("roi-v1", {
        ...revisionRequest,
        lockVersion: 2,
      }),
    ).rejects.toBeInstanceOf(RoiConflictError);
    expect(repository.persist).not.toHaveBeenCalled();
  });

  it.each(["validated", "published", "archived"])("does not revise a %s ROI", async (status) => {
    const { repository, engine } = revisionFixture(status);
    await expect(
      new RoiEvaluationService(repository, "owner", engine).revise("roi-v1", revisionRequest),
    ).rejects.toBeInstanceOf(RoiValidationError);
    expect(repository.persist).not.toHaveBeenCalled();
  });

  it("denies viewer revisions while preserving consultant access", async () => {
    const { repository, engine } = revisionFixture("draft", "viewer");
    await expect(
      new RoiEvaluationService(repository, "viewer", engine).revise("roi-v1", revisionRequest),
    ).rejects.toBeInstanceOf(RoiForbiddenError);
    expect(repository.persist).not.toHaveBeenCalled();
  });
});
