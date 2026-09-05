import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { AssistedAuditError } from "@/modules/assisted-audit/application/assisted-audit-errors";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/modules/assisted-audit/application/assisted-audit-service", () => ({
  AssistedAuditService: class {
    get = get;
  },
}));
import { PrismaExecutiveResultRepository } from "./prisma-executive-result-repository";

describe("executive result error distinction", () => {
  const repo = new PrismaExecutiveResultRepository({} as TransactionClient);
  it("returns absent only for company not found", async () => {
    get.mockRejectedValue(new AssistedAuditError("COMPANY_NOT_FOUND", "not found", 404));
    expect(await repo.read("user", "company")).toBeNull();
  });
  it.each([
    new Error("P2028"),
    new Error("database unavailable"),
    new AssistedAuditError("FORBIDDEN", "denied", 403),
  ])("propagates failures rather than inventing an empty result", async (error) => {
    get.mockRejectedValue(error);
    await expect(repo.read("user", "company")).rejects.toBe(error);
  });
});
