import { describe, expect, it, vi } from "vitest";
import type { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";
import { EnterpriseKnowledgeService } from "./enterprise-knowledge-service";

describe("EnterpriseKnowledgeService", () => {
  it("rejects viewers", async () => {
    const repository = { context: vi.fn().mockResolvedValue({ role: "viewer" }) };
    await expect(
      new EnterpriseKnowledgeService(
        repository as unknown as PrismaKnowledgeRepository,
        "user",
      ).build("company"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires validated Discovery input", async () => {
    const repository = {
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "consultant" }),
      inputs: vi.fn().mockResolvedValue({ discovery: null, interview: null }),
    };
    await expect(
      new EnterpriseKnowledgeService(
        repository as unknown as PrismaKnowledgeRepository,
        "user",
      ).build("company"),
    ).rejects.toMatchObject({ code: "DISCOVERY_REQUIRED" });
  });
});
