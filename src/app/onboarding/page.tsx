"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding/organization", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });

    setPending(false);

    if (!response.ok) {
      setError("Impossible de créer l’organisation. Vérifiez le nom ou réessayez.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Créer votre organisation</CardTitle>
          <CardDescription>Vous en deviendrez automatiquement propriétaire.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              name="name"
              minLength={2}
              maxLength={120}
              placeholder="Nom de l’organisation"
              required
            />
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Création…" : "Accéder au dashboard"}
            </Button>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
