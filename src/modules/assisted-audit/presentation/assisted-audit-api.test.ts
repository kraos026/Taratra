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

import { withAssistedAuditService } from "./assisted-audit-api";

describe("Assisted Audit authenticated composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user" } }, error: null });
    withAuthenticatedDatabase.mockImplementation(async (_userId, operation) => operation({}));
  });

  it("rejects missing authenticated identity", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });
    const response = await withAssistedAuditService(async () => "unreachable");
    expect((response as Response).status).toBe(401);
    expect(withAuthenticatedDatabase).not.toHaveBeenCalled();
  });

  it("binds the request identity to an authenticated database transaction", async () => {
    await expect(withAssistedAuditService(async () => "ok")).resolves.toBe("ok");
    expect(withAuthenticatedDatabase).toHaveBeenCalledWith("user", expect.any(Function));
  });

  it("masks unexpected repository errors", async () => {
    const response = await withAssistedAuditService(async () => {
      throw new Error("secret database details");
    });
    expect((response as Response).status).toBe(500);
    await expect((response as Response).json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "Unexpected error" },
    });
  });
});
