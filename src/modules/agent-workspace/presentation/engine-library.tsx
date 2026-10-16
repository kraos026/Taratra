"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { engineManifestSchema, engineRegistry } from "../domain/engine-registry";

const labels = {
  canonical: "Parcours existant",
  adapter: "Adaptateur pilote",
  indirect: "Via Hermes",
  planned: "À raccorder",
};
const responseSchema = z.object({
  data: z.object({
    version: z.literal(1),
    engines: z.array(engineManifestSchema).max(100),
    canWrite: z.boolean(),
    health: z.literal("not-checked"),
    apiBudgetEuro: z.literal(0),
  }),
});
export function EngineLibrary({
  workspaceId,
  canWrite,
  onNewMission,
}: {
  workspaceId?: string;
  canWrite: boolean;
  onNewMission: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifiedWrite, setVerifiedWrite] = useState(true);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function verifyAccess() {
    if (!workspaceId || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setStatus("");
    setVerifiedWrite(false);
    try {
      const response = await fetch(
        `/api/atelier-ia/entreprises/${encodeURIComponent(workspaceId)}/engines`,
        {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        },
      );
      if (!response.ok) throw new Error("Access unavailable");
      const result = responseSchema.parse(await response.json());
      setVerifiedWrite(result.data.canWrite);
      setStatus("Accès à cet espace vérifié. La santé des moteurs n’a pas été testée.");
    } catch {
      if (!controller.signal.aborted) setStatus("Accès non vérifié. Aucun moteur n’a été lancé.");
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        pending.current = null;
      }
    }
  }
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const engines = engineRegistry.filter((engine) =>
    normalize(`${engine.name} ${engine.description} ${engine.protocols.join(" ")}`).includes(
      normalize(query),
    ),
  );
  return (
    <section className="engine-library" aria-label="Bibliothèque des moteurs">
      <p>
        Un même espace pour l’audit, les agents et les automatisations. Les états décrivent le
        raccordement à Optivos, pas la disponibilité d’un service en direct.
      </p>
      <div className="engine-library-toolbar">
        <label>
          <span>Rechercher un moteur</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hermes, workflows, MCP…"
          />
        </label>
        <button
          className="codex-action"
          type="button"
          disabled={!workspaceId || busy}
          onClick={() => void verifyAccess()}
        >
          {busy ? "Vérification…" : "Vérifier l’accès au catalogue"}
        </button>
      </div>
      <p role="status" className="codex-setting-note">
        {status || "Budget API du pilote : 0 €. Un seul lancement à la fois, aucun repli payant."}
      </p>
      <div className="engine-library-grid">
        {engines.map((engine) => (
          <article key={engine.id} className="engine-library-card" data-wiring={engine.wiring}>
            <header>
              <h3>{engine.name}</h3>
              <span>{labels[engine.wiring]}</span>
            </header>
            <p>{engine.description}</p>
            <ul>
              {engine.capabilities.map((capability) => (
                <li key={capability.id}>{capability.label}</li>
              ))}
            </ul>
            <p className="codex-setting-note">{engine.prerequisite}</p>
            <div className="engine-library-actions">
              {engine.id === "optivos-audit" ? (
                <Link href="/?view=audit">Ouvrir l’audit</Link>
              ) : engine.id === "hermes" ? (
                <button
                  type="button"
                  disabled={!workspaceId || !canWrite || !verifiedWrite}
                  onClick={onNewMission}
                >
                  Préparer une mission Hermes
                </button>
              ) : (
                <span>Aucun lancement depuis ce catalogue</span>
              )}
              <a href={engine.source} target="_blank" rel="noopener noreferrer">
                Référence ↗
              </a>
            </div>
          </article>
        ))}
      </div>
      {!engines.length && <p>Aucun moteur ne correspond à cette recherche.</p>}
      <details className="engine-extension-help">
        <summary>Ajouter d’autres moteurs et capacités</summary>
        <p>
          Le socle accepte des moteurs décrits par un contrat versionné. Chaque ajout nécessite un
          adaptateur vérifié, les accès de votre espace et les permissions de ses capacités.
          L’installation depuis l’interface sera ajoutée après ce raccordement.
        </p>
        <p>
          Skills, plugins, API et MCP seront déclarés avec leurs versions et permissions. Aucun
          composant n’est installé et aucune clé n’est demandée ici.
        </p>
      </details>
    </section>
  );
}
