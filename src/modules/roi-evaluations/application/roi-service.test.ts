import { describe, expect, it, vi } from "vitest";
import type { PrismaRoiEvaluationRepository } from "../infrastructure/prisma-roi-evaluation-repository";
import { RoiValidationError } from "./roi-errors";
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
