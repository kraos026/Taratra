import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import { PasswordRecoveryForm } from "@/modules/auth/presentation/password-recovery-form";

export default async function ResetPasswordPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/forgot-password?error=recovery");
  return <PasswordRecoveryForm mode="reset" />;
}
