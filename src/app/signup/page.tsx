"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/infrastructure/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?next=/onboarding`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl },
    });

    setPending(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setMessage("Consultez votre e-mail pour confirmer votre compte.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Créer votre compte AutomateX</CardTitle>
          <CardDescription>Votre organisation sera créée à l’étape suivante.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.fr"
              required
            />
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Mot de passe"
              required
            />
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer mon compte"}
            </Button>
            {message && (
              <p className="text-sm text-neutral-600" role="status">
                {message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
