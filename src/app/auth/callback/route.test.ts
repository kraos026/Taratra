import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}));
import { GET } from "./route";

describe("auth callback return destination", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    verifyOtp.mockReset().mockResolvedValue({ error: null });
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "/\t/evil.example"])(
    "rejects external or ambiguous destination %s",
    async (next) => {
      const response = await GET(request(next));
      expect(response.headers.get("location")).toBe("https://optivos.example/onboarding");
    },
  );

  it("preserves a local path and query after a successful exchange", async () => {
    const response = await GET(request("/companies?view=active"));
    expect(response.headers.get("location")).toBe("https://optivos.example/companies?view=active");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
  });

  it("does not follow next when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "private provider detail" } });
    const response = await GET(request("/companies"));
    expect(response.headers.get("location")).toBe(
      "https://optivos.example/signup?error=confirmation",
    );
  });
  it("routes a valid recovery exchange to the authenticated password form", async () => {
    expect((await GET(request("/reset-password"))).headers.get("location")).toBe(
      "https://optivos.example/reset-password",
    );
  });
  it.each(["invalid", "network"])("offers recovery again for %s exchanges", async (failure) => {
    if (failure === "network") exchangeCodeForSession.mockRejectedValue(new Error("private"));
    else exchangeCodeForSession.mockResolvedValue({ error: { message: "private" } });
    expect((await GET(request("/reset-password"))).headers.get("location")).toBe(
      "https://optivos.example/forgot-password?error=recovery",
    );
  });

  it.each(["email", "recovery"])(
    "verifies %s without a PKCE cookie in a new browser",
    async (type) => {
      const response = await GET(tokenRequest(type));
      expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: "test-token-hash" });
      expect(exchangeCodeForSession).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        `https://optivos.example/${type === "recovery" ? "reset-password" : "onboarding"}`,
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    },
  );

  it.each(["email", "recovery"])("fails closed for an invalid %s token", async (type) => {
    verifyOtp.mockResolvedValue({ error: { message: "private token detail" } });
    const response = await GET(tokenRequest(type));
    expect(response.headers.get("location")).toBe(
      `https://optivos.example/${type === "recovery" ? "forgot-password?error=recovery" : "signup?error=confirmation"}`,
    );
    expect(await response.text()).not.toContain("private");
  });

  it("handles verification exceptions without exposing tokens", async () => {
    verifyOtp.mockRejectedValue(new Error("test-token-hash"));
    const response = await GET(tokenRequest("email"));
    expect(response.headers.get("location")).toBe(
      "https://optivos.example/signup?error=confirmation",
    );
    expect(await response.text()).not.toContain("test-token-hash");
  });

  it.each([
    "",
    "?token_hash=test-token-hash",
    "?type=email",
    "?token_hash=&type=email",
    "?token_hash=test-token-hash&type=invite",
    "?token_hash=test-token-hash&type=magiclink",
    "?token_hash=test-token-hash&type=email&code=test-code",
    "?token_hash=test-token-hash&type=email&type=recovery",
    "?code=a&code=b",
  ])("rejects missing or ambiguous credentials %s", async (query) => {
    const response = await GET(new Request(`https://optivos.example/auth/callback${query}`));
    expect(response.headers.get("location")).toBe(
      "https://optivos.example/signup?error=confirmation",
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/companies?token_hash=private",
  ])("rejects unsafe token-flow next %s", async (next) => {
    const response = await GET(tokenRequest("email", next));
    expect(response.headers.get("location")).toBe("https://optivos.example/onboarding");
  });
  it("keeps recovery on its password form regardless of next", async () => {
    expect((await GET(tokenRequest("recovery", "//evil.example"))).headers.get("location")).toBe(
      "https://optivos.example/reset-password",
    );
  });
});

function tokenRequest(type: string, next?: string) {
  const url = new URL("https://optivos.example/auth/callback");
  url.searchParams.set("token_hash", "test-token-hash");
  url.searchParams.set("type", type);
  if (next) url.searchParams.set("next", next);
  return new Request(url);
}

function request(next: string) {
  const url = new URL("https://optivos.example/auth/callback");
  url.searchParams.set("code", "test-code");
  url.searchParams.set("next", next);
  return new Request(url);
}
