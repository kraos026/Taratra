"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isHermesConnection, type HermesConnection } from "../domain/hermes-connection";
import { missionLinksSchema } from "../domain/hermes-missions";

export function GettingStartedPanel({
  company,
  onConnection,
  onActivity,
  onSimulation,
}: {
  company: { id: string; name: string; canSimulate: boolean };
  onConnection: () => void;
  onActivity: () => void;
  onSimulation: () => void;
}) {
  const [connection, setConnection] = useState<HermesConnection | null>(null);
  const [missionCount, setMissionCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [registryError, setRegistryError] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setConnection(null);
    setMissionCount(null);
    setConnectionError(false);
    setRegistryError(false);
    setCheckedAt("");
    const base = `/api/companies/${encodeURIComponent(company.id)}/atelier-ia`;
    async function data(path: string) {
      const response = await fetch(`${base}/${path}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Verification unavailable");
      return ((await response.json()) as { data: unknown }).data;
    }
    const [health, missions] = await Promise.allSettled([data("connection"), data("missions")]);
    if (!controller.signal.aborted) {
      if (health.status === "fulfilled" && isHermesConnection(health.value))
        setConnection(health.value);
      else setConnectionError(true);
      const parsed =
        missions.status === "fulfilled" ? missionLinksSchema.safeParse(missions.value) : null;
      if (parsed?.success) setMissionCount(parsed.data.items.length);
      else setRegistryError(true);
      setCheckedAt(new Date().toLocaleTimeString("fr-FR"));
      setChecking(false);
    }
    request.current = null;
  }
  const connectionText = checking
    ? "Vérification en cours…"
    : connectionError
      ? "Vérification indisponible"
      : !connection
        ? "À vérifier"
        : connection.state === "connected"
          ? connection.monitoring.status
            ? "Connexion prête pour le suivi"
            : "Connecté, suivi des états indisponible"
          : connection.state === "unconfigured"
            ? "Configuration à terminer avec votre installateur"
            : connection.state === "unlinked"
              ? "Ce dossier doit être lié par votre installateur"
              : "Hermes ne répond pas pour le moment";
  const registryText = checking
    ? "Vérification en cours…"
    : registryError
      ? "Liste temporairement indisponible"
      : missionCount === null
        ? "À vérifier"
        : missionCount === 0
          ? "Aucune mission réelle liée pour le moment"
          : `${missionCount} ${missionCount === 1 ? "mission disponible" : "missions disponibles"} dans la liste récente`;
  return (
    <section
      className="space-y-5 rounded-2xl border border-indigo-300/20 bg-indigo-300/5 p-5 sm:p-6"
      aria-label="Prise en main de l’atelier"
    >
      <div>
        <h2 className="text-xl font-semibold">Commencez ici</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Trois repères pour comprendre votre atelier. La vérification consulte la connexion et la
          liste des missions ; elle ne lance aucune tâche.
        </p>
      </div>
      <Button className="min-h-11" disabled={checking} onClick={check}>
        {checking ? "Vérification en cours…" : "Vérifier mon atelier"}
      </Button>
      <ol className="grid gap-3 lg:grid-cols-3">
        <li className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="font-semibold">1. Votre entreprise</h3>
          <p className="text-sm text-slate-300">{company.name}</p>
          <p className="text-sm text-indigo-200">Accès au dossier vérifié</p>
        </li>
        <li className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="font-semibold">2. Connexion Hermes</h3>
          <p role="status" className="text-sm leading-6 text-slate-300">
            {connectionText}
          </p>
          <Button variant="outline" className="min-h-11" onClick={onConnection}>
            Ouvrir la connexion
          </Button>
        </li>
        <li className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <h3 className="font-semibold">3. Missions liées</h3>
          <p role="status" className="text-sm leading-6 text-slate-300">
            {registryText}
          </p>
          <Button variant="outline" className="min-h-11" onClick={onActivity}>
            Voir l’activité réelle
          </Button>
        </li>
      </ol>
      <p role="status" aria-live="polite" className="text-xs text-slate-400">
        {checkedAt
          ? `Vérification effectuée à ${checkedAt}. Les états peuvent évoluer.`
          : "Aucune vérification réseau automatique."}
      </p>
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm leading-6 text-slate-300">
          Pour découvrir le parcours, essayez une simulation à 0 € d’appels IA. Les missions réelles
          restent en consultation ; leur lancement et les compétences métier seront configurés
          ultérieurement.
        </p>
        <Button
          variant="outline"
          className="mt-3 min-h-11"
          disabled={!company.canSimulate}
          onClick={onSimulation}
        >
          Essayer une simulation
        </Button>
      </div>
    </section>
  );
}
