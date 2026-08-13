export interface AuthClientPort {
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{ error: { message?: string } | null }>;
    signOut(options: { scope: "local" }): Promise<{ error: { message?: string } | null }>;
  };
}

export type AuthActionResult = { success: true } | { success: false; message: string };

export async function loginWithPassword(
  client: AuthClientPort,
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password) {
    return { success: false, message: "Email and password are required." };
  }

  const { error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  return error ? { success: false, message: "Email or password is incorrect." } : { success: true };
}

export async function logoutCurrentSession(client: AuthClientPort): Promise<AuthActionResult> {
  const { error } = await client.auth.signOut({ scope: "local" });
  return error
    ? { success: false, message: "Unable to sign out safely. Please try again." }
    : { success: true };
}
