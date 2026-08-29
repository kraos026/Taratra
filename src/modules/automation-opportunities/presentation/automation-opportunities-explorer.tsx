"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, FileSearch, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

type Opportunity = {
  id: string;
  title: string;
  description: string;
  businessProblem: string;
  patternId: string;
  triggerType: string;
  implementationEffort: string;
  businessImpact: number;
  automationCoverage: number;
  technicalFeasibility: number;
  connectorAvailability: number;
  automationReadiness: number;
  complexityScore: number;
  confidence: number;
  decisionState?: DecisionState;
  actions?: string[];
  outputs?: string[];
};
type DecisionState =
  | "AUTOMATE_NOW"
  | "AUTOMATE_AFTER_REMEDIATION"
  | "NEEDS_MORE_EVIDENCE"
  | "DEFER"
  | "DO_NOT_AUTOMATE";
type ConnectorLink = { opportunityId: string; connectorId: string; available: boolean };
type Pattern = { id: string; title: string };
type EvidenceLink = { opportunityId: string };
type Validation = { severity: string; message: string };

export function AutomationOpportunitiesExplorer({
  opportunities,
  connectors,
  evidence = [],
  patterns,
  validations = [],
}: {
  readonly opportunities: Opportunity[];
  readonly connectors: ConnectorLink[];
  readonly evidence?: EvidenceLink[];
  readonly patterns: Pattern[];
  readonly validations?: Validation[];
}) {
  const [query, setQuery] = useState("");
  const patternTitles = new Map(patterns.map((item) => [item.id, item.title]));
  const filtered = useMemo(
    () =>
      opportunities.filter((item) =>
        `${item.title} ${item.description} ${item.businessProblem}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [opportunities, query],
  );
  const topThree = filtered.slice(0, 3);
  const remaining = filtered.slice(3);
  const hasValidationWarnings = validations.some((item) => item.severity !== "information");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1d4ed833,transparent_34rem),#020617] px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/50 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
                <Sparkles size={16} />
                Optivos · Priorités d’automatisation
              </p>
              <h1 className="mt-4 font-['Manrope'] text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                Opportunités
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
                Les meilleures opportunités d’automatisation identifiées pour votre entreprise,
                classées selon les données publiées de l’audit.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <HeroMetric
                label="Top prioritaire"
                value={String(Math.min(3, opportunities.length))}
              />
              <HeroMetric label="Total" value={String(opportunities.length)} />
              <HeroMetric
                label="Confiance"
                value={averageConfidence(opportunities)}
                muted={!opportunities.length}
              />
            </div>
          </div>
        </header>

        {opportunities.length ? (
          <>
            <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-400">
                <FileSearch size={17} />
                <Input
                  aria-label="Rechercher une opportunité"
                  placeholder="Rechercher une opportunité…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="border-0 bg-transparent text-slate-100 shadow-none focus-visible:ring-0"
                />
              </label>
            </section>

            <section className="space-y-4" aria-labelledby="top-opportunities">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-200">
                    Que faut-il automatiser en premier ?
                  </p>
                  <h2 id="top-opportunities" className="text-2xl font-bold text-white">
                    Top 3 recommandé
                  </h2>
                </div>
                {hasValidationWarnings ? (
                  <p className="rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
                    Certaines preuves demandent encore une vérification.
                  </p>
                ) : null}
              </div>
              {topThree.length ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {topThree.map((item, index) => (
                    <OpportunityCard
                      key={item.id}
                      opportunity={item}
                      rank={index + 1}
                      patternTitle={patternTitles.get(item.patternId)}
                      availableConnectors={availableConnectors(connectors, item.id)}
                      evidenceCount={evidenceCount(evidence, item.id)}
                      featured
                    />
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </section>

            <section className="space-y-4" aria-labelledby="all-opportunities">
              <h2 id="all-opportunities" className="text-2xl font-bold text-white">
                Toutes les opportunités
              </h2>
              {remaining.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {remaining.map((item, index) => (
                    <OpportunityCard
                      key={item.id}
                      opportunity={item}
                      rank={index + 4}
                      patternTitle={patternTitles.get(item.patternId)}
                      availableConnectors={availableConnectors(connectors, item.id)}
                      evidenceCount={evidenceCount(evidence, item.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 text-sm text-slate-300">
                  Toutes les opportunités publiées sont déjà visibles dans le Top 3.
                </p>
              )}
            </section>
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}

function OpportunityCard({
  opportunity,
  rank,
  patternTitle,
  availableConnectors,
  evidenceCount,
  featured = false,
}: {
  readonly opportunity: Opportunity;
  readonly rank: number;
  readonly patternTitle?: string;
  readonly availableConnectors: number;
  readonly evidenceCount: number;
  readonly featured?: boolean;
}) {
  return (
    <article
      className={`rounded-[1.75rem] border bg-slate-900/80 p-5 shadow-xl shadow-slate-950/30 ${
        featured ? "border-blue-300/30" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-100">
          Priorité {rank}
        </span>
        <DecisionBadge value={decisionLabel(opportunity)} />
      </div>
      <h3 className="mt-4 text-xl font-bold text-white">{brandText(opportunity.title)}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {brandText(opportunity.businessProblem)}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-400">{brandText(opportunity.description)}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Fact label="Impact" value={scoreLabel(opportunity.businessImpact)} />
        <Fact label="Effort" value={effortLabel(opportunity.implementationEffort)} />
        <Fact label="Confiance" value={`${Math.round(opportunity.confidence)} %`} />
        <Fact label="ROI" value={roiEvidenceLabel(evidenceCount)} />
      </dl>

      <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Guidance icon={<Gauge size={16} />} title="Pourquoi c’est important">
          {impactSentence(opportunity)}
        </Guidance>
        <Guidance icon={<ShieldCheck size={16} />} title="Contrôles à garder visibles">
          {controlSentence(opportunity, availableConnectors)}
        </Guidance>
        <Guidance icon={<ArrowRight size={16} />} title="Prochaine action">
          Confirmer les preuves économiques et préparer le plan d’action associé.
        </Guidance>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {patternTitle ? <Pill>{brandText(patternTitle)}</Pill> : null}
        <Pill>{triggerLabel(opportunity.triggerType)}</Pill>
        <Pill>{availableConnectors} connecteur(s) étayé(s)</Pill>
      </div>
    </article>
  );
}

function HeroMetric({
  label,
  value,
  muted = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly muted?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-950/70 px-4 py-3">
      <p className="truncate text-[0.68rem] font-bold tracking-[0.16em] text-slate-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-extrabold ${muted ? "text-slate-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
      <dt className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function Guidance({
  icon,
  title,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex gap-3 text-sm leading-6">
      <span className="mt-1 text-blue-200">{icon}</span>
      <div>
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="text-slate-400">{children}</p>
      </div>
    </div>
  );
}

function DecisionBadge({ value }: { readonly value: string }) {
  return (
    <span className="rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1 text-right text-xs font-bold text-blue-100">
      {value}
    </span>
  );
}

function Pill({ children }: { readonly children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <section className="rounded-[2rem] border border-dashed border-blue-300/30 bg-blue-500/10 p-8 text-center">
      <AlertTriangle className="mx-auto text-blue-200" />
      <h2 className="mt-3 text-2xl font-bold text-white">
        Votre analyse n’a pas encore généré d’opportunités.
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-300">
        Finalisez les étapes d’audit pour obtenir les opportunités d’automatisation priorisées.
      </p>
      <Link
        href="/companies"
        className="mt-6 inline-flex rounded-full bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
      >
        Continuer l’audit
      </Link>
    </section>
  );
}

function availableConnectors(connectors: readonly ConnectorLink[], opportunityId: string): number {
  return connectors.filter((link) => link.opportunityId === opportunityId && link.available).length;
}

function evidenceCount(evidence: readonly EvidenceLink[], opportunityId: string): number {
  return evidence.filter((item) => item.opportunityId === opportunityId).length;
}

function averageConfidence(opportunities: readonly Opportunity[]): string {
  if (!opportunities.length) return "À confirmer";
  const average =
    opportunities.reduce((sum, item) => sum + item.confidence, 0) / opportunities.length;
  return `${Math.round(average)} %`;
}

function decisionLabel(opportunity: Opportunity): string {
  const labels: Record<DecisionState, string> = {
    AUTOMATE_NOW: "Automatiser maintenant",
    AUTOMATE_AFTER_REMEDIATION: "Automatiser après correction",
    NEEDS_MORE_EVIDENCE: "Données supplémentaires requises",
    DEFER: "Reporter",
    DO_NOT_AUTOMATE: "Ne pas automatiser",
  };
  return opportunity.decisionState ? labels[opportunity.decisionState] : labels.NEEDS_MORE_EVIDENCE;
}

function roiEvidenceLabel(evidenceItems: number): string {
  return evidenceItems > 0 ? "ROI estimé" : "Données insuffisantes";
}

function scoreLabel(value: number): string {
  if (value >= 85) return "Très élevé";
  if (value >= 70) return "Élevé";
  if (value >= 50) return "Modéré";
  return "À confirmer";
}

function effortLabel(value: string): string {
  const labels: Record<string, string> = {
    very_low: "Très faible",
    low: "Faible",
    medium: "Modéré",
    high: "Élevé",
    very_high: "Très élevé",
  };
  return labels[value] ?? value;
}

function triggerLabel(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function impactSentence(opportunity: Opportunity): string {
  const coverage = Math.round(opportunity.automationCoverage);
  return `Cette opportunité cible un point de friction prioritaire avec une couverture d’automatisation estimée à ${coverage} %.`;
}

function controlSentence(opportunity: Opportunity, connectorsCount: number): string {
  const actionText = [...(opportunity.actions ?? []), ...(opportunity.outputs ?? [])]
    .join(" ")
    .toLowerCase();
  if (/approval|approve|finance|payment|invoice|compliance|sensitive|access/.test(actionText))
    return "Validation humaine requise sur les décisions sensibles, avec contrôle Finance ou conformité selon le cas.";
  if (connectorsCount === 0)
    return "Preuve manquante sur les systèmes connectés avant automatisation.";
  return "Garder une revue humaine sur les exceptions et les accès sensibles.";
}

function brandText(value: string): string {
  return value.replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}
