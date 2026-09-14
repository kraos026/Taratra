import { PasswordRecoveryForm } from "@/modules/auth/presentation/password-recovery-form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <PasswordRecoveryForm mode="request" invalidLink={(await searchParams).error === "recovery"} />
  );
}
