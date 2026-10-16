"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { WorkspaceSetup } from "./workspace-setup";
import { WorkspaceThemeContext, useWorkspaceTheme } from "./workspace-theme";
import "./workspace-platform.css";
import { Button } from "@/components/ui/button";
import { HermesConnectionPanel } from "./hermes-connection-panel";
import { HermesInventoryPanel } from "./hermes-inventory-panel";
import { FreePilotPanel, type FreePilotHandle } from "./free-pilot-panel";
import {
  CodexApplicationMenus,
  CodexSidebarTools,
  CodexProfileMenu,
  CodexConversationMenu,
  type WorkspaceCommand,
} from "./codex-shell-menus";
import { CodexSettings, CodexFeature } from "./codex-settings";
import { useWorkspaceAppearance } from "./workspace-appearance";
import { CodexMenu } from "./codex-menu";
import type { CodexFeatureId, CodexSettingId } from "../domain/codex-navigation";
import { AgentAvatar } from "./agent-avatar";
import {
  Plus,
  MessagesSquare,
  Users,
  Plug,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Command,
} from "lucide-react";
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
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [settings, setSettings] = useState<CodexSettingId | null>(null);
  const [feature, setFeature] = useState<CodexFeatureId | null>(null);
  const pilot = useRef<FreePilotHandle>(null);
  const commandSequence = useRef(0);
  const appliedCommand = useRef(0);
  const [pendingCommand, setPendingCommand] = useState<{
    id: number;
    type: Exclude<WorkspaceCommand, "create" | "sidebar">;
  } | null>(null);
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
  const [theme, setTheme] = useWorkspaceTheme(() =>
    setNotice(
      "Le thème est appliqué pour cette session ; le navigateur ne permet pas de le mémoriser.",
    ),
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [appearance, setAppearance] = useWorkspaceAppearance(setNotice);
  function command(type: WorkspaceCommand) {
    if (type === "sidebar") {
      setSidebarVisible((value) => !value);
      return;
    }
    if (type === "create") {
      if (canWrite) {
        setCreating(true);
        setRailOpen(false);
      }
      return;
    }
    if (!selectedId) {
      setNotice("Choisissez ou créez d’abord une entreprise IA.");
      return;
    }
    setCreating(false);
    if (type === "new") setView("Missions");
    setPendingCommand({ id: ++commandSequence.current, type });
  }
  useEffect(() => {
    if (
      creating ||
      !pendingCommand ||
      !pilot.current ||
      appliedCommand.current === pendingCommand.id
    )
      return;
    appliedCommand.current = pendingCommand.id;
    const actions = {
      new: pilot.current.newMission,
      search: pilot.current.search,
      refresh: pilot.current.refresh,
      copy: pilot.current.copyResult,
      export: pilot.current.exportResult,
    };
    actions[pendingCommand.type]();
  }, [creating, pendingCommand, selectedId]);
  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement)?.closest("dialog"))
        return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        command("search");
      } else if (event.key.toLowerCase() === "n" && event.altKey) {
        event.preventDefault();
        command("new");
      } else if (event.key === ",") {
        event.preventDefault();
        setSettings("general");
      }
    }
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  });
  const menuProps = {
    onCommand: command,
    onFeature: setFeature,
    onSettings: setSettings,
    onView: (value: string) => {
      if (document.activeElement instanceof HTMLButtonElement)
        inspectorTrigger.current = document.activeElement;
      setView(value);
    },
    onMessageSize: (delta: number) =>
      setAppearance((current) => ({
        ...current,
        messageSize: delta === 0 ? 14 : Math.max(12, Math.min(18, current.messageSize + delta)),
      })),
    canWrite,
  };
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
    <WorkspaceThemeContext.Provider value={theme}>
      <div
        className="agent-studio platform-studio"
        data-platform-theme={theme}
        data-creating={creating}
        data-compact={appearance.compact}
        data-sidebar-hidden={!sidebarVisible}
        data-reduce-motion={appearance.reduceMotion}
        style={{ "--message-size": `${appearance.messageSize}px` } as CSSProperties}
        onKeyDown={(event) => {
          if (event.key === "Escape" && railOpen) {
            setRailOpen(false);
            railTrigger.current?.focus();
          } else if (event.key === "Escape" && view !== "Missions") {
            closeInspector();
          }
        }}
      >
        <div className="platform-appbar">
          <CodexApplicationMenus {...menuProps} />
          <div className="platform-theme-switch" aria-label="Thème de l’interface">
            <button
              type="button"
              aria-label="Thème clair"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <Sun size={15} aria-hidden="true" />
              <span>Clair</span>
            </button>
            <button
              type="button"
              aria-label="Thème sombre"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <Moon size={15} aria-hidden="true" />
              <span>Sombre</span>
            </button>
          </div>
        </div>
        <aside
          id="studio-rail-content"
          className="studio-rail"
          data-open={railOpen}
          aria-label="Équipes et missions"
        >
          <div className="codex-rail-header">
            <Link href="/" aria-label="Accueil Optivos" className="studio-brand">
              <span className="platform-brand-mark">
                <Command size={19} aria-hidden="true" />
              </span>
              <span>
                Optivos<small>Workspace</small>
              </span>
            </Link>
            <button
              type="button"
              className="codex-rail-collapse"
              aria-label="Replier la barre latérale"
              onClick={() => {
                if (window.matchMedia("(max-width: 767px)").matches) {
                  setRailOpen(false);
                  railTrigger.current?.focus();
                } else {
                  command("sidebar");
                  requestAnimationFrame(() =>
                    document.getElementById("studio-sidebar-reopen")?.focus(),
                  );
                }
              }}
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          </div>
          <CodexSidebarTools {...menuProps} />
          <details className="codex-audit-menu">
            <summary>Audit Optivos</summary>
            <nav aria-label="Navigation de l’espace" className="studio-rail-nav">
              <Link href="/?view=audit">Vue d’ensemble des audits</Link>
              <Link href="/companies">Dossiers d’audit</Link>
            </nav>
          </details>
          <div className="studio-rail-section">
            <div className="studio-rail-label">
              <span>Mes espaces</span>
              <CodexMenu
                label="Options des projets"
                items={[
                  {
                    label: "Nouveau projet",
                    action: () => command("create"),
                    unavailable: canWrite ? undefined : "Votre rôle est limité à la consultation.",
                  },
                  { label: "Actualiser les projets", action: refresh },
                  {
                    label: "Organiser la barre latérale",
                    children: [
                      {
                        label: "Par projet",
                        unavailable: "Le regroupement par entreprise IA est imposé pour ce pilote.",
                      },
                      {
                        label: "Par connexion",
                        unavailable: "Une seule connexion VPS est raccordée.",
                      },
                      {
                        label: "Nouvelle section",
                        unavailable: "Les sections personnalisées ne sont pas raccordées.",
                      },
                    ],
                  },
                ]}
              >
                <Plus size={16} aria-hidden="true" />
              </CodexMenu>
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
              <div
                key={item.id}
                className="codex-project-row"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.currentTarget
                    .querySelector<HTMLButtonElement>("[aria-haspopup=menu]")
                    ?.click();
                }}
              >
                <button
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
                <CodexMenu
                  label={`Options de ${item.name}`}
                  items={[
                    {
                      label: "Ouvrir",
                      action: () => {
                        setSelectedId(item.id);
                        setCreating(false);
                      },
                    },
                    {
                      label: "Paramètres du projet",
                      action: () => {
                        setSelectedId(item.id);
                        setCreating(false);
                        setView("Réglages");
                      },
                    },
                    {
                      label: "Épingler",
                      unavailable: "L’épinglage n’est pas raccordé au registre Optivos.",
                    },
                    {
                      label: "Renommer",
                      unavailable:
                        "La modification du nom n’est pas exposée par le registre actuel.",
                    },
                    {
                      label: "Archiver",
                      unavailable: "L’archivage des entreprises IA n’est pas raccordé.",
                    },
                    {
                      label: "Supprimer",
                      unavailable:
                        "Aucune suppression d’entreprise IA n’est autorisée depuis ce menu.",
                    },
                  ]}
                >
                  <span aria-hidden="true">···</span>
                </CodexMenu>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-slate-400">Aucune équipe enregistrée.</p>
            )}
            {hasMore && (
              <p className="text-xs text-slate-400">Les vingt équipes les plus récentes.</p>
            )}
          </div>
          <div ref={setHistoryTarget} className="studio-history-slot" hidden={items.length === 0} />
          <div className="studio-rail-footer">
            <span className="studio-budget-dot" aria-hidden="true" />
            Budget API : 0 €<span>Vous validez les résultats.</span>
            <CodexProfileMenu {...menuProps} />
          </div>
        </aside>
        <section className="studio-desk" aria-label="Espace de travail de l’équipe">
          <header className="studio-titlebar">
            {!sidebarVisible && (
              <button
                type="button"
                id="studio-sidebar-reopen"
                className="codex-rail-reopen"
                aria-label="Afficher la barre latérale"
                onClick={() => {
                  command("sidebar");
                  requestAnimationFrame(() =>
                    document.querySelector<HTMLButtonElement>(".codex-rail-collapse")?.focus(),
                  );
                }}
              >
                <PanelLeftOpen size={18} aria-hidden="true" />
              </button>
            )}
            <button
              ref={railTrigger}
              type="button"
              className="studio-mobile-toggle"
              aria-label="Équipes & missions"
              aria-expanded={railOpen}
              aria-controls="studio-rail-content"
              onClick={() => setRailOpen(!railOpen)}
            >
              <PanelLeftOpen size={18} aria-hidden="true" />
              <span>Espaces</span>
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
                  <CodexConversationMenu {...menuProps} />
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
          {creating && (
            <WorkspaceSetup
              value={{ name, objective, mode, agents, autonomy, companyId: companyId || null }}
              template={template}
              onTemplate={setTemplate}
              onChange={(patch) => {
                if (patch.name !== undefined) setName(patch.name);
                if (patch.objective !== undefined) setObjective(patch.objective);
                if (patch.mode !== undefined) setMode(patch.mode);
                if (patch.agents !== undefined) setAgents(patch.agents);
                if (patch.autonomy !== undefined) setAutonomy(patch.autonomy);
                if (patch.companyId !== undefined) setCompanyId(patch.companyId || "");
              }}
              companies={companies}
              disabled={saving || !canWrite || unavailable}
              saving={saving}
              onSubmit={create}
            />
          )}
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
                <div
                  className="studio-desk-body"
                  data-inspector={view !== "Missions"}
                  key={item.id}
                >
                  <article className="studio-conversation" aria-label={item.name}>
                    <FreePilotPanel
                      ref={pilot}
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
                      <button
                        type="button"
                        onClick={closeInspector}
                        aria-label="Fermer les détails"
                      >
                        ×
                      </button>
                    </div>
                    <div hidden={view !== "Équipe"} className="space-y-5">
                      <p className="text-sm text-slate-400">{item.objective}</p>
                      <p className="text-xs text-amber-200">
                        Équipe en préparation · budget API 0 €
                      </p>
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
                            <option value={item.company_id}>
                              Dossier lié (hors de cette liste)
                            </option>
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
        {settings && (
          <CodexSettings
            key={settings}
            initialCategory={settings}
            workspace={items.find((item) => item.id === selectedId)}
            canWrite={canWrite}
            appearance={appearance}
            onAppearance={setAppearance}
            onClose={() => setSettings(null)}
          />
        )}
        {feature && (
          <CodexFeature
            feature={feature}
            canWrite={canWrite}
            workspace={items.find((item) => item.id === selectedId)}
            onClose={() => setFeature(null)}
            onNewProject={() => command("create")}
            onNewMission={() => command("new")}
          />
        )}
      </div>
    </WorkspaceThemeContext.Provider>
  );
}
