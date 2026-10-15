"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HermesConnectionPanel } from "./hermes-connection-panel";
import { HermesInventoryPanel } from "./hermes-inventory-panel";
import {
  agentCompanySchema,
  agentCompanyListSchema,
  teamTemplates,
  type AgentCompany,
  type AgentCompanyInput,
} from "../domain/agent-company";

type AuditCompany = { id: string; name: string };
export function AgentCompanyPanel({
  initial,
  canWrite,
  companies,
  initialCompanyId = "",
  unavailable = false,
  initialHasMore = false,
}: {
  initial: AgentCompany[];
  canWrite: boolean;
  companies: AuditCompany[];
  initialCompanyId?: string;
  unavailable?: boolean;
  initialHasMore?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [mode, setMode] = useState<AgentCompanyInput["mode"]>("guided");
  const [template, setTemplate] = useState<keyof typeof teamTemplates>("general");
  const [agents, setAgents] = useState<AgentCompanyInput["agents"]>(
    teamTemplates.general.map((a) => ({ ...a })),
  );
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [autonomy, setAutonomy] = useState<AgentCompanyInput["autonomy"]>("approval");
  const [creationId, setCreationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const inputClass =
    "min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-400";
  async function call(path: string, method = "GET", body?: unknown) {
    const response = await fetch(path, {
      method,
      cache: "no-store",
      ...(body
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    const value = (await response.json()) as { data?: unknown; error?: { message?: string } };
    if (!response.ok)
      throw new Error(value.error?.message || "La demande n’a pas pu être confirmée.");
    return value.data;
  }
  async function refresh() {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const list = agentCompanyListSchema.parse(await call("/api/atelier-ia/entreprises"));
      setItems(list.items);
      setHasMore(list.hasMore);
      if (creationId && list.items.some((item) => item.id === creationId)) {
        setCreationId(null);
        setNotice(
          "La création a été retrouvée dans le registre. Vérifiez sa configuration avant une nouvelle demande.",
        );
      }
    } catch {
      setError("Actualisation impossible. La liste affichée n’a pas été actualisée.");
    } finally {
      setSaving(false);
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !canWrite) return;
    setSaving(true);
    setError("");
    setNotice("");
    const id = creationId || crypto.randomUUID();
    setCreationId(id);
    try {
      const data = agentCompanySchema.parse(
        await call("/api/atelier-ia/entreprises", "POST", {
          id,
          name,
          objective,
          mode,
          autonomy,
          agents,
          companyId: companyId || null,
        }),
      );
      setItems((current) => [data, ...current.filter((x) => x.id !== data.id)].slice(0, 20));
      setNotice(`${data.name} : objectif et équipe enregistrés. Aucun agent n’a été démarré.`);
      setCreationId(null);
      setName("");
      setObjective("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Enregistrement non confirmé. Réessayez la même demande.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function link(id: string, selected: string) {
    if (saving || !canWrite) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const value = agentCompanySchema.parse(
        await call(`/api/atelier-ia/entreprises/${encodeURIComponent(id)}`, "PATCH", {
          companyId: selected || null,
        }),
      );
      setItems((current) => current.map((x) => (x.id === id ? value : x)));
      setNotice("Liaison enregistrée. Aucun accès d’agent n’a été activé.");
    } catch {
      setError("Liaison non confirmée. Actualisez pour vérifier son état.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-indigo-300">Atelier IA · Entreprises d’agents</p>
        <h1 className="mt-2 text-3xl font-bold">Créer votre entreprise IA</h1>
        <p className="mt-3 leading-7 text-slate-300">
          Un objectif, une petite équipe et des responsabilités claires. Vous restez à la direction
          et validez le travail important.
        </p>
        <Link
          href="/atelier-ia"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-indigo-300 underline"
        >
          Retour à l’Atelier IA
        </Link>
      </header>
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100">
        <strong>Configuration réelle · agents à connecter</strong>
        <p className="mt-2">
          La création conserve votre objectif et les profils de l’équipe. Elle ne démarre pas
          Hermes. Le lancement attend la connexion au VPS et un modèle respectant le plafond de 0 €
          de nouveaux frais API.
        </p>
      </div>
      {unavailable && (
        <p role="alert" className="rounded-xl border border-rose-300/30 p-4 text-rose-200">
          Le registre n’est pas disponible. La création est désactivée ; réessayez plus tard.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-300/30 p-4 text-rose-200">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm text-indigo-200">
        {notice}
      </p>
      <form
        onSubmit={create}
        className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6"
      >
        <h2 className="text-xl font-semibold">1. Choisir votre façon de commencer</h2>
        <fieldset
          disabled={saving || !canWrite || unavailable}
          className="grid gap-3 sm:grid-cols-3"
        >
          <legend className="sr-only">Mode de création</legend>
          {[
            ["guided", "Guidé", "Une équipe simple proposée, que vous pouvez adapter."],
            [
              "template",
              "À partir d’un modèle",
              "Une équipe de recherche ou de création de contenu.",
            ],
            ["manual", "Manuel", "Choisissez chaque nom et responsabilité."],
          ].map(([value, label, description]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-4 ${mode === value ? "border-indigo-400/50 bg-indigo-400/10" : "border-white/10"}`}
            >
              <span className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="creation-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    setMode(value as AgentCompanyInput["mode"]);
                    setAgents(
                      teamTemplates[value === "template" ? template : "general"].map((a) => ({
                        ...a,
                      })),
                    );
                  }}
                />
                <strong className="text-sm">{label}</strong>
              </span>
              <span className="block text-sm leading-6 text-slate-400">{description}</span>
            </label>
          ))}
        </fieldset>
        <fieldset disabled={saving || !canWrite || unavailable} className="grid gap-4">
          <legend className="text-xl font-semibold">2. Définir votre objectif</legend>
          <label className="mt-3 grid gap-2 text-sm font-semibold">
            Nom de l’entreprise IA
            <input
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Quel résultat doit produire cette équipe ?
            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="grid gap-2 text-sm font-semibold">
            <label htmlFor="agent-company-audit">Lien avec un dossier Optivos</label>
            <select
              id="agent-company-audit"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={inputClass}
            >
              <option value="">Espace indépendant — relier plus tard</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            L’espace indépendant appartient à votre organisation. Un lien avec l’audit conserve les
            moteurs et les données du dossier existant.
          </p>
        </fieldset>
        <fieldset disabled={saving || !canWrite || unavailable} className="space-y-4">
          <legend className="text-xl font-semibold">3. Composer votre petite équipe</legend>
          {mode === "guided" && (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Point de départ : un coordinateur et un exécutant. Cette proposition est un modèle de
              configuration, sans appel IA ; adaptez les responsabilités à votre objectif.
            </p>
          )}
          {mode === "template" && (
            <div className="grid gap-2 text-sm font-semibold">
              <label htmlFor="agent-team-template">Modèle d’équipe</label>
              <select
                id="agent-team-template"
                className={inputClass}
                value={template}
                onChange={(e) => {
                  const key = e.target.value as keyof typeof teamTemplates;
                  setTemplate(key);
                  setAgents(teamTemplates[key].map((a) => ({ ...a })));
                }}
              >
                <option value="general">Équipe généraliste</option>
                <option value="research">Recherche et rapports</option>
                <option value="content">Création de contenu</option>
              </select>
            </div>
          )}
          <p className="text-sm text-indigo-200">
            Vous → premier agent coordinateur → autres agents. Trois profils maximum pour commencer.
          </p>
          {agents.map((agent, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-2"
            >
              <label className="grid gap-2 text-sm font-semibold">
                Nom de l’agent {index + 1}
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={agent.name}
                  onChange={(e) =>
                    setAgents((current) =>
                      current.map((a, i) => (i === index ? { ...a, name: e.target.value } : a)),
                    )
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Responsabilité de l’agent {index + 1}
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={agent.role}
                  onChange={(e) =>
                    setAgents((current) =>
                      current.map((a, i) => (i === index ? { ...a, role: e.target.value } : a)),
                    )
                  }
                  className={inputClass}
                />
              </label>
              {index > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-fit"
                  onClick={() => setAgents((current) => current.filter((_, i) => i !== index))}
                >
                  Retirer l’agent {index + 1}
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={agents.length >= 3}
            onClick={() => setAgents((current) => [...current, { name: "", role: "" }])}
          >
            Ajouter un agent
          </Button>
          <div className="grid gap-2 text-sm font-semibold">
            <label htmlFor="agent-company-autonomy">Autonomie souhaitée au raccordement</label>
            <select
              id="agent-company-autonomy"
              className={inputClass}
              value={autonomy}
              onChange={(e) => setAutonomy(e.target.value as AgentCompanyInput["autonomy"])}
            >
              <option value="approval">Validation préalable des actions importantes</option>
              <option value="scoped">Actions précises autorisées à l’avance</option>
              <option value="bounded">Autonomie avec limites définies</option>
            </select>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            Hermes, skills, plugins, API et MCP seront liés à chaque profil au raccordement. Aucun
            secret ou droit d’exécution n’est enregistré par ce formulaire. Une seule exécution
            simultanée sera prévue pour le pilote.
          </p>
        </fieldset>
        <Button disabled={saving || !canWrite || unavailable} type="submit" className="min-h-11">
          {saving ? "Enregistrement en cours…" : "Enregistrer l’entreprise IA"}
        </Button>
        {!canWrite && !unavailable && (
          <p className="text-sm text-slate-300">Votre rôle permet uniquement la consultation.</p>
        )}
      </form>
      <section className="space-y-4" aria-label="Entreprises IA enregistrées">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Vos entreprises IA</h2>
          <Button className="min-h-11" variant="outline" onClick={refresh} disabled={saving}>
            Actualiser
          </Button>
        </div>
        {items.length === 0 && !unavailable && (
          <p className="rounded-xl border border-white/10 p-5 text-slate-300">
            Aucune entreprise IA enregistrée dans votre organisation.
          </p>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5"
          >
            <div>
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p className="mt-1 text-sm text-amber-200">
                En préparation · agents non démarrés · budget API 0 €
              </p>
            </div>
            <p className="text-sm leading-6 whitespace-pre-wrap text-slate-300">{item.objective}</p>
            <ol className="grid gap-3 sm:grid-cols-3">
              {item.agents.map((a, i) => (
                <li key={i} className="rounded-xl border border-white/10 p-3 text-sm">
                  <strong>{a.name}</strong>
                  <p className="mt-1 text-slate-400">
                    {i === 0
                      ? "Sous votre direction"
                      : "Sous la coordination de " + item.agents[0].name}
                  </p>
                  <p className="mt-2 text-slate-300">{a.role}</p>
                </li>
              ))}
            </ol>
            <details className="rounded-xl border border-white/10 p-4">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-indigo-200">
                Connexion et compétences Hermes
              </summary>
              <div className="mt-3 grid gap-4 xl:grid-cols-2">
                <HermesConnectionPanel workspaceId={item.id} />
                <HermesInventoryPanel workspaceId={item.id} />
              </div>
            </details>
            <div className="grid gap-2 text-sm font-semibold">
              <label htmlFor={`agent-company-link-${item.id}`}>Dossier lié à {item.name}</label>
              <select
                id={`agent-company-link-${item.id}`}
                disabled={saving || !canWrite}
                value={item.company_id || ""}
                onChange={(e) => link(item.id, e.target.value)}
                className={inputClass}
              >
                <option value="">Espace indépendant</option>
                {item.company_id && !companies.some((c) => c.id === item.company_id) && (
                  <option value={item.company_id}>
                    Dossier lié (non présent dans cette liste)
                  </option>
                )}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {item.company_id && (
              <Link
                className="inline-flex min-h-11 items-center text-sm text-indigo-300 underline"
                href={`/companies/${encodeURIComponent(item.company_id)}/atelier-ia`}
              >
                Ouvrir l’atelier du dossier
              </Link>
            )}
          </article>
        ))}
        {hasMore && (
          <p className="text-sm text-slate-400">
            Les vingt configurations les plus récentes sont affichées.
          </p>
        )}
      </section>
    </section>
  );
}
