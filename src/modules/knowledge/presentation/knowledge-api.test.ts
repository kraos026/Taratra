import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, withAuthenticatedDatabase } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  withAuthenticatedDatabase: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));
vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase,
}));

import { KnowledgeProjectionError } from "../application/knowledge-errors";
import { withEnterpriseKnowledgeService } from "./knowledge-api";

describe("Enterprise Knowledge production composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } }, error: null });
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) => operation({}));
  });

  it("returns a stable 401 response without an authenticated identity", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid token") });
    const response = await withEnterpriseKnowledgeService(async () => "unreachable");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    await expect((response as Response).json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("does not open a database transaction before the requested operation needs one", async () => {
    await expect(withEnterpriseKnowledgeService(async () => "ok")).resolves.toBe("ok");
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("splits read/projection preparation from the bounded write transaction", async () => {
    const readDb = {
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue({ organizationId: "org", role: "owner" }),
      },
      company: { findFirst: vi.fn().mockResolvedValue({ id: "company" }) },
      discoverySession: {
        findFirst: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          version: 1,
          status: "validated",
          validatedAt: new Date("2026-01-01"),
        }),
      },
      companyProfile: {
        findFirst: vi.fn().mockResolvedValue({
          industry: null,
          countryCode: null,
          employeeCount: null,
          businessModel: null,
          growthStage: null,
        }),
      },
      department: { findMany: vi.fn().mockResolvedValue([]) },
      companyRole: { findMany: vi.fn().mockResolvedValue([]) },
      companySoftware: { findMany: vi.fn().mockResolvedValue([]) },
      businessProcess: { findMany: vi.fn().mockResolvedValue([]) },
      interviewSession: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const writeDb = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      knowledgeSnapshot: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ version: 0 }),
        create: vi.fn().mockResolvedValue({ id: "snapshot", version: 1 }),
        update: vi.fn().mockResolvedValue({
          id: "snapshot",
          organizationId: "org",
          companyId: "company",
          status: "ready",
          version: 1,
        }),
      },
      knowledgeSource: { findMany: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      knowledgeNode: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      knowledgeFact: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      knowledgeEvidence: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      knowledgeRelationship: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    withAuthenticatedDatabase
      .mockImplementationOnce(async (_userId, operation) => operation(readDb))
      .mockImplementationOnce(async (_userId, operation) => operation(writeDb));

    await expect(
      withEnterpriseKnowledgeService((service) => service.build("company")),
    ).resolves.toMatchObject({ snapshot: { id: "snapshot" }, created: true });

    expect(withAuthenticatedDatabase).toHaveBeenNthCalledWith(1, "user-id", expect.any(Function));
    expect(withAuthenticatedDatabase).toHaveBeenNthCalledWith(2, "user-id", expect.any(Function), {
      timeout: 10_000,
    });
    expect(readDb.discoverySession.findFirst).toHaveBeenCalled();
    expect(writeDb.knowledgeSnapshot.update).toHaveBeenCalledWith({
      where: { id: "snapshot", organizationId: "org" },
      data: { status: "ready", generatedAt: expect.any(Date) },
    });
  });

  it("maps authorization errors without exposing internals", async () => {
    const response = await withEnterpriseKnowledgeService(async () => {
      throw new KnowledgeProjectionError("FORBIDDEN", "Knowledge projection is not permitted");
    });
    expect((response as Response).status).toBe(403);
    await expect((response as Response).json()).resolves.toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "Knowledge projection is not permitted" },
    });
  });

  it("masks unexpected persistence errors", async () => {
    const response = await withEnterpriseKnowledgeService(async () => {
      throw new Error("database credentials and stack");
    });
    expect((response as Response).status).toBe(500);
    await expect((response as Response).json()).resolves.toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected error" },
    });
  });
});
