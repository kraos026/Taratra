import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, getClaims, maybeSingle } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "./proxy";

describe("Supabase auth proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://staging.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    createServerClient.mockReturnValue({
      auth: { getClaims },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    });
  });

  it("redirects unauthenticated protected requests to login", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(request("https://app.example/companies"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login");
  });

  it("allows public login route without a session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(request("https://app.example/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("allows authenticated tenant member access to protected routes", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: { organization_id: "tenant-1" } });

    const response = await updateSession(request("https://app.example/api/companies"));

    expect(response.headers.get("location")).toBeNull();
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it("redirects authenticated users without tenant membership to onboarding", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: null });

    const response = await updateSession(request("https://app.example/api/companies"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/onboarding");
  });
});

function request(url: string): NextRequest {
  return new NextRequest(url);
}
