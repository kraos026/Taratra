"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { OptivosLogo } from "@/components/brand/optivos-logo";
import { Button } from "@/components/ui/button";
import { HermesConnectionPanel } from "./hermes-connection-panel";
import { HermesInventoryPanel } from "./hermes-inventory-panel";
import { FreePilotPanel } from "./free-pilot-panel";
import { AgentAvatar } from "./agent-avatar";
import { Plus, MessagesSquare, Users, Plug, SlidersHorizontal } from "lucide-react";
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
  const [selectedId, setSelectedId] = useState(initial[0]?.id || "");
  const [creating, setCreating] = useState(initial.length === 0 && canWrite && !unavailable);
  const [view, setView] = useState("Missions");
  const [historyTarget, setHistoryTarget] = useState<HTMLDivElement | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const railTrigger = useRef<HTMLButtonElement>(null);
  const inspectorTrigger = useRef<HTMLButtonElement | null>(null);
  function closeInspector() {
    setView("Missions");
    inspectorTrigger.current?.focus();
  }
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
      if (!list.items.some((item) => item.id === selectedId))
        setSelectedId(list.items[0]?.id || "");
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
      setSelectedId(data.id);
      setCreating(false);
      setView("Équipe");
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
    <div
      className="agent-studio codex-studio"
      data-creating={creating}
      onKeyDown={(event) => {
        if (event.key === "Escape" && railOpen) {
          setRailOpen(false);
          railTrigger.current?.focus();
        } else if (event.key === "Escape" && view !== "Missions") {
          closeInspector();
        }
      }}
    >
      <aside
        id="studio-rail-content"
        className="studio-rail"
        data-open={railOpen}
        aria-label="Équipes et missions"
      >
        <Link href="/" aria-label="Accueil Optivos" className="studio-brand">
          <OptivosLogo compact />
          <span>Optivos</span>
        </Link>
        <nav aria-label="Navigation de l’espace" className="studio-rail-nav">
          <Link href="/?view=audit">Vue d’ensemble des audits</Link>
          <Link href="/companies">Dossiers d’audit</Link>
          <Button
            type="button"
            variant="ghost"
            disabled={!canWrite || saving || unavailable}
            onClick={() => {
              setCreating(true);
              setRailOpen(false);
            }}
          >
            <Plus size={16} aria-hidden="true" /> Nouvelle équipe
          </Button>
        </nav>
        <div className="studio-rail-section">
          <div className="studio-rail-label">
            <span>Équipes</span>
            <button
              type="button"
              disabled={saving}
              onClick={refresh}
              aria-label="Actualiser"
              title="Actualiser les équipes"
            >
              ↻
            </button>
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={saving}
              aria-pressed={selectedId === item.id && !creating}
              className="studio-team-choice"
              onClick={() => {
                setSelectedId(item.id);
                setCreating(false);
                setView("Missions");
                setRailOpen(false);
              }}
            >
              <AgentAvatar size={28} />
              <span>{item.name}</span>
            </button>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-slate-400">Aucune équipe enregistrée.</p>
          )}
          {hasMore && (
            <p className="text-xs text-slate-400">Les vingt équipes les plus récentes.</p>
          )}
        </div>
        <div ref={setHistoryTarget} className="studio-history-slot" />
        <div className="studio-rail-footer">
          <span className="studio-budget-dot" aria-hidden="true" />
          Budget API : 0 €<span>Vous validez les résultats.</span>
        </div>
      </aside>
      <section className="studio-desk" aria-label="Espace de travail de l’équipe">
        <header className="studio-titlebar">
          <button
            ref={railTrigger}
            type="button"
            className="studio-mobile-toggle"
            aria-expanded={railOpen}
            aria-controls="studio-rail-content"
            onClick={() => setRailOpen(!railOpen)}
          >
            Équipes & missions
          </button>
          <div className="studio-title">
            <span className="studio-breadcrumb">Atelier IA /</span>
            <h1>
              {creating
                ? "Créer votre entreprise IA"
                : items.find((item) => item.id === selectedId)?.name || "Votre espace IA"}
            </h1>
          </div>
          {creating && items.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setCreating(false)}
            >
              Revenir à mon équipe
            </Button>
          ) : (
            !creating && (
              <nav className="studio-context-actions" aria-label="Vues de l’équipe">
                {[
                  ["Missions", MessagesSquare],
                  ["Équipe", Users],
                  ["Connexion", Plug],
                  ["Réglages", SlidersHorizontal],
                ].map(([label, Icon]) => {
                  const TabIcon = Icon as typeof Users;
                  return (
                    <button
                      type="button"
                      key={String(label)}
                      aria-label={String(label)}
                      aria-current={view === label ? "page" : undefined}
                      onClick={(event) => {
                        setView(String(label));
                        if (label !== "Missions") inspectorTrigger.current = event.currentTarget;
                      }}
                    >
                      <TabIcon size={16} aria-hidden="true" />
                      <span>{String(label)}</span>
                    </button>
                  );
                })}
              </nav>
            )
          )}
        </header>
        {unavailable && (
          <p role="alert" className="studio-alert">
            Le registre est indisponible ; la création est désactivée.
          </p>
        )}
        {error && (
          <p role="alert" className="studio-alert">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" aria-live="polite" className="studio-notice">
            {notice}
          </p>
        )}
        <form hidden={!creating} onSubmit={create} className="studio-create space-y-5">
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
              L’espace indépendant appartient à votre organisation. Un lien avec l’audit conserve
              les moteurs et les données du dossier existant.
            </p>
          </fieldset>
          <fieldset disabled={saving || !canWrite || unavailable} className="space-y-4">
            <legend className="text-xl font-semibold">3. Composer votre petite équipe</legend>
            {mode === "guided" && (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Point de départ : un coordinateur et un exécutant. Cette proposition est un modèle
                de configuration, sans appel IA ; adaptez les responsabilités à votre objectif.
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
              Vous → premier agent coordinateur → autres agents. Trois profils maximum pour
              commencer.
            </p>
            {agents.map((agent, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-2"
              >
                <div className="flex items-center gap-3 sm:col-span-2">
                  <AgentAvatar variant={index} />
                  <span className="text-sm text-slate-300">
                    {index === 0 ? "Votre coordinateur" : "Votre spécialiste"} · profil à configurer
                  </span>
                </div>
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
              Les skills, plugins, API et MCP de chaque profil demanderont des permissions au
              raccordement. Aucun secret ou droit d’action externe n’est enregistré par ce
              formulaire. Les missions textuelles pilotes s’exécutent une par une.
            </p>
          </fieldset>
          <Button disabled={saving || !canWrite || unavailable} type="submit" className="min-h-11">
            {saving ? "Enregistrement en cours…" : "Enregistrer l’entreprise IA"}
          </Button>
          {!canWrite && !unavailable && (
            <p className="text-sm text-slate-300">Votre rôle permet uniquement la consultation.</p>
          )}
        </form>
        <div hidden={creating} className="studio-active-workspace">
          {items.length === 0 && (
            <div className="pilot-empty">
              <AgentAvatar size={80} />
              <h2>Aucune entreprise IA enregistrée dans votre organisation.</h2>
            </div>
          )}
          {items
            .filter((item) => item.id === selectedId)
            .map((item) => (
              <div className="studio-desk-body" data-inspector={view !== "Missions"} key={item.id}>
                <article className="studio-conversation" aria-label={item.name}>
                  <FreePilotPanel
                    workspaceId={item.id}
                    canWrite={canWrite}
                    historyTarget={historyTarget}
                    onMissionSelected={() => setRailOpen(false)}
                  />
                </article>
                <aside
                  className="studio-inspector"
                  hidden={view === "Missions"}
                  aria-label="Détails de l’équipe"
                >
                  <div className="studio-inspector-title">
                    <h2>{view}</h2>
                    <button type="button" onClick={closeInspector} aria-label="Fermer les détails">
                      ×
                    </button>
                  </div>
                  <div hidden={view !== "Équipe"} className="space-y-5">
                    <p className="text-sm text-slate-400">{item.objective}</p>
                    <p className="text-xs text-amber-200">Équipe en préparation · budget API 0 €</p>
                    <ol className="space-y-4">
                      {item.agents.map((agent, index) => (
                        <li key={index} className="studio-agent-profile">
                          <AgentAvatar variant={index} size={48} />
                          <div>
                            <strong>{agent.name}</strong>
                            <p className="mt-1 text-xs text-slate-400">
                              {index === 0
                                ? "Sous votre direction"
                                : "Sous la coordination de " + item.agents[0].name}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">{agent.role}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs leading-5 text-slate-400">
                      Profils configurés. Le pilote est exécuté par Hermes ; la délégation entre
                      profils reste à raccorder.
                    </p>
                    <details>
                      <summary className="min-h-11 cursor-pointer py-3 text-sm">
                        Activation progressive
                      </summary>
                      <p className="text-sm leading-6 text-slate-400">
                        La création conserve l’objectif et les profils. Les actions externes et la
                        délégation restent à raccorder.
                      </p>
                    </details>
                  </div>
                  <section
                    hidden={view !== "Connexion"}
                    aria-label="Connexion et compétences Hermes"
                    className="space-y-4"
                  >
                    <HermesConnectionPanel workspaceId={item.id} />
                    <HermesInventoryPanel workspaceId={item.id} />
                  </section>
                  <div hidden={view !== "Réglages"} className="space-y-4">
                    <label htmlFor={`agent-company-link-${item.id}`} className="block text-sm">
                      Dossier lié à {item.name}
                    </label>
                    <select
                      id={`agent-company-link-${item.id}`}
                      className={inputClass}
                      value={item.company_id || ""}
                      disabled={saving || !canWrite}
                      onChange={(event) => link(item.id, event.target.value)}
                    >
                      <option value="">Espace indépendant</option>
                      {item.company_id &&
                        !companies.some((company) => company.id === item.company_id) && (
                          <option value={item.company_id}>Dossier lié (hors de cette liste)</option>
                        )}
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm leading-6 text-slate-400">
                      Les missions textuelles sont soumises au plafond API de 0 €. Aucune action
                      externe n’est activée.
                    </p>
                    {item.company_id && (
                      <Link
                        href={`/companies/${encodeURIComponent(item.company_id)}/atelier-ia`}
                        className="inline-flex min-h-11 items-center text-sm text-indigo-200 underline"
                      >
                        Ouvrir l’atelier du dossier
                      </Link>
                    )}
                  </div>
                </aside>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
