"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  missionLinksSchema,
  missionObservationSchema,
  missionStateLabels,
  type MissionLink,
  type MissionObservation,
} from "../domain/hermes-missions";

const unavailableLabels = {
  unconfigured: "Connexion non configurée",
  unlinked: "Dossier non lié à Hermes",
  unavailable: "Suivi temporairement indisponible",
  not_found: "Mission non retrouvée dans Hermes",
};
export function MissionMonitoringPanel({ companyId }: { companyId: string }) {
  const [links, setLinks] = useState<MissionLink[] | null>(null);
  const [observations, setObservations] = useState<Record<string, MissionObservation>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const base = `/api/companies/${encodeURIComponent(companyId)}/atelier-ia/missions`;
  async function read(id?: string) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(id ?? "list");
    setError("");
    if (id)
      setObservations((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    try {
      const response = await fetch(id ? `${base}/${encodeURIComponent(id)}/status` : base, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Monitoring unavailable");
      const payload = (await response.json()) as { data: unknown };
      if (id) {
        const data = missionObservationSchema.parse(payload.data);
        if (!controller.signal.aborted)
          setObservations((previous) => ({ ...previous, [id]: data }));
      } else {
        const data = missionLinksSchema.parse(payload.data);
        if (!controller.signal.aborted) {
          setLinks(data.items);
          setHasMore(data.hasMore);
          setObservations({});
        }
      }
    } catch {
      if (!controller.signal.aborted)
        setError("Consultation impossible. Réessayez ; aucune mission n’a été lancée.");
    } finally {
      if (!controller.signal.aborted) setLoading(null);
      request.current = null;
    }
  }
  return (
    <section
      className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/70 p-6"
      aria-label="Activité réelle Hermes"
    >
      <div>
        <h2 className="text-xl font-semibold">Activité réelle</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Consultez les missions Hermes déjà liées à votre entreprise. Les états sont lus à votre
          demande ; cette page ne lance, n’arrête et ne valide aucune mission.
        </p>
      </div>
      <Button className="min-h-11" disabled={loading !== null} onClick={() => read()}>
        {loading === "list"
          ? "Chargement…"
          : links === null
            ? "Charger les missions liées"
            : "Actualiser la liste"}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-slate-300">
        {error ||
          (links === null
            ? "La liste n’a pas encore été chargée."
            : links.length === 0
              ? "Aucune mission réelle liée à cette entreprise."
              : `${links.length} ${links.length === 1 ? "mission liée" : "missions liées"}.`)}
      </p>
      {hasMore && (
        <p className="text-sm text-slate-400">
          Les vingt liaisons les plus récentes sont affichées.
        </p>
      )}
      {links?.map((mission) => {
        const observed = observations[mission.id];
        return (
          <article key={mission.id} className="space-y-3 rounded-xl border border-white/10 p-4">
            <h3 className="font-semibold">{mission.title}</h3>
            <p className="text-sm text-slate-400">
              Liaison conservée dans votre dossier entreprise.
            </p>
            <p role="status" className="text-sm text-indigo-200">
              {observed
                ? observed.availability === "available"
                  ? `${missionStateLabels[observed.status!]} · état Hermes`
                  : unavailableLabels[observed.availability]
                : "État pas encore vérifié"}
            </p>
            {observed && (
              <p className="text-xs text-slate-400">
                Vérifié à {new Date(observed.checkedAt).toLocaleTimeString("fr-FR")}. L’état peut
                évoluer.
              </p>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              disabled={loading !== null}
              onClick={() => read(mission.id)}
            >
              {loading === mission.id ? "Lecture en cours…" : "Vérifier l’état"}
            </Button>
          </article>
        );
      })}
    </section>
  );
}
