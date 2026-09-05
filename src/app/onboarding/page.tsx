"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/modules/auth/presentation/auth-shell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/onboarding/organization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      if (!response.ok) {
        setError("Impossible de créer votre espace. Vérifiez le nom ou réessayez.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(
        "Création non confirmée. Vérifiez votre connexion, puis rechargez la page avant de réessayer.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Créer votre espace Optivos"
      description="Votre espace regroupe vos entreprises et leurs audits pour retrouver vos analyses au même endroit."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Label htmlFor="workspace-name">Nom de votre espace</Label>
        <Input
          id="workspace-name"
          name="name"
          minLength={2}
          maxLength={120}
          placeholder="Ex. le nom de votre entreprise"
          required
        />
        <Button className="w-full bg-blue-600 hover:bg-blue-500" type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon espace"}
        </Button>
        {error && (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
