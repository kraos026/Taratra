import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, createClient } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/server", () => ({ createClient }));
vi.mock("@/shared/infrastructure/logger", () => ({ logError: vi.fn() }));

import { authenticateApiRequest } from "./authenticated-api";

describe("authenticateApiRequest", () => {
  beforeEach(() => {
    createClient.mockReset();
    getClaims.mockReset();
  });

  it("returns the authenticated Supabase subject", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    createClient.mockResolvedValue({ auth: { getClaims } });
    await expect(authenticateApiRequest("test")).resolves.toEqual({ userId: "user-1" });
  });

  it("returns a valid JSON 401 response for an absent identity", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "invalid" } });
    createClient.mockResolvedValue({ auth: { getClaims } });
    const result = await authenticateApiRequest("test");
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("returns a valid JSON 503 response when Supabase configuration fails", async () => {
    createClient.mockRejectedValue(new Error("missing configuration"));
    const result = await authenticateApiRequest("test");
    expect(result.response?.headers.get("content-type")).toContain("application/json");
    expect(result.response?.status).toBe(503);
    await expect(result.response?.json()).resolves.toMatchObject({
      error: { code: "AUTH_SERVICE_UNAVAILABLE" },
    });
  });
});
