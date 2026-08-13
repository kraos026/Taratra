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

  it("binds the authenticated identity to the database transaction", async () => {
    await expect(withEnterpriseKnowledgeService(async () => "ok")).resolves.toBe("ok");
    expect(withAuthenticatedDatabase).toHaveBeenCalledWith("user-id", expect.any(Function));
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
