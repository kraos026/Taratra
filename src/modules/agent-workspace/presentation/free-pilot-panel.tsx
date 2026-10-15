"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  freeMissionListSchema,
  freeMissionSchema,
  freePilotReadinessSchema,
  type FreeMission,
} from "../domain/free-pilot";

const labels: Record<FreeMission["status"], string> = {
  queued: "En attente",
  running: "En cours",
  completed: "Résultat produit · à relire",
  failed: "Échec",
  stopping: "Arrêt demandé",
  stopped: "Arrêtée",
  interrupted: "Interrompue, sans rejeu automatique",
};
export function FreePilotPanel({
  workspaceId,
  canWrite,
}: {
  workspaceId: string;
  canWrite: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<FreeMission[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const intent = useRef<{ id: string; prompt: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  const base = `/api/atelier-ia/entreprises/${encodeURIComponent(workspaceId)}`;
  async function call(path: string, signal: AbortSignal, body?: unknown) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      signal,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const payload = (await response.json()) as { data?: unknown; error?: { message?: string } };
    if (!response.ok)
      throw Object.assign(new Error(payload.error?.message || "Le pilote est indisponible."), {
        status: response.status,
      });
    return payload.data;
  }
  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation(AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(caught instanceof Error ? caught.message : "Vérification impossible.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  }
  async function load(signal: AbortSignal) {
    const result = freeMissionListSchema.parse(await call("/missions", signal));
    setItems(result.items);
    setHasMore(result.hasMore);
    if (intent.current && result.items.some((item) => item.id === intent.current?.id)) {
      intent.current = null;
      setUncertain(false);
      setPrompt("");
    }
  }
  async function submit(signal: AbortSignal) {
    const proposed = intent.current || { id: crypto.randomUUID(), prompt: prompt.trim() };
    intent.current = proposed;
    setUncertain(true);
    try {
      const item = freeMissionSchema.parse(await call("/missions", signal, proposed));
      setItems((current) =>
        [item, ...(current || []).filter((row) => row.id !== item.id)].slice(0, 20),
      );
      intent.current = null;
      setUncertain(false);
      setPrompt("");
      setMessage(
        "Mission enregistrée sur le VPS. Actualisez les missions pour consulter son état réel.",
      );
    } catch (caught) {
      if (
        caught &&
        typeof caught === "object" &&
        "status" in caught &&
        [400, 403, 409, 413, 415, 429].includes(Number(caught.status))
      ) {
        intent.current = null;
        setUncertain(false);
      }
      throw caught;
    }
  }
  return (
    <section
      aria-label="Missions textuelles pilotes"
      className="space-y-4 rounded-xl border border-white/10 p-4"
    >
      <h4 className="font-semibold">Confier une mission textuelle à Hermes</h4>
      <p className="text-sm leading-6 text-slate-300">
        Ce premier pilote produit un texte : plan, synthèse ou procédure. Les outils externes,
        skills, plugins et actions sur vos comptes restent désactivés. Chaque lancement contrôle le
        modèle gratuit et refuse tout repli payant.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          className="min-h-11"
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async (signal) => {
              setReady(false);
              freePilotReadinessSchema.parse(await call("/readiness", signal));
              setReady(true);
              setMessage("Pilote gratuit vérifié. Aucun outil externe ni repli autorisé.");
            })
          }
        >
          Vérifier le pilote gratuit
        </Button>
        <Button
          className="min-h-11"
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => run(load)}
        >
          Actualiser les missions
        </Button>
      </div>
      {canWrite && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(submit);
          }}
        >
          <label htmlFor={`pilot-prompt-${workspaceId}`} className="block text-sm font-semibold">
            Quelle mission textuelle confier à Hermes ?
          </label>
          <textarea
            id={`pilot-prompt-${workspaceId}`}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            required
            minLength={10}
            maxLength={2000}
            disabled={busy || uncertain}
            rows={4}
            className="w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm"
            placeholder="Exemple : prépare une procédure d’accueil client en cinq étapes."
          />
          <Button
            className="min-h-11"
            type="submit"
            disabled={busy || !ready || (!uncertain && prompt.trim().length < 10)}
          >
            {uncertain ? "Reprendre la même demande" : "Lancer la mission textuelle"}
          </Button>
          {uncertain && (
            <p className="text-sm text-amber-200">
              La même demande et son identifiant sont conservés pour éviter un double lancement.
              Actualisez les missions ou reprenez cette demande.
            </p>
          )}
        </form>
      )}
      <div role="status" aria-live="polite" className="text-sm text-slate-300">
        {error || message || "Aucune lecture automatique. Commencez par vérifier le pilote."}
      </div>
      {items?.length === 0 && (
        <p className="text-sm text-slate-400">Aucune mission enregistrée pour cet espace.</p>
      )}
      <div className="space-y-3">
        {items?.map((item) => (
          <article key={item.id} className="space-y-3 rounded-xl border border-white/10 p-4">
            <p className="text-sm font-semibold">{labels[item.status]}</p>
            <p className="text-sm break-words whitespace-pre-wrap text-slate-300">{item.prompt}</p>
            {item.output && (
              <div className="text-sm leading-6 break-words whitespace-pre-wrap">{item.output}</div>
            )}
            {item.proof && (
              <p className="text-xs text-emerald-200">
                Réponse réelle Hermes · coût API vérifié : 0 $ · {item.proof.model} · aucun outil,
                aucun repli
              </p>
            )}
            {item.error && <p className="text-sm text-amber-200">{item.error}</p>}
            {canWrite && ["queued", "running"].includes(item.status) && (
              <Button
                className="min-h-11"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async (signal) => {
                    await call(`/missions/${encodeURIComponent(item.id)}/stop`, signal, {});
                    await load(signal);
                    setMessage(
                      "Arrêt demandé au prochain point sûr. Une requête fournisseur déjà acceptée peut finir.",
                    );
                  })
                }
              >
                Demander l’arrêt
              </Button>
            )}
          </article>
        ))}
      </div>
      {hasMore && (
        <p className="text-sm text-slate-400">
          Les vingt missions les plus récentes sont affichées.
        </p>
      )}
    </section>
  );
}
