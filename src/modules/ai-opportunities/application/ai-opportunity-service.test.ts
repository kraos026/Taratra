import { describe, expect, it, vi } from "vitest";
import type { PrismaAiOpportunityRepository } from "../infrastructure/prisma-ai-opportunity-repository";
import { AiOpportunityService } from "./ai-opportunity-service";
function subject(role = "consultant") {
  const repo = {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role }),
    input: vi.fn().mockResolvedValue(null),
    analysis: vi.fn().mockResolvedValue(null),
    snapshot: vi.fn().mockResolvedValue({
      id: "snapshot",
      lockVersion: 2,
      businessAnalysisId: "analysis",
      companyId: "company",
    }),
    detail: vi.fn().mockResolvedValue({
      opportunities: [],
      capabilities: [],
      evidence: [],
      scores: [],
      validations: [],
    }),
    transition: vi.fn(),
    list: vi.fn(),
  };
  return {
    repo,
    service: new AiOpportunityService(repo as unknown as PrismaAiOpportunityRepository, "user"),
  };
}
describe("AiOpportunityService", () => {
  it("requires published Business Analysis", async () =>
    await expect(subject().service.detect("analysis")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    }));
  it("prevents viewers from detecting", async () =>
    await expect(subject("viewer").service.detect("analysis")).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
  it("returns conflict for stale rebuild locks", async () =>
    await expect(subject().service.rebuild("snapshot", 1)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    }));
  it("reserves publication for owner and admin", async () =>
    await expect(subject().service.publish("snapshot", 2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
});
