"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Item = {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  roadmapPhase: string;
  priorityScore: number;
  expectedRoi: number | null;
  roiSpecialValue: string | null;
  confidence: number;
  implementationCost: number;
};

export function ExecutiveRoadmap({ recommendations }: { readonly recommendations: Item[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      recommendations.filter((item) =>
        `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [recommendations, query],
  );
  const topThree = filtered.slice(0, 3);
  const grouped = groupByPhase(filtered);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/60 p-6 sm:p-8">
          <p className="text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
            Plan d’action Optivos
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-['Manrope'] text-3xl font-extrabold sm:text-5xl">
                Feuille de route exécutive
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Les recommandations sont affichées par priorité et par phase, uniquement à partir du
                plan validé.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-5 py-4">
              <p className="text-xs text-slate-400">Recommandations disponibles</p>
              <p className="mt-1 text-3xl font-bold text-white">{recommendations.length}</p>
            </div>
          </div>
        </header>

        <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-400">
            <Search size={17} />
            <Input
              aria-label="Rechercher dans le plan d’action"
              placeholder="Rechercher une recommandation…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-0 bg-transparent text-slate-100 shadow-none focus-visible:ring-0"
            />
          </label>
        </section>

        <section aria-labelledby="top-actions" className="space-y-4">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-slate-500 uppercase">Priorité</p>
            <h2 id="top-actions" className="text-2xl font-bold">
              Top 3 à traiter en premier
            </h2>
          </div>
          {topThree.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {topThree.map((item, index) => (
                <RecommendationCard key={item.id} item={item} rank={index + 1} compact />
              ))}
            </div>
          ) : (
            <EmptyState text="Aucune recommandation disponible ne correspond à cette recherche." />
          )}
        </section>

        <section aria-labelledby="roadmap" className="space-y-4">
          <h2 id="roadmap" className="text-2xl font-bold">
            Feuille de route par priorité
          </h2>
          <div className="space-y-5">
            {Object.entries(grouped).map(([phase, items]) => (
              <div
                key={phase}
                className="rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-blue-500/15 text-blue-200">
                      <CalendarDays size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
                        Séquence
                      </p>
                      <h3 className="text-lg font-bold">{readablePhase(phase)}</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {items.length} action{items.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-3">
                  {items.map((item) => (
                    <RecommendationCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function RecommendationCard({
  item,
  rank,
  compact = false,
}: {
  readonly item: Item;
  readonly rank?: number;
  readonly compact?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-blue-300 uppercase">
            {rank ? `#${rank}` : readablePhase(item.roadmapPhase)}
          </p>
          <h3 className="mt-2 text-lg font-bold text-white">{brandText(item.title)}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClass(item.priority)}`}
        >
          {readablePriority(item.priority)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{brandText(item.description)}</p>
      <dl className={`mt-4 grid gap-3 text-sm ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        <Metric icon={<BadgeCheck size={16} />} label="Confiance" value={`${item.confidence}%`} />
        <Metric label="Impact" value={String(Math.round(item.priorityScore))} />
        <Metric
          icon={<CircleDollarSign size={16} />}
          label="État économique"
          value={
            item.roiSpecialValue
              ? readableEconomicState(item.roiSpecialValue)
              : item.expectedRoi === null
                ? "Données complémentaires requises"
                : `${item.expectedRoi.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`
          }
        />
        <Metric label="Investissement" value={formatMoney(item.implementationCost)} />
      </dl>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoPanel label="Pourquoi" value={brandText(item.description)} />
        <InfoPanel
          label="Conditions / prérequis"
          value={
            needsHumanApproval(item)
              ? "Validation humaine requise avant mise en œuvre autonome."
              : "Aucun prérequis additionnel publié dans le plan."
          }
        />
      </div>
      {needsHumanApproval(item) && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
          <ShieldCheck size={16} /> Validation humaine requise
        </p>
      )}
      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200">
        Prochaine action <ArrowRight size={15} />
      </p>
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function groupByPhase(items: readonly Item[]) {
  return items.reduce<Record<string, Item[]>>((acc, item) => {
    const key = item.roadmapPhase || "phase_unknown";
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});
}

function readablePhase(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("immediate") || normalized === "now" || normalized === "phase_1")
    return "Priorité immédiate";
  if (normalized.includes("short") || normalized === "phase_2") return "Court terme";
  if (normalized.includes("next") || normalized === "phase_3") return "Étape suivante";
  if (normalized.includes("condition")) return "Conditions / prérequis";
  return value.replace(/^phase_/, "Phase ").replaceAll("_", " ");
}

function readablePriority(value: string): string {
  return (
    (
      { critical: "Critique", high: "Haute", medium: "Modérée", low: "Faible" } as Record<
        string,
        string
      >
    )[value] ?? value
  );
}

function priorityClass(value: string): string {
  if (value === "critical") return "bg-red-500/15 text-red-200";
  if (value === "high") return "bg-amber-500/15 text-amber-100";
  return "bg-blue-500/15 text-blue-100";
}

function formatMoney(value: number): string {
  return value ? `${value.toLocaleString("fr-FR")} €` : "À préciser";
}

function readableEconomicState(value: string): string {
  const labels: Record<string, string> = {
    INSUFFICIENT_EVIDENCE: "Données complémentaires requises",
    STRATEGIC_NON_QUANTIFIED: "Stratégique non quantifié",
    CALCULATED: "Calculé",
    ESTIMATED: "Estimé",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function needsHumanApproval(item: Item): boolean {
  return /approval|human|finance|legal|control|validation|contrôle|juridique|rh/i.test(
    `${item.title} ${item.description} ${item.category}`,
  );
}

function InfoPanel({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-sm leading-5 text-slate-300">{value}</p>
    </div>
  );
}

function brandText(value: string): string {
  return value.replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <p className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-6 text-sm text-slate-400">
      {text}
    </p>
  );
}
