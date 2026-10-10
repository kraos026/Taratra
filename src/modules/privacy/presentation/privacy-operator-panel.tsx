"use client";
import { useEffect, useState } from "react";
type History = {
  fromStatus: string;
  toStatus: string;
  response: string;
  revision: number;
  createdAt: string;
};
type Row = {
  id: string;
  kind: string;
  description: string;
  status: string;
  publicResponse: string | null;
  revision: number;
  createdAt: string;
  history: History[];
};
const statuses: Record<string, string> = {
  RECEIVED: "Reçue",
  IN_REVIEW: "En cours d’examen",
  NEEDS_INFORMATION: "Informations complémentaires nécessaires",
  COMPLETED: "Traitement terminé",
  DECLINED: "Refusée avec explication",
};
const kinds: Record<string, string> = {
  ACCESS: "Accès aux données",
  CORRECTION: "Correction",
  DELETION: "Suppression à examiner",
};
const choices: Record<string, string[]> = {
  RECEIVED: ["IN_REVIEW", "NEEDS_INFORMATION", "DECLINED"],
  IN_REVIEW: ["NEEDS_INFORMATION", "COMPLETED", "DECLINED"],
  NEEDS_INFORMATION: ["IN_REVIEW", "COMPLETED", "DECLINED"],
};
async function readRequests(): Promise<{ requests: Row[]; hasMore: boolean }> {
  const response = await fetch("/api/privacy-requests/operator", { cache: "no-store" });
  const json = await response.json();
  if (!response.ok || !json.success)
    throw new Error(json.error?.message ?? "Traitement indisponible.");
  return json.data;
}
function RequestCard({ row }: { row: Row }) {
  const available = choices[row.status] ?? [];
  const [status, setStatus] = useState(available[0] ?? "");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || saved) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/api/privacy-requests/operator", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          expectedRevision: row.revision,
          status,
          response: response.trim(),
        }),
      });
      const json = await result.json();
      if (!result.ok || !json.success)
        throw new Error(json.error?.message ?? "Réponse non confirmée.");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Réponse non confirmée.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">
        {kinds[row.kind] ?? "Demande"} — {statuses[row.status] ?? "État inconnu"}
      </h2>
      <p className="text-sm text-slate-300">
        Reçue le {new Date(row.createdAt).toLocaleString("fr-FR")}
      </p>
      <p className="break-words whitespace-pre-wrap">{row.description}</p>
      {row.publicResponse ? (
        <p className="rounded-xl bg-slate-800 p-4 whitespace-pre-wrap">
          Réponse actuelle : {row.publicResponse}
        </p>
      ) : null}
      {available.length && !saved ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            Nouveau statut
            <select
              disabled={busy}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-slate-100"
            >
              {available.map((value) => (
                <option key={value} value={value}>
                  {statuses[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Réponse visible par le demandeur
            <textarea
              required
              minLength={5}
              maxLength={2000}
              disabled={busy}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              className="mt-1 block min-h-32 w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-slate-100"
            />
          </label>
          <p className="text-sm text-slate-300">
            Décrivez uniquement les actions réellement réalisées et leurs limites. « Traitement
            terminé » ne signifie pas que toutes les données ont été effacées.
          </p>
          <button
            disabled={busy || response.trim().length < 5}
            className="rounded-lg bg-blue-600 px-4 py-3 disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer la réponse"}
          </button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-300">
          {error} Votre saisie est conservée.
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-emerald-300">
          Réponse enregistrée. Rechargez la page pour voir l’état et l’historique actualisés.
        </p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-blue-300">Historique des réponses</summary>
        <ol className="mt-3 space-y-3">
          {row.history.map((event) => (
            <li key={event.revision} className="rounded-lg bg-slate-800 p-3">
              <p>
                {statuses[event.fromStatus]} → {statuses[event.toStatus]} —{" "}
                {new Date(event.createdAt).toLocaleString("fr-FR")}
              </p>
              <p className="whitespace-pre-wrap">{event.response}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-300">
          Les dix dernières réponses sont affichées.{" "}
          {row.history.length === 0 ? "Aucune réponse enregistrée." : ""}
        </p>
      </details>
    </article>
  );
}
export function PrivacyOperatorPanel() {
  const [data, setData] = useState<{ requests: Row[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    readRequests()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Traitement indisponible.");
      });
    return () => {
      active = false;
    };
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Vérification de l’accès…</p>;
  return (
    <section className="space-y-6">
      {data.requests.length === 0 ? (
        <p>Aucune demande enregistrée.</p>
      ) : (
        data.requests.map((row) => <RequestCard key={`${row.id}:${row.revision}`} row={row} />)
      )}
      {data.hasMore ? (
        <p>
          Les cinquante demandes les plus récentes sont affichées. Les autres restent conservées.
        </p>
      ) : null}
    </section>
  );
}
