import type { SupabaseClient } from "@supabase/supabase-js";

type RecoveryClient = Pick<SupabaseClient, "auth">;
export const SIGNUP_INSTRUCTIONS =
  "Si cette adresse peut être utilisée pour créer un compte, vous recevrez les instructions nécessaires. Si vous avez déjà un compte, connectez-vous ou utilisez la récupération de mot de passe.";
export const RECOVERY_INSTRUCTIONS =
  "Si un compte correspond à cette adresse, vous recevrez les instructions de récupération. Consultez également vos courriers indésirables et ouvrez le lien dans ce navigateur.";

export async function requestPasswordRecovery(
  client: RecoveryClient,
  email: string,
  origin: string,
) {
  if (!email.trim()) return "Renseignez votre adresse e-mail.";
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: new URL("/auth/callback?next=/reset-password", origin).href,
    });
    if (error?.status === 429) return "Trop de demandes. Patientez avant de réessayer.";
    if (error && (error.status ?? 0) >= 500) return "Service indisponible. Veuillez réessayer.";
    // Do not distinguish a provider's account-specific response from an absent account.
    return RECOVERY_INSTRUCTIONS;
  } catch {
    return "Connexion indisponible. Veuillez réessayer.";
  }
}

export async function replacePassword(
  client: RecoveryClient,
  password: string,
  confirmation: string,
) {
  if (password.length < 8) return { success: false, message: "Utilisez au moins 8 caractères." };
  if (password !== confirmation)
    return { success: false, message: "Les mots de passe ne correspondent pas." };
  try {
    const { data, error: identityError } = await client.auth.getUser();
    if (identityError || !data.user)
      return {
        success: false,
        message: "Lien invalide ou expiré. Demandez un nouveau lien de récupération.",
      };
    const { error } = await client.auth.updateUser({ password });
    if (error)
      return {
        success: false,
        message:
          "Modification impossible. Choisissez un mot de passe différent ou demandez un nouveau lien.",
      };
    return { success: true, message: "Mot de passe modifié. Vous pouvez accéder à votre espace." };
  } catch {
    return { success: false, message: "Connexion indisponible. Veuillez réessayer." };
  }
}
