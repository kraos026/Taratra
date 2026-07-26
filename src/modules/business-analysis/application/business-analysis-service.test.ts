import { describe, expect, it, vi } from "vitest";
import type { PrismaBusinessAnalysisRepository } from "../infrastructure/prisma-business-analysis-repository";
import { BusinessAnalysisService } from "./business-analysis-service";

function subject(role = "consultant") {
  const repo = {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role }),
    input: vi.fn().mockResolvedValue(null),
    processMap: vi.fn().mockResolvedValue(null),
    analysis: vi.fn().mockResolvedValue({
      id: "analysis",
      processMapId: "map",
      companyId: "company",
      knowledgeSnapshotId: "knowledge",
      lockVersion: 2,
    }),
    detail: vi.fn().mockResolvedValue({
      validations: [],
      findings: [],
      evidence: [],
      scores: [],
    }),
    transition: vi.fn(),
    list: vi.fn(),
  };
  return {
    repo,
    service: new BusinessAnalysisService(
      repo as unknown as PrismaBusinessAnalysisRepository,
      "user",
    ),
  };
}

describe("BusinessAnalysisService", () => {
  it("requires a published Process Map", async () =>
    await expect(subject().service.analyze("map")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    }));
  it("prevents viewers from analyzing", async () =>
    await expect(subject("viewer").service.analyze("map")).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
  it("returns HTTP conflict semantics for a stale rebuild lock", async () =>
    await expect(subject().service.rebuild("analysis", 1)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    }));
  it("reserves publication for owner and admin", async () =>
    await expect(subject("consultant").service.publish("analysis", 2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
});
