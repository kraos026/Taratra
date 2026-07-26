import { describe, expect, it, vi } from "vitest";
import type { PrismaProcessMapRepository } from "../infrastructure/prisma-process-map-repository";
import { ProcessMapService } from "./process-map-service";
function subject(role = "consultant") {
  const repo = {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role }),
    knowledge: vi.fn().mockResolvedValue(null),
    map: vi.fn().mockResolvedValue({
      id: "map",
      lockVersion: 2,
      status: "draft",
      validationJson: [],
      companyId: "company",
      processPatternId: "pattern",
    }),
    transition: vi.fn(),
    patterns: vi.fn().mockResolvedValue([]),
    detail: vi.fn(),
    list: vi.fn(),
  };
  return {
    repo,
    service: new ProcessMapService(repo as unknown as PrismaProcessMapRepository, "user"),
  };
}
describe("ProcessMapService", () => {
  it("requires a ready Enterprise Knowledge snapshot", async () =>
    await expect(subject().service.build("snapshot")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    }));
  it("prevents viewers from building", async () =>
    await expect(subject("viewer").service.build("snapshot")).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
  it("returns conflict for stale rebuild locks", async () =>
    await expect(subject().service.rebuild("map", "snapshot", 1)).rejects.toMatchObject({
      code: "CONFLICT",
    }));
  it("reserves publication for owners and admins", async () =>
    await expect(subject("consultant").service.publish("map", 2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
});
