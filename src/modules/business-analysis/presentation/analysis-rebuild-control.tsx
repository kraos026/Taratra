"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AnalysisRebuildControl({ id, lockVersion }: { id: string; lockVersion: number }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function rebuild() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/analysis/${id}/rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockVersion }),
      });
      const payload = await response.json();
      if (
        !response.ok ||
        !payload.success ||
        typeof payload.data?.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.data.id)
      ) {
        throw new Error("REBUILD_FAILED");
      }
      router.push(`/analysis/${payload.data.id}`);
      router.refresh();
    } catch {
      setError(
        "La nouvelle version n’a pas pu être préparée. Vérifiez votre accès et rechargez la page avant de réessayer. Aucune validation n’a été forcée.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Nouvelle version de l’analyse"
      className="rounded-xl border border-blue-400/20 bg-blue-950/20 p-4"
    >
      <h2 className="font-semibold">Réexaminer les sources disponibles</h2>
      <p className="mt-2 text-sm text-slate-300">
        Créez une nouvelle version à partir du processus source validé. L’ancienne analyse reste
        conservée. Cette action ne complète pas vos réponses, ne fabrique aucune preuve et
        n’approuve aucune décision. La nouvelle version devra être relue.
      </p>
      <Button className="mt-3" disabled={busy} onClick={rebuild}>
        {busy ? "Préparation…" : "Créer une nouvelle version de l’analyse"}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
