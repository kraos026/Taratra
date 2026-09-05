export interface AuthClientPort {
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<{ error: { message?: string; code?: string; status?: number } | null }>;
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
    return { success: false, message: "Renseignez votre adresse e-mail et votre mot de passe." };
  }

  try {
    const { error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
    if (!error) return { success: true };
    if (error.code === "invalid_credentials")
      return { success: false, message: "Adresse e-mail ou mot de passe incorrect." };
    if (error.status === 429)
      return {
        success: false,
        message: "Trop de tentatives. Patientez quelques instants avant de réessayer.",
      };
    if (error.code === "email_not_confirmed")
      return {
        success: false,
        message: "Confirmez votre adresse e-mail depuis le message reçu avant de vous connecter.",
      };
    return {
      success: false,
      message: "Connexion indisponible. Vérifiez votre connexion et réessayez.",
    };
  } catch {
    return {
      success: false,
      message: "Connexion indisponible. Vérifiez votre connexion et réessayez.",
    };
  }
}

export async function logoutCurrentSession(client: AuthClientPort): Promise<AuthActionResult> {
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (!error) return { success: true };
  } catch {
    /* Retain the session UI until sign-out is confirmed. */
  }
  return { success: false, message: "Déconnexion non confirmée. Veuillez réessayer." };
}
