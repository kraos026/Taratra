import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));
import { GET } from "./route";

describe("auth callback return destination", () => {
  beforeEach(() => exchangeCodeForSession.mockResolvedValue({ error: null }));

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
});

function request(next: string) {
  const url = new URL("https://optivos.example/auth/callback");
  url.searchParams.set("code", "test-code");
  url.searchParams.set("next", next);
  return new Request(url);
}
