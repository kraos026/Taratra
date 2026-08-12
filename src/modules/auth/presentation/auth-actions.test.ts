import { describe, expect, it, vi } from "vitest";
import { loginWithPassword, logoutCurrentSession, type AuthClientPort } from "./auth-actions";

describe("auth actions", () => {
  it("signs in with email and password without tenant-controlled input", async () => {
    const client = authClient();
    await expect(loginWithPassword(client, " user@example.com ", "secret123")).resolves.toEqual({
      success: true,
    });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
    });
  });

  it("rejects missing credentials before Supabase", async () => {
    const client = authClient();
    await expect(loginWithPassword(client, "", "")).resolves.toEqual({
      success: false,
      message: "Email and password are required.",
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("maps invalid credentials to a safe public message", async () => {
    await expect(
      loginWithPassword(authClient({ signInError: true }), "a@b.com", "bad"),
    ).resolves.toEqual({
      success: false,
      message: "Email or password is incorrect.",
    });
  });

  it("terminates only the current Supabase session", async () => {
    const client = authClient();
    await expect(logoutCurrentSession(client)).resolves.toEqual({ success: true });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

function authClient(
  options: { signInError?: boolean; signOutError?: boolean } = {},
): AuthClientPort {
  const error = { message: "provider detail" };
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: options.signInError ? error : null }),
      signOut: vi.fn().mockResolvedValue({ error: options.signOutError ? error : null }),
    },
  };
}
