"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, ClipboardList, MessageSquare, Plug, Server, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HermesConnectionPanel } from "./hermes-connection-panel";
import { MissionMonitoringPanel } from "./mission-monitoring-panel";
import { GettingStartedPanel } from "./getting-started-panel";
import { HermesInventoryPanel } from "./hermes-inventory-panel";

const tabs = [
  { label: "Vue d’ensemble", icon: LayoutDashboard },
  { label: "Missions", icon: ClipboardList },
  { label: "Discussion", icon: MessageSquare },
  { label: "Capacités", icon: Plug },
  { label: "Installation", icon: Server },
] as const;
type Tab = (typeof tabs)[number]["label"];
type Company = { id: string; name: string; canWrite: boolean };

function Information({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{children}</div>
    </article>
  );
}

export function AgentWorkspacePanel({ company }: { company: Company }) {
  const [tab, setTab] = useState<Tab>("Vue d’ensemble");
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
            <Bot size={17} aria-hidden="true" /> Atelier IA · Hermes
          </p>
          <h1 className="mt-2 text-3xl font-bold">Votre poste de commande</h1>
          <p className="mt-3 text-slate-300">
            Entreprise : <strong>{company.name}</strong>
          </p>
        </div>
        <Link
          href={`/companies/${encodeURIComponent(company.id)}`}
          className="inline-flex min-h-11 items-center text-sm text-indigo-300 underline underline-offset-4"
        >
          Retour à mon entreprise
        </Link>
      </header>
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-amber-100">
        <strong>Connexion à finaliser · lancement désactivé</strong>
        <p className="mt-2 text-sm leading-6">
          Vous pouvez vérifier la connexion et consulter les missions réellement liées à ce dossier.
          Le lancement et la discussion attendent un raccordement sécurisé et une IA compatible avec
          votre plafond de 0 € de nouveaux frais API.
        </p>
      </div>
      {!company.canWrite && (
        <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">
          Votre rôle permet la consultation. Les futures commandes seront réservées aux rôles
          autorisés de cette entreprise.
        </p>
      )}
      <nav
        aria-label="Navigation de l’atelier"
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {tabs.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            aria-current={tab === label ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-400 ${tab === label ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-100" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
          >
            <Icon size={17} aria-hidden="true" className="shrink-0" />
            {label}
          </button>
        ))}
      </nav>
      {tab === "Vue d’ensemble" && (
        <>
          <GettingStartedPanel
            key={company.id}
            company={company}
            onConnection={() => setTab("Installation")}
            onActivity={() => setTab("Missions")}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Information title="Confier un travail à Hermes">
              <p>
                Décrivez votre objectif et le résultat attendu. Le parcours réunira les validations,
                l’exécution, le suivi et les fichiers livrés au même endroit.
              </p>
              <p className="text-amber-200">
                Aujourd’hui : consultation des états des missions liées. Création, arrêt,
                validations et récupération des résultats restent à raccorder.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => setTab("Missions")}>
                Ouvrir les missions
              </Button>
            </Information>
            <Information title="Discuter avec votre agent">
              <p>
                Une conversation pour préciser une demande et poursuivre un travail. Les échanges
                devront appartenir à cette entreprise.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => setTab("Discussion")}>
                Voir la discussion
              </Button>
            </Information>
            <Information title="Donner les bons outils à Hermes">
              <p>
                Skills, plugins, API et MCP : les capacités dépendent des connexions réellement
                installées et des autorisations accordées.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => setTab("Capacités")}>
                Voir les capacités
              </Button>
            </Information>
            <Information title="Votre VPS, votre espace">
              <p>
                Priorité à votre VPS Hostinger. Les premiers clients connecteront leur propre VPS ;
                l’hébergement chez nous viendra ensuite avec des espaces isolés.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => setTab("Installation")}>
                Vérifier l’installation
              </Button>
            </Information>
          </div>
          <Link
            href={`/companies/${encodeURIComponent(company.id)}/automation-audit`}
            className="inline-flex min-h-11 items-center text-sm text-indigo-300 underline"
          >
            Retrouver mon audit et mes recommandations
          </Link>
        </>
      )}
      {tab === "Missions" && (
        <>
          <Information title="Missions, validations et résultats">
            <p>
              Les états ci-dessous proviennent d’Hermes pour les missions enregistrées dans cette
              entreprise. Aucun résultat n’est inventé.
            </p>
            <p>
              Pour créer une mission, il reste à connecter le lancement avec un modèle vérifié, les
              permissions et l’enregistrement de la mission avant son suivi.
            </p>
            <Button disabled className="min-h-11" aria-describedby="mission-blocked">
              Nouvelle mission
            </Button>
            <p id="mission-blocked">
              Indisponible : lancement réel et contrôle du budget pas encore raccordés.
            </p>
          </Information>
          <MissionMonitoringPanel key={company.id} companyId={company.id} />
        </>
      )}
      {tab === "Discussion" && (
        <Information title="Discussion avec Hermes">
          <p>
            La conversation réelle n’est pas encore connectée à Optivos. Aucun message ne sera
            envoyé ou présenté comme une réponse d’Hermes avant ce raccordement.
          </p>
          <p>
            À raccorder : session privée par entreprise, historique conservé, choix du modèle et
            contrôle du coût avant chaque demande.
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => setTab("Installation")}>
            Voir les prérequis
          </Button>
        </Information>
      )}
      {tab === "Capacités" && (
        <>
          <HermesInventoryPanel key={company.id} companyId={company.id} />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [
                "Skills",
                "Des consignes et méthodes pour guider une tâche métier. Leur présence ne garantit pas les accès ou les outils nécessaires.",
              ],
              [
                "Plugins",
                "Des extensions compatibles avec Hermes, à vérifier avant installation et activation.",
              ],
              [
                "API",
                "Des connexions aux services autorisés, avec les clés conservées côté serveur et leurs éventuels coûts vérifiés.",
              ],
              [
                "MCP",
                "Des serveurs donnant accès à des outils. Chaque connexion devra être vérifiée et limitée à l’espace du client.",
              ],
            ].map(([title, description]) => (
              <Information key={title} title={title}>
                <p>{description}</p>
                <p className="text-amber-200">Inventaire et activation à raccorder</p>
              </Information>
            ))}
          </div>
        </>
      )}
      {tab === "Installation" && (
        <>
          <HermesConnectionPanel key={company.id} companyId={company.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <Information title="Serveur et installation">
              <p>
                Le VPS Hostinger existant est la cible prioritaire. Le contrôle de connexion
                ci-dessus vérifie uniquement le raccordement de ce dossier à Hermes.
              </p>
              <p>
                L’installation, les mises à jour et la gestion du VPS depuis Optivos ne sont pas
                encore disponibles.
              </p>
            </Information>
            <Information title="IA et budget">
              <p>
                Plafond : <strong>0 € de nouveaux frais API</strong>. Aucun appel payant ne doit
                être lancé par cet atelier.
              </p>
              <ul className="list-inside list-disc space-y-2">
                <li>OpenRouter : modèle gratuit et absence de repli payant à vérifier.</li>
                <li>9Router : compatibilité, accès et coût des fournisseurs à vérifier.</li>
                <li>
                  Modèle sur VPS : mémoire, vitesse et capacité à utiliser les outils à mesurer.
                </li>
              </ul>
              <p>Aucun de ces choix n’est activé depuis ce tableau de bord.</p>
            </Information>
            <Information title="Autonomie et permissions">
              <p>
                Trois modes prévus par mission : validation préalable, actions autorisées à
                l’avance, ou autonomie dans des limites définies.
              </p>
              <p>
                Les envois, publications, dépenses et changements importants demanderont une
                validation par défaut. Ces réglages doivent être appliqués par le runtime avant
                activation.
              </p>
            </Information>
            <Information title="Clients et isolation">
              <p>
                Première étape : votre usage personnel, puis quelques clients pilotes avec leur
                propre VPS et leurs comptes IA.
              </p>
              <p>
                L’offre hébergée devra isoler les agents, secrets, sessions et fichiers de chaque
                client. Elle n’est pas activée.
              </p>
            </Information>
          </div>
        </>
      )}
    </section>
  );
}
