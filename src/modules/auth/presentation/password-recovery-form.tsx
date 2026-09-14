"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./auth-shell";
import { replacePassword, requestPasswordRecovery } from "./password-recovery";

export function PasswordRecoveryForm({
  mode,
  invalidLink = false,
}: {
  mode: "request" | "reset";
  invalidLink?: boolean;
}) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState(
    invalidLink ? "Lien invalide ou expiré. Demandez un nouveau lien de récupération." : "",
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const client = createClient();
      if (mode === "request") {
        setMessage(
          await requestPasswordRecovery(
            client,
            String(form.get("email") ?? ""),
            window.location.origin,
          ),
        );
      } else {
        const result = await replacePassword(
          client,
          String(form.get("password") ?? ""),
          String(form.get("confirmation") ?? ""),
        );
        setMessage(result.message);
        if (result.success) {
          formElement.reset();
          setDone(true);
        }
      }
    } catch {
      setMessage("Service indisponible. Veuillez réessayer.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <AuthShell
      title={mode === "request" ? "Mot de passe oublié" : "Nouveau mot de passe"}
      description={
        mode === "request"
          ? "Recevez un lien sécurisé pour retrouver votre accès."
          : "Choisissez un mot de passe unique pour votre compte."
      }
      footer={{ href: "/login", label: "Retour à la connexion" }}
    >
      {done ? (
        <Link href="/" className="text-blue-400 underline">
          Accéder à mon espace
        </Link>
      ) : (
        <form method="post" className="space-y-4" onSubmit={submit}>
          {mode === "request" ? (
            <>
              <Label htmlFor="recovery-email">Adresse e-mail</Label>
              <Input id="recovery-email" name="email" type="email" autoComplete="email" required />
            </>
          ) : (
            <>
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-xs text-slate-400">Au moins 8 caractères.</p>
            </>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Veuillez patienter…"
              : mode === "request"
                ? "Demander un lien"
                : "Modifier le mot de passe"}
          </Button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-slate-300">
          {message}
        </p>
      )}
    </AuthShell>
  );
}
