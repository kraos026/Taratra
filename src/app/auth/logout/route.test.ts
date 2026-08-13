import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/server", () => ({ createClient }));

import { POST } from "./route";

describe("POST /auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
    createClient.mockResolvedValue({ auth: { signOut } });
  });

  it("terminates the current session and redirects to login", async () => {
    const response = await POST(new Request("https://app.example/auth/logout", { method: "POST" }));
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example/login");
  });
});
