import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RECOVERY_INSTRUCTIONS,
  SIGNUP_INSTRUCTIONS,
  replacePassword,
  requestPasswordRecovery,
} from "./password-recovery";

function client(error: { status?: number; message?: string } | null = null) {
  const auth = {
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ error }),
  };
  return { auth, port: { auth } as unknown as SupabaseClient };
}
describe("password recovery", () => {
  it("does not claim a confirmation email was sent at signup", () => {
    expect(SIGNUP_INSTRUCTIONS).toContain("Si cette adresse");
    expect(SIGNUP_INSTRUCTIONS).toContain("déjà un compte");
  });
  it.each([null, { status: 400, message: "user does not exist" }])(
    "keeps account-specific outcomes neutral: %j",
    async (error) => {
      const c = client(error);
      expect(
        await requestPasswordRecovery(c.port, " a@example.invalid ", "https://preview.example"),
      ).toBe(RECOVERY_INSTRUCTIONS);
      expect(c.auth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.invalid", {
        redirectTo: "https://preview.example/auth/callback?next=/reset-password",
      });
    },
  );
  it("reports rate limiting without provider details", async () => {
    expect(
      await requestPasswordRecovery(
        client({ status: 429, message: "private" }).port,
        "a@b.invalid",
        "https://preview.example",
      ),
    ).toContain("Trop de demandes");
  });
  it("reports provider outage without claiming delivery", async () => {
    expect(
      await requestPasswordRecovery(
        client({ status: 503 }).port,
        "a@b.invalid",
        "https://preview.example",
      ),
    ).toContain("Service indisponible");
  });
  it("handles network errors safely", async () => {
    const c = client();
    c.auth.resetPasswordForEmail.mockRejectedValue(new Error("private"));
    expect(
      await requestPasswordRecovery(c.port, "a@b.invalid", "https://preview.example"),
    ).toContain("Connexion indisponible");
  });
  it.each([
    ["short", "short"],
    ["long-password", "different"],
  ])("rejects invalid passwords before any remote call", async (password, confirmation) => {
    const c = client();
    expect((await replacePassword(c.port, password, confirmation)).success).toBe(false);
    expect(c.auth.getUser).not.toHaveBeenCalled();
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });
  it("refuses password mutation without a verified user", async () => {
    const c = client();
    c.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await replacePassword(c.port, "long-password", "long-password")).success).toBe(false);
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });
  it("changes only the authenticated user's password", async () => {
    const c = client();
    expect((await replacePassword(c.port, "long-password", "long-password")).success).toBe(true);
    expect(c.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "long-password" });
  });
  it("does not expose update errors", async () => {
    const result = await replacePassword(
      client({ message: "private" }).port,
      "long-password",
      "long-password",
    );
    expect(result.success).toBe(false);
    expect(result.message).not.toContain("private");
  });
});
