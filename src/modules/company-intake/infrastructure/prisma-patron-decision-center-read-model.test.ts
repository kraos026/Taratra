import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/modules/executive-results/application/executive-result-service", () => ({
  ExecutiveResultService: class {
    get = get;
  },
}));
import { PrismaPatronDecisionCenterReadModel } from "./prisma-patron-decision-center-read-model";

describe("decision center company access", () => {
  const db = {
    organizationMember: { findFirst: vi.fn().mockResolvedValue({ organizationId: "org" }) },
  };
  const input = { userId: "user", companyId: "company" };
  it("rejects an inaccessible company instead of returning an empty 200", async () => {
    get.mockResolvedValue(null);
    await expect(
      new PrismaPatronDecisionCenterReadModel(db as unknown as TransactionClient).read(input),
    ).rejects.toMatchObject({ code: "COMPANY_NOT_FOUND", status: 404 });
  });
  it("keeps the intentional unavailable state for an accessible incomplete audit", async () => {
    get.mockResolvedValue({
      company: { id: "company" },
      complete: false,
      audit: { currentStage: "DISCOVERY" },
    });
    expect(
      await new PrismaPatronDecisionCenterReadModel(db as unknown as TransactionClient).read(input),
    ).toBeNull();
  });
  it("does not swallow a runtime failure", async () => {
    get.mockRejectedValue(new Error("P2028"));
    await expect(
      new PrismaPatronDecisionCenterReadModel(db as unknown as TransactionClient).read(input),
    ).rejects.toThrow("P2028");
  });
});
