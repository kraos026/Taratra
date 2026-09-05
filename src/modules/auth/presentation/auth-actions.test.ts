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
      message: "Renseignez votre adresse e-mail et votre mot de passe.",
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("maps invalid credentials to a safe public message", async () => {
    await expect(
      loginWithPassword(authClient({ signInError: true }), "a@b.com", "bad"),
    ).resolves.toEqual({
      success: false,
      message: "Adresse e-mail ou mot de passe incorrect.",
    });
  });

  it("terminates only the current Supabase session", async () => {
    const client = authClient();
    await expect(logoutCurrentSession(client)).resolves.toEqual({ success: true });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("handles a network failure without leaking provider details", async () => {
    const client = authClient();
    vi.mocked(client.auth.signInWithPassword).mockRejectedValue(
      new Error("private provider detail"),
    );
    await expect(loginWithPassword(client, "a@b.com", "test")).resolves.toEqual({
      success: false,
      message: "Connexion indisponible. Vérifiez votre connexion et réessayez.",
    });
  });
  it("does not report a provider outage as incorrect credentials", async () => {
    const client = authClient();
    vi.mocked(client.auth.signInWithPassword).mockResolvedValue({ error: { status: 503 } });
    await expect(loginWithPassword(client, "a@b.com", "test")).resolves.toMatchObject({
      success: false,
      message: "Connexion indisponible. Vérifiez votre connexion et réessayez.",
    });
  });
  it("handles a failed sign-out without claiming success", async () => {
    const client = authClient();
    vi.mocked(client.auth.signOut).mockRejectedValue(new Error("network"));
    await expect(logoutCurrentSession(client)).resolves.toMatchObject({ success: false });
  });
});

function authClient(
  options: { signInError?: boolean; signOutError?: boolean } = {},
): AuthClientPort {
  const error = { message: "provider detail", code: "invalid_credentials" };
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: options.signInError ? error : null }),
      signOut: vi.fn().mockResolvedValue({ error: options.signOutError ? error : null }),
    },
  };
}
