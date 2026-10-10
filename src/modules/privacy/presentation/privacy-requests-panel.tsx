"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type RequestRow = {
  id: string;
  kind: string;
  description: string;
  status: string;
  publicResponse: string | null;
  createdAt: string;
  updatedAt: string;
};
const kinds: Record<string, string> = {
  ACCESS: "Accès à mes données",
  CORRECTION: "Correction de mes données",
  DELETION: "Suppression à examiner",
};
const statuses: Record<string, string> = {
  RECEIVED: "Reçue",
  IN_REVIEW: "En cours d’examen",
  NEEDS_INFORMATION: "Informations complémentaires nécessaires",
  COMPLETED: "Traitement terminé",
  DECLINED: "Demande refusée avec explication",
};

async function fetchRequests(): Promise<{ requests: RequestRow[]; hasMore: boolean }> {
  const response = await fetch("/api/privacy-requests", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(result.error?.message ?? "Suivi indisponible");
  return result.data;
}

export function PrivacyRequestsPanel() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [kind, setKind] = useState("ACCESS");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const retry = useRef<{ id: string; kind: string; description: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await fetchRequests();
      setRows(result.requests);
      setHasMore(result.hasMore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Suivi indisponible");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetchRequests()
      .then((result) => {
        if (!active) return;
        setRows(result.requests);
        setHasMore(result.hasMore);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Suivi indisponible");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const trimmed = description.trim();
    if (!retry.current || retry.current.kind !== kind || retry.current.description !== trimmed)
      retry.current = { id: crypto.randomUUID(), kind, description: trimmed };
    try {
      const response = await fetch("/api/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retry.current),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message ?? "Enregistrement indisponible");
      retry.current = null;
      setDescription("");
      setSuccess(
        "Demande enregistrée. Aucun effacement ni correction automatique n’a été effectué.",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Enregistrement indisponible. Actualisez le suivi avant de réessayer.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6">
      <h2 className="text-xl font-semibold">Mes demandes enregistrées</h2>
      <p>
        Ce formulaire concerne votre compte connecté. Seules vos demandes sont visibles ici.
        Décrivez le périmètre souhaité, sans mot de passe, lien de connexion ni document
        confidentiel.
      </p>
      <p>
        Le traitement est manuel. L’enregistrement ne déclenche aucune suppression et n’envoie pas
        automatiquement d’email au responsable. Pour signaler une urgence ou compléter une demande,
        contactez-le par email.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          Type de demande
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={busy}
            className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100"
          >
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Périmètre de ma demande
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100"
          />
        </label>
        <button
          disabled={busy || loading}
          className="rounded-lg bg-blue-600 px-4 py-3 font-semibold disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer ma demande"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-emerald-300">
          {success}
        </p>
      )}
      <button
        type="button"
        disabled={busy || loading}
        onClick={() => {
          setError("");
          setLoading(true);
          void load();
        }}
        className="text-blue-300 underline disabled:opacity-50"
      >
        Actualiser le suivi
      </button>
      {loading ? (
        <p role="status">Chargement du suivi…</p>
      ) : rows.length === 0 ? (
        <p>Aucune demande enregistrée pour votre compte.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="space-y-2 rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">{kinds[row.kind] ?? "Demande relative aux données"}</h3>
              <p>{statuses[row.status] ?? "État à vérifier auprès du responsable"}</p>
              <p className="break-words whitespace-pre-wrap">{row.description}</p>
              <p className="text-sm text-slate-400">
                Enregistrée le {new Date(row.createdAt).toLocaleString("fr-FR")} · Dernière mise à
                jour le {new Date(row.updatedAt).toLocaleString("fr-FR")}
              </p>
              {row.publicResponse && (
                <p className="break-words whitespace-pre-wrap">
                  Réponse du responsable : {row.publicResponse}
                </p>
              )}
              {row.status === "COMPLETED" && (
                <p>
                  Le traitement de la demande est terminé. La réponse précise les actions réalisées
                  et les données éventuellement conservées ; ce statut ne signifie pas que toutes
                  les données ont été effacées.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <p>
          Les 50 demandes les plus récentes sont affichées. Contactez le responsable pour
          l’historique antérieur.
        </p>
      )}
    </section>
  );
}
