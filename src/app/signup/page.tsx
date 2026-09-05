"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/modules/auth/presentation/auth-shell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createClient } from "@/infrastructure/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(undefined);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const supabase = createClient();
      const callbackUrl = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) {
        setMessage(
          error.status === 429
            ? "Trop de demandes. Patientez quelques instants avant de réessayer."
            : "Création du compte impossible pour le moment. Vérifiez vos informations et réessayez.",
        );
        return;
      }
      if (data.session) {
        router.push("/onboarding");
        router.refresh();
        return;
      }
      setMessage("Consultez votre e-mail pour confirmer votre compte.");
    } catch {
      setMessage("Connexion indisponible. Vos informations restent à l’écran ; réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Créer votre compte Optivos"
      description="Créez votre espace, puis décrivez votre entreprise pour démarrer votre audit."
      footer={{ href: "/login", label: "Déjà un compte ? Se connecter" }}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Label htmlFor="signup-email">Adresse e-mail</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vous@entreprise.fr"
          required
        />
        <Label htmlFor="signup-password">Mot de passe</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Mot de passe"
          required
        />
        <p className="text-xs text-slate-400">
          Au moins 8 caractères. Choisissez un mot de passe unique.
        </p>
        <Button className="w-full bg-blue-600 hover:bg-blue-500" type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
        {message && (
          <p className="text-sm text-slate-300" role="status">
            {message}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
