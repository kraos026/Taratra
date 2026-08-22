"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/infrastructure/supabase/client";
import { loginWithPassword } from "@/modules/auth/presentation/auth-actions";
import { AuthShell } from "@/modules/auth/presentation/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setMessage(undefined);

    const form = new FormData(event.currentTarget);
    const result = await loginWithPassword(
      createClient(),
      String(form.get("email") ?? ""),
      String(form.get("password") ?? ""),
    );

    if (!result.success) {
      setMessage(result.message);
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <AuthShell
      title="Connexion AutomateX"
      description="Connectez-vous avec votre compte existant."
      footer={{ href: "/signup", label: "Créer un compte" }}
    >
      <form className="space-y-4" method="post" onSubmit={(event) => void submit(event)}>
        <Input
          aria-label="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="vous@entreprise.fr"
          required
        />
        <Input
          aria-label="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Mot de passe"
          required
        />
        <div className="text-right">
          <Link className="text-sm text-blue-400 hover:text-blue-300" href="/signup">
            Nouveau sur AutomateX ?
          </Link>
        </div>
        <Button
          className="w-full bg-blue-600 hover:bg-blue-500"
          type="submit"
          disabled={pending || !ready}
        >
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
        {message && (
          <p className="text-sm text-red-300" role="alert">
            {message}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
