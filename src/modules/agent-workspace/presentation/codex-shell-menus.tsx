"use client";
import { useEffect, useRef } from "react";
import {
  Search,
  SquarePen,
  Clock3,
  Bot,
  Blocks,
  Sparkles,
  Plug,
  GitPullRequest,
  Settings,
  Ellipsis,
} from "lucide-react";
import { CodexMenu, type MenuEntry } from "./codex-menu";
import type { CodexFeatureId, CodexSettingId } from "../domain/codex-navigation";

export type WorkspaceCommand =
  "new" | "search" | "refresh" | "copy" | "export" | "create" | "sidebar";
type Props = {
  onCommand: (command: WorkspaceCommand) => void;
  onFeature: (feature: CodexFeatureId) => void;
  onSettings: (category: CodexSettingId) => void;
  onView: (view: string) => void;
  onMessageSize: (delta: number) => void;
  canWrite: boolean;
};
const notConnected =
  "Cette commande Codex n’est pas raccordée à Optivos. Aucune action n’a été exécutée.";
export function CodexApplicationMenus(props: Props) {
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    function remember(event: FocusEvent) {
      const target = event.target;
      if (
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement && ["text", "search"].includes(target.type))
      )
        input.current = target;
    }
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  function edit(command: "undo" | "redo" | "selectAll" | "delete") {
    if (input.current?.isConnected) {
      input.current.focus();
      document.execCommand(command);
    }
  }
  const menus: [string, MenuEntry[]][] = [
    [
      "Fichier",
      [
        {
          label: "Nouveau chat",
          shortcut: "Ctrl+Alt+N",
          action: () => props.onCommand("new"),
          unavailable: props.canWrite ? undefined : "Votre rôle est limité à la consultation.",
        },
        {
          label: "Nouveau projet",
          action: () => props.onCommand("create"),
          unavailable: props.canWrite ? undefined : "Votre rôle est limité à la consultation.",
        },
        { label: "Ouvrir un projet…", action: () => props.onFeature("projects") },
        {
          label: "Ouvrir un dossier…",
          unavailable: "Les dossiers locaux ne sont pas raccordés au runtime VPS.",
        },
        {
          label: "Conversation temporaire",
          unavailable:
            "Le pilote conserve les missions et leurs preuves ; le mode temporaire n’est pas pris en charge.",
        },
        {
          label: "Nouveau chat sans projet",
          unavailable: "Les missions doivent appartenir à un espace Optivos pour isoler les accès.",
        },
        {
          label: "Nouvelle fenêtre",
          unavailable:
            "Dans cette version web, les fenêtres et onglets se gèrent dans le navigateur.",
        },
        { label: "Importer…", unavailable: notConnected },
        { label: "Exporter le résultat…", action: () => props.onCommand("export") },
        { label: "Fermer le chat affiché", action: () => props.onCommand("new") },
        { label: "Paramètres…", shortcut: "Ctrl+,", action: () => props.onSettings("general") },
        {
          label: "Quitter",
          unavailable: "Fermez l’onglet du navigateur pour quitter cette version web.",
        },
      ],
    ],
    [
      "Édition",
      [
        { label: "Annuler", shortcut: "Ctrl+Z", action: () => edit("undo") },
        { label: "Rétablir", shortcut: "Ctrl+Maj+Z", action: () => edit("redo") },
        {
          label: "Couper",
          shortcut: "Ctrl+X",
          unavailable:
            "Utilisez Ctrl+X dans le champ de saisie ; le presse-papiers est contrôlé par le navigateur.",
        },
        { label: "Copier le résultat", action: () => props.onCommand("copy") },
        {
          label: "Copier",
          shortcut: "Ctrl+C",
          action: () => {
            const field = input.current;
            const text = field?.isConnected
              ? field.value.slice(field.selectionStart || 0, field.selectionEnd || 0)
              : window.getSelection()?.toString();
            if (text && navigator.clipboard)
              void navigator.clipboard.writeText(text).catch(() => {});
          },
        },
        {
          label: "Coller",
          shortcut: "Ctrl+V",
          unavailable:
            "Utilisez Ctrl+V dans le champ de saisie ; le navigateur gère cette autorisation.",
        },
        { label: "Tout sélectionner", shortcut: "Ctrl+A", action: () => edit("selectAll") },
        { label: "Supprimer la sélection", action: () => edit("delete") },
        { label: "Rechercher…", shortcut: "Ctrl+K", action: () => props.onCommand("search") },
      ],
    ],
    [
      "Affichage",
      [
        { label: "Afficher / masquer la barre latérale", action: () => props.onCommand("sidebar") },
        {
          label: "Panneau latéral",
          children: [
            { label: "Équipe", action: () => props.onView("Équipe") },
            { label: "Connexion", action: () => props.onView("Connexion") },
            { label: "Réglages", action: () => props.onView("Réglages") },
            { label: "Fermer le panneau", action: () => props.onView("Missions") },
          ],
        },
        { label: "Terminal", unavailable: notConnected },
        { label: "Panneau inférieur", unavailable: notConnected },
        { label: "Arborescence des fichiers", unavailable: notConnected },
        { label: "Résumé épinglé", unavailable: notConnected },
        {
          label: "Navigateur",
          children: [
            "Ouvrir un onglet",
            "Barre d’adresse",
            "Recharger la page",
            "Recharger sans le cache",
            "Précédent",
            "Suivant",
            "Copier l’URL du navigateur",
          ].map((label) => ({
            label,
            unavailable: "Le navigateur intégré de Codex n’est pas raccordé à ce poste web.",
          })),
        },
        {
          label: "Conversation précédente",
          unavailable: "Choisissez une mission dans la liste des conversations chargées.",
        },
        {
          label: "Conversation suivante",
          unavailable: "Choisissez une mission dans la liste des conversations chargées.",
        },
        { label: "Revue de code", action: () => props.onFeature("review") },
        { label: "Agrandir le texte", action: () => props.onMessageSize(2) },
        { label: "Réduire le texte", action: () => props.onMessageSize(-2) },
        { label: "Taille réelle du texte", action: () => props.onMessageSize(0) },
        {
          label: "Plein écran",
          action: () => {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
            else void document.documentElement.requestFullscreen?.().catch(() => {});
          },
        },
        { label: "Actualiser les missions", action: () => props.onCommand("refresh") },
      ],
    ],
    [
      "Aide",
      [
        {
          label: "Documentation",
          action: () => {
            window.open("https://developers.openai.com/codex/app", "_blank", "noopener,noreferrer");
          },
        },
        {
          label: "Nouveautés",
          action: () => {
            window.open(
              "https://developers.openai.com/codex/changelog",
              "_blank",
              "noopener,noreferrer",
            );
          },
        },
        { label: "Raccourcis clavier", action: () => props.onSettings("shortcuts") },
        { label: "Dépannage", action: () => props.onFeature("connections") },
        { label: "État du système", action: () => props.onFeature("connections") },
        {
          label: "Gestionnaire de tâches",
          unavailable:
            "La liste des processus du VPS n’est pas exposée dans ce poste. Les états des missions restent consultables dans le fil.",
        },
        { label: "Fonctions disponibles", action: () => props.onFeature("about") },
        {
          label: "Signaler un problème",
          unavailable: "L’envoi d’un rapport depuis ce menu n’est pas raccordé.",
        },
        {
          label: "Rechercher des mises à jour",
          unavailable:
            "Le staging est mis à jour par les déploiements Vercel ; aucun programme de mise à jour local n’est installé.",
        },
        { label: "À propos d’Optivos", action: () => props.onFeature("about") },
      ],
    ],
  ];
  return (
    <nav className="codex-menubar" aria-label="Menu de l’application">
      {menus.map(([label, items]) => (
        <CodexMenu key={label} label={label} items={items} />
      ))}
      <span className="codex-menubar-product">Optivos</span>
    </nav>
  );
}
export function CodexSidebarTools(props: Props) {
  return (
    <div className="codex-sidebar-tools">
      <button
        type="button"
        aria-label="Nouveau chat"
        disabled={!props.canWrite}
        onClick={() => props.onCommand("new")}
      >
        <SquarePen size={17} aria-hidden="true" />
        <span>Nouveau chat</span>
        <kbd>⌃⌥N</kbd>
      </button>
      <button type="button" aria-label="Rechercher" onClick={() => props.onCommand("search")}>
        <Search size={17} aria-hidden="true" />
        <span>Rechercher</span>
        <kbd>⌃K</kbd>
      </button>
      <button type="button" onClick={() => props.onFeature("scheduled")}>
        <Clock3 size={17} aria-hidden="true" />
        <span>Planifiées</span>
      </button>
      <button type="button" onClick={() => props.onFeature("agents")}>
        <Bot size={17} aria-hidden="true" />
        <span>Agents</span>
      </button>
      <button type="button" onClick={() => props.onFeature("skills")}>
        <Sparkles size={17} aria-hidden="true" />
        <span>Compétences</span>
      </button>
      <button type="button" onClick={() => props.onFeature("plugins")}>
        <Blocks size={17} aria-hidden="true" />
        <span>Plugins</span>
      </button>
      <button type="button" onClick={() => props.onFeature("mcp")}>
        <Plug size={17} aria-hidden="true" />
        <span>Serveurs MCP</span>
      </button>
      <button type="button" onClick={() => props.onFeature("review")}>
        <GitPullRequest size={17} aria-hidden="true" />
        <span>Revue de code</span>
      </button>
      <CodexMenu
        label="Plus de menus"
        items={[
          { label: "Votre point", action: () => props.onFeature("orbit") },
          { label: "Espaces", action: () => props.onFeature("spaces") },
          { label: "Pull requests", action: () => props.onFeature("pullRequests") },
          { label: "Bibliothèque", action: () => props.onFeature("library") },
          { label: "Images", action: () => props.onFeature("images") },
          { label: "Sites", action: () => props.onFeature("sites") },
          { label: "GPTs", action: () => props.onFeature("gpts") },
          { label: "Finances", action: () => props.onFeature("finances") },
          { label: "Sécurité", action: () => props.onFeature("security") },
          { label: "Connexions", action: () => props.onFeature("connections") },
          { label: "Archives", action: () => props.onFeature("archive") },
        ]}
      >
        <Ellipsis size={17} aria-hidden="true" />
        <span>Plus</span>
      </CodexMenu>
    </div>
  );
}
export function CodexProfileMenu({
  onSettings,
  onFeature,
}: Pick<Props, "onSettings" | "onFeature">) {
  return (
    <CodexMenu
      label="Ouvrir le menu du profil"
      className="codex-profile-trigger"
      items={[
        { label: "Paramètres", shortcut: "Ctrl+,", action: () => onSettings("general") },
        { label: "Utilisation et facturation", action: () => onSettings("usage") },
        { label: "Compte", action: () => onSettings("account") },
        {
          label: "Changer d’espace",
          unavailable: "Le changement d’organisation se fait dans le parcours Optivos existant.",
        },
        {
          label: "Mettre à niveau",
          unavailable: "Aucun achat ou abonnement n’est proposé depuis ce pilote à budget API nul.",
        },
        { label: "Aide", action: () => onFeature("about") },
        {
          label: "Se déconnecter",
          action: () => {
            const form = document.createElement("form");
            form.method = "post";
            form.action = "/auth/logout";
            document.body.append(form);
            form.submit();
          },
        },
      ]}
    >
      <span className="codex-profile-avatar">O</span>
      <span>
        Optivos<span className="codex-profile-subtitle">Espace de travail</span>
      </span>
      <Settings size={16} aria-hidden="true" />
    </CodexMenu>
  );
}
export function CodexConversationMenu({
  onCommand,
  onSettings,
}: Pick<Props, "onCommand" | "onSettings">) {
  return (
    <CodexMenu
      label="Options de la conversation"
      items={[
        { label: "Copier le résultat", action: () => onCommand("copy") },
        { label: "Exporter le résultat…", action: () => onCommand("export") },
        { label: "Épingler", unavailable: notConnected },
        { label: "Renommer", unavailable: notConnected },
        { label: "Marquer comme non lu", unavailable: notConnected },
        {
          label: "Déplacer vers",
          children: [
            { label: "Un projet", unavailable: notConnected },
            { label: "Une section", unavailable: notConnected },
          ],
        },
        {
          label: "Partager",
          unavailable:
            "Le partage public des résultats n’est pas raccordé. Aucun lien ne sera créé.",
        },
        { label: "Dupliquer / bifurquer", unavailable: notConnected },
        { label: "Archiver", unavailable: notConnected },
        { label: "Supprimer", unavailable: notConnected },
        { label: "Paramètres du chat", action: () => onSettings("configuration") },
      ]}
    >
      <Ellipsis size={17} aria-hidden="true" />
    </CodexMenu>
  );
}
