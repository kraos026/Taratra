"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  hermesConnectionLabels,
  isHermesConnection,
  type HermesConnection,
} from "../domain/hermes-connection";

export function HermesConnectionPanel({ companyId }: { companyId: string }) {
  const [connection, setConnection] = useState<HermesConnection | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setConnection(null);
    setError("");
    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/atelier-ia/connection`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error("Connection unavailable");
      const payload = (await response.json()) as { data?: unknown };
      const value = payload.data;
      if (!isHermesConnection(value)) throw new Error("Invalid connection response");
      if (!controller.signal.aborted) {
        setConnection(value);
        setCheckedAt(new Date(value.checkedAt).toLocaleTimeString("fr-FR"));
      }
    } catch {
      if (!controller.signal.aborted)
        setError("Vérification impossible. Réessayez pour obtenir un état actualisé.");
    } finally {
      if (!controller.signal.aborted) setChecking(false);
      request.current = null;
    }
  }
  return (
    <section
      className="rounded-2xl border border-white/10 bg-slate-900/70 p-6"
      aria-label="Connexion Hermes"
    >
      <h2 className="text-xl font-semibold">Connexion Hermes</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Vérifiez si Hermes répond pour ce dossier. Cette vérification ne lance aucune mission et
        n’appelle aucun modèle IA.
      </p>
      <Button className="mt-4 min-h-11" onClick={check} disabled={checking}>
        {checking ? "Vérification en cours…" : "Vérifier la connexion"}
      </Button>
      <div role="status" aria-live="polite" className="mt-4 text-sm text-slate-200">
        {error ||
          (connection
            ? `${hermesConnectionLabels[connection.state]} · vérifié à ${checkedAt}`
            : "Pas encore vérifiée depuis cet atelier.")}
      </div>
      {connection?.state === "connected" && (
        <dl className="mt-4 space-y-2 text-sm text-slate-300">
          <div>
            <dt className="inline font-semibold">Suivi des états : </dt>
            <dd className="inline">
              {connection.monitoring.status ? "disponible dans Hermes" : "non disponible"}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Suivi des événements : </dt>
            <dd className="inline">
              {connection.monitoring.events ? "disponible dans Hermes" : "non disponible"}
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-5 text-sm leading-6 text-slate-400">
        Les missions déjà liées à ce dossier sont consultables dans Missions. Une connexion de suivi
        réussie n’active ni la discussion ni le lancement : leur raccordement et le contrôle du
        budget restent nécessaires.
      </p>
    </section>
  );
}
