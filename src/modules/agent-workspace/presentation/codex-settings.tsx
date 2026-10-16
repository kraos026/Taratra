"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { X, Search } from "lucide-react";
import {
  codexSettings,
  featureLabels,
  type CodexFeatureId,
  type CodexSettingId,
} from "../domain/codex-navigation";
import type { AgentCompany } from "../domain/agent-company";
import { HermesConnectionPanel } from "./hermes-connection-panel";
import { HermesInventoryPanel } from "./hermes-inventory-panel";
import { AgentAvatar } from "./agent-avatar";

export function CodexDialog({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`codex-dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label={`Fermer ${title}`} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Unavailable({ title }: { title: string }) {
  return (
    <div className="codex-unavailable">
      <h3>{title}</h3>
      <p>
        Ce menu est présent dans le catalogue de Codex. Sa fonction n’est pas raccordée à Optivos.
      </p>
      <p>Aucun service, installation, accès externe ou appel IA n’est déclenché ici.</p>
    </div>
  );
}
export type WorkspaceAppearance = { messageSize: number; reduceMotion: boolean; compact: boolean };
export function CodexSettings({
  initialCategory,
  workspace,
  canWrite,
  appearance,
  onAppearance,
  onClose,
}: {
  initialCategory: CodexSettingId;
  workspace?: AgentCompany;
  canWrite: boolean;
  appearance: WorkspaceAppearance;
  onAppearance: (value: WorkspaceAppearance) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<CodexSettingId>(initialCategory);
  const [query, setQuery] = useState("");
  const selected = codexSettings.find((item) => item[0] === category)!;
  const filtered = codexSettings.filter((item) =>
    item[1].toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")),
  );
  let content: ReactNode;
  if (category === "general")
    content = (
      <div className="codex-setting-rows">
        <Setting label="Application" value="Optivos · laboratoire" />
        <Setting label="Langue de l’interface" value="Français" />
        <Setting label="Mode d’exécution" value="Hermes · missions textuelles" />
        <Setting label="Budget de nouveaux frais API" value="0 € — contrôle côté serveur" />
        <Setting
          label="Rôle dans cet espace"
          value={canWrite ? "Modification autorisée" : "Consultation uniquement"}
        />
      </div>
    );
  else if (category === "appearance")
    content = (
      <div className="codex-setting-rows">
        <Setting label="Thème" value="Sombre" />
        <label className="codex-setting-row">
          <span>Taille du texte des messages</span>
          <select
            aria-label="Taille du texte des messages"
            value={appearance.messageSize}
            onChange={(event) =>
              onAppearance({ ...appearance, messageSize: Number(event.target.value) })
            }
          >
            {[12, 14, 16, 18].map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </label>
        <label className="codex-setting-row">
          <span>Barre latérale compacte</span>
          <input
            type="checkbox"
            checked={appearance.compact}
            onChange={(event) => onAppearance({ ...appearance, compact: event.target.checked })}
          />
        </label>
        <label className="codex-setting-row">
          <span>Réduire les mouvements</span>
          <input
            type="checkbox"
            checked={appearance.reduceMotion}
            onChange={(event) =>
              onAppearance({ ...appearance, reduceMotion: event.target.checked })
            }
          />
        </label>
        <p className="codex-setting-note">
          Préférences d’affichage enregistrées sur ce navigateur. Elles ne modifient ni Hermes ni
          les permissions.
        </p>
      </div>
    );
  else if (category === "shortcuts")
    content = (
      <div className="codex-setting-rows">
        <Setting label="Rechercher dans les missions chargées" value="Ctrl / ⌘ + K" />
        <Setting label="Nouveau chat" value="Ctrl / ⌘ + Alt + N" />
        <Setting label="Ouvrir les paramètres" value="Ctrl / ⌘ + ," />
        <Setting label="Fermer le menu ou le panneau" value="Échap" />
        <p className="codex-setting-note">
          Les raccourcis réservés au navigateur restent sous son contrôle.
        </p>
      </div>
    );
  else if (["configuration", "preferences", "usage"].includes(category))
    content = (
      <div className="codex-setting-rows">
        <Setting label="Moteur" value="Hermes AIAgent" />
        <Setting label="Politique de modèle" value="Gratuit vérifié avant chaque lancement" />
        <Setting label="Outils externes" value="Désactivés" />
        <Setting label="Repli payant" value="Interdit" />
        <Setting label="Concurrence" value="Une mission à la fois" />
        <Setting label="Facturation globale du compte" value="Non raccordée ; aucun solde déduit" />
        <p className="codex-setting-note">
          Ces limites sont imposées par le service. Ce panneau ne peut pas les lever.
        </p>
      </div>
    );
  else if (["connections", "environments", "remotes"].includes(category) && workspace)
    content = <HermesConnectionPanel workspaceId={workspace.id} />;
  else if (["skills", "plugins", "mcp"].includes(category) && workspace)
    content = (
      <>
        <p className="codex-setting-note">
          Inventaire réel du runtime Hermes, sur vérification manuelle. L’installation de plugins ou
          de serveurs MCP n’est pas raccordée.
        </p>
        <HermesInventoryPanel workspaceId={workspace.id} />
      </>
    );
  else if (category === "profile" || category === "account")
    content = (
      <div className="codex-setting-rows">
        <Setting label="Espace sélectionné" value={workspace?.name || "Aucun"} />
        <Setting
          label="Droits"
          value={canWrite ? "Création et missions autorisées dans cet espace" : "Lecture seule"}
        />
        <p className="codex-setting-note">
          L’identité et la session sont gérées par l’authentification Optivos existante.
        </p>
        <Link href="/?view=audit">Ouvrir mon tableau Optivos</Link>
      </div>
    );
  else content = <Unavailable title={selected[1]} />;
  return (
    <CodexDialog title="Paramètres" onClose={onClose} className="codex-settings-dialog">
      <div className="codex-settings-body">
        <aside aria-label="Rubriques des paramètres">
          <label className="codex-settings-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Rechercher dans les paramètres</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher"
            />
          </label>
          {["Personnel", "Code", "Intégrations", "Autres menus"].map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              {filtered
                .filter((item) => item[2] === group)
                .map((item) => (
                  <button
                    type="button"
                    key={item[0]}
                    aria-current={category === item[0] ? "page" : undefined}
                    onClick={() => setCategory(item[0])}
                  >
                    {item[1]}
                  </button>
                ))}
            </section>
          ))}
          {!filtered.length && <p>Aucun paramètre ne correspond.</p>}
        </aside>
        <main>
          <p className="codex-setting-breadcrumb">Paramètres / {selected[2]}</p>
          <h3>{selected[1]}</h3>
          {content}
        </main>
      </div>
    </CodexDialog>
  );
}
function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="codex-setting-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
export function CodexFeature({
  feature,
  workspace,
  onClose,
  onNewProject,
  canWrite,
}: {
  feature: CodexFeatureId;
  workspace?: AgentCompany;
  onClose: () => void;
  onNewProject: () => void;
  canWrite: boolean;
}) {
  const title = featureLabels[feature];
  let content: ReactNode;
  if (feature === "agents" && workspace)
    content = (
      <div className="space-y-5">
        <p>{workspace.objective}</p>
        {workspace.agents.map((agent, index) => (
          <div key={index} className="studio-agent-profile">
            <AgentAvatar variant={index} />
            <div>
              <h3>{agent.name}</h3>
              <p>{agent.role}</p>
            </div>
          </div>
        ))}
        <p className="codex-setting-note">
          Profils configurés. Le pilote est exécuté par Hermes ; la délégation entre profils reste à
          raccorder.
        </p>
      </div>
    );
  else if (["skills", "plugins", "mcp"].includes(feature) && workspace)
    content = (
      <>
        <p className="codex-setting-note">
          Consultez les capacités réellement retournées par Hermes. Ce menu n’installe aucun
          composant.
        </p>
        <HermesInventoryPanel workspaceId={workspace.id} />
      </>
    );
  else if (feature === "connections" && workspace)
    content = <HermesConnectionPanel workspaceId={workspace.id} />;
  else if (feature === "projects")
    content = (
      <>
        <p>
          Dans Optivos, les projets de ce poste sont les entreprises IA et leurs équipes,
          enregistrées dans votre organisation.
        </p>
        <button
          type="button"
          className="codex-action"
          disabled={!canWrite}
          onClick={() => {
            onClose();
            onNewProject();
          }}
        >
          Créer une entreprise IA
        </button>
      </>
    );
  else if (feature === "about")
    content = (
      <>
        <h3>Optivos · Atelier IA</h3>
        <p>
          Interface reconstruite à partir de l’organisation et des menus de Codex Desktop
          26.1007.9446.0. Le moteur utilisé reste Hermes.
        </p>
        <p>
          Laboratoire Preview ; les services Codex ne sont pas intégrés. Les missions et contrôles
          Optivos existants sont conservés.
        </p>
      </>
    );
  else content = <Unavailable title={title} />;
  return (
    <CodexDialog title={title} onClose={onClose}>
      <div className="codex-feature-body">{content}</div>
    </CodexDialog>
  );
}
