"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, ClipboardList, FileText, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveAgentMission, prepareAgentMission, type AgentMission } from "../domain/simulation";

const tabs = ["Accueil", "Missions", "Résultats", "À valider", "Réglages"] as const;
type Tab = (typeof tabs)[number];
const labels = {
  ready: "Préparée",
  approval: "À valider",
  running: "En cours",
  completed: "Terminée",
  stopped: "Arrêtée",
};
type Company = { id: string; name: string; canSimulate: boolean };

export function AgentWorkspacePanel({ company }: { company: Company }) {
  const [tab, setTab] = useState<Tab>("Accueil");
  const [missions, setMissions] = useState<AgentMission[]>([]);
  const [title, setTitle] = useState("Préparer une fiche de présentation");
  const [brief, setBrief] = useState(
    "Obtenir une fiche claire présentant mon activité, mes services et les prochaines étapes.",
  );
  const [error, setError] = useState("");
  const visible = missions.filter((m) => m.companyId === company.id);
  const runningId = visible.find((m) => m.state === "running")?.id;
  useEffect(() => {
    if (!runningId) return;
    const timer = setTimeout(
      () =>
        setMissions((rows) =>
          rows.map((m) => (m.id === runningId ? moveAgentMission(m, company.id, "finish") : m)),
        ),
      3500,
    );
    return () => clearTimeout(timer);
  }, [runningId, company.id]);
  const pending = visible.filter((m) => m.state === "approval");
  const finished = visible.filter((m) => m.state === "completed");
  function act(id: string, action: "approve" | "stop") {
    if (!company.canSimulate) return;
    if (action === "approve" && runningId) {
      setError("Une simulation est déjà en cours. Attendez son résultat ou arrêtez-la.");
      return;
    }
    setError("");
    setMissions((rows) =>
      rows.map((m) => (m.id === id ? moveAgentMission(m, company.id, action) : m)),
    );
    if (action === "approve") setTab("Missions");
  }
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
            <Bot size={17} /> Atelier IA · Hermes Facile
          </p>
          <h1 className="mt-2 text-3xl font-bold">Vos missions, en toute clarté</h1>
          <p className="mt-3 text-slate-300">
            Dossier : <strong>{company.name}</strong>
          </p>
        </div>
        <Link
          href={`/companies/${encodeURIComponent(company.id)}`}
          className="text-sm text-indigo-300 underline underline-offset-4"
        >
          Retour à mon entreprise
        </Link>
      </header>
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-amber-100">
        <strong>Démonstration · 0 € d’appels IA</strong>
        <p className="mt-2 text-sm leading-6">
          Les missions ci-dessous sont simulées. Aucun agent, modèle, outil ou envoi externe n’est
          lancé. Elles disparaissent lorsque vous actualisez ou quittez cet espace.
        </p>
      </div>
      {!company.canSimulate && (
        <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">
          Votre rôle permet de consulter cet espace. La préparation et la validation des simulations
          sont réservées aux rôles autorisés du dossier.
        </p>
      )}
      <nav aria-label="Navigation de l’atelier" className="flex flex-wrap gap-2">
        {tabs.map((label) => (
          <button
            key={label}
            onClick={() => setTab(label)}
            aria-current={tab === label ? "page" : undefined}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-400 ${tab === label ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-100" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
          >
            {label}
            {label === "À valider" && pending.length > 0 ? ` (${pending.length})` : ""}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded-xl border border-rose-300/30 p-4 text-rose-200">
          {error}
        </p>
      )}
      {tab === "Accueil" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [ClipboardList, visible.length, "Missions préparées"],
              [CheckCircle2, pending.length, "À valider"],
              [FileText, finished.length, "Exemples de résultats"],
            ].map(([Icon, count, label]) => {
              const Symbol = Icon as typeof ClipboardList;
              return (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <Symbol size={20} className="text-indigo-300" />
                  <strong className="mt-3 block text-3xl">{String(count)}</strong>
                  <p className="mt-1 text-sm text-slate-400">{String(label)}</p>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Préparer une première mission</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Décrivez le résultat souhaité. Relisez ensuite la demande avant de lancer sa
              simulation.
            </p>
            <form
              className="mt-5 grid max-w-3xl gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!company.canSimulate) return;
                if (visible.length >= 12) {
                  setError(
                    "La démonstration est limitée à douze missions. Actualisez la page pour recommencer.",
                  );
                  return;
                }
                try {
                  const mission = prepareAgentMission(
                    crypto.randomUUID(),
                    company.id,
                    title,
                    brief,
                  );
                  setMissions((rows) => [...rows, mission]);
                  setError("");
                  setTab("À valider");
                } catch {
                  setError("Indiquez un titre et un résultat attendu suffisamment précis.");
                }
              }}
            >
              <label htmlFor="agent-title" className="text-sm font-semibold">
                Nom de la mission
              </label>
              <input
                id="agent-title"
                disabled={!company.canSimulate}
                minLength={3}
                maxLength={120}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 p-3 focus-visible:ring-2 focus-visible:ring-indigo-400"
              />
              <label htmlFor="agent-brief" className="text-sm font-semibold">
                Quel résultat souhaitez-vous ?
              </label>
              <textarea
                id="agent-brief"
                disabled={!company.canSimulate}
                minLength={10}
                maxLength={4000}
                required
                rows={4}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 p-3 focus-visible:ring-2 focus-visible:ring-indigo-400"
              />
              <Button type="submit" disabled={!company.canSimulate} className="mt-2 w-fit">
                Préparer la simulation
              </Button>
            </form>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Décider avec Optivos</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Retrouvez votre audit, ses preuves et les recommandations publiées dans votre
                dossier.
              </p>
              <Link
                href={`/companies/${encodeURIComponent(company.id)}/automation-audit`}
                className="mt-3 inline-block text-sm text-indigo-300 underline"
              >
                Ouvrir mon audit
              </Link>
            </article>
            <article className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Studio créatif</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Une extension envisagée pour les visuels, présentations et documents. Elle n’est pas
                intégrée dans cette démonstration.
              </p>
            </article>
          </div>
        </>
      )}
      {(tab === "Missions" || tab === "À valider" || tab === "Résultats") && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{tab}</h2>
          {(tab === "À valider" ? pending : tab === "Résultats" ? finished : visible).length ===
            0 && (
            <p className="rounded-2xl border border-white/10 p-6 text-slate-300">
              Aucune mission dans cette rubrique. Préparez une simulation depuis l’accueil.
            </p>
          )}
          {(tab === "À valider" ? pending : tab === "Résultats" ? finished : visible).map((m) => (
            <article
              key={m.id}
              className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{m.title}</h3>
                <span className="rounded-full bg-indigo-400/10 px-3 py-1 text-xs text-indigo-200">
                  {labels[m.state]} · simulation
                </span>
              </div>
              <p className="text-sm leading-6 whitespace-pre-wrap text-slate-300">{m.brief}</p>
              {m.state === "approval" && (
                <div>
                  <p className="mb-3 text-sm text-slate-300">
                    Coût IA : 0 €. Permissions : aucune action externe. Le résultat sera un exemple.
                  </p>
                  <Button disabled={!company.canSimulate} onClick={() => act(m.id, "approve")}>
                    Valider et simuler
                  </Button>
                </div>
              )}
              {(m.state === "approval" || m.state === "running") && (
                <Button
                  disabled={!company.canSimulate}
                  variant="outline"
                  onClick={() => act(m.id, "stop")}
                >
                  Arrêter la simulation
                </Button>
              )}
              {m.state === "running" && (
                <p role="status" className="text-sm text-indigo-200">
                  Simulation en cours…
                </p>
              )}
              {m.result && (
                <pre className="rounded-xl bg-slate-950 p-4 font-sans text-sm leading-6 break-words whitespace-pre-wrap">
                  {m.result}
                </pre>
              )}
              <details className="text-sm text-slate-400">
                <summary className="cursor-pointer">Voir le suivi</summary>
                <ol className="mt-3 list-inside list-decimal space-y-2">
                  {m.events.map((event, index) => (
                    <li key={index}>{event}</li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </div>
      )}
      {tab === "Réglages" && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Settings2 size={20} /> Votre atelier
          </h2>
          <dl className="mt-5 space-y-5">
            {[
              ["Compte et dossier", "Accès contrôlé par votre compte et votre entreprise Optivos."],
              ["Hermes", "Exécution réelle désactivée. Le parcours utilise une simulation locale."],
              ["OpenRouter et modèles IA", "Aucun modèle configuré ni appelé par cet atelier."],
              ["Budget", "0 € d’appels IA ; aucune activation payante disponible."],
              [
                "Conservation des missions",
                "Mémoire de cette page uniquement. Actualiser ou quitter efface la démonstration.",
              ],
              [
                "Compétences et intégrations",
                "9Router, compétences métier et applications créatives restent à vérifier et à intégrer.",
              ],
            ].map(([name, value]) => (
              <div key={name}>
                <dt className="font-semibold">{name}</dt>
                <dd className="mt-1 text-sm leading-6 text-slate-300">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
