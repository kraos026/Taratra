"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Calculator, CircleDollarSign, Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { customerDecisionText } from "@/modules/company-intake/presentation/customer-decision-copy";
import type { RoiTrace } from "./roi-trace";

type Evaluation = {
  id: string;
  scenarioId: string;
  title: string;
  description: string;
  confidence: number;
};
type Scenario = { id: string; type: string };
type Metric = {
  evaluationId: string;
  code: string;
  value: number | null;
  specialValue: string | null;
  unit: string;
};

export function RoiExplorer({
  currency,
  scenarios,
  evaluations,
  metrics,
  traces = [],
}: {
  readonly currency: string;
  readonly scenarios: Scenario[];
  readonly evaluations: Evaluation[];
  readonly metrics: Metric[];
  readonly traces?: readonly RoiTrace[];
}) {
  const [scenario, setScenario] = useState("expected");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const scenarioIds = new Set(
      scenarios
        .filter((item) => scenario === "all" || item.type === scenario)
        .map((item) => item.id),
    );
    return evaluations.filter(
      (item) =>
        scenarioIds.has(item.scenarioId) &&
        `${brandText(item.title)} ${brandText(item.description)}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  }, [evaluations, scenarios, scenario, query]);
  const value = (id: string, code: string) =>
    metrics.find((item) => item.evaluationId === id && item.code === code);
  const expectedEvaluations = evaluations.filter((item) =>
    scenarios.some(
      (scenarioItem) => scenarioItem.id === item.scenarioId && scenarioItem.type === "expected",
    ),
  );
  const averageConfidence = expectedEvaluations.length
    ? Math.round(
        expectedEvaluations.reduce((sum, item) => sum + item.confidence, 0) /
          expectedEvaluations.length,
      )
    : null;
  const primaryEvaluation = expectedEvaluations[0] ?? evaluations[0];
  const summaryMetrics = primaryEvaluation
    ? {
        savings: value(primaryEvaluation.id, "annual_cost_saved"),
        time: value(primaryEvaluation.id, "annual_hours_saved"),
        cost: value(primaryEvaluation.id, "implementation_cost"),
        roi: value(primaryEvaluation.id, "roi_percentage"),
        payback: value(primaryEvaluation.id, "payback_period"),
      }
    : null;
  const knownMetrics = metrics.filter((metric) => metric.value !== null && !metric.specialValue);
  const missingMetrics = metrics.filter(
    (metric) => metric.value === null || metric.specialValue === "INSUFFICIENT_EVIDENCE",
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 sm:p-8">
          <p className="text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
            ROI Optivos · {currency}
          </p>
          <h1 className="mt-3 font-['Manrope'] text-3xl font-extrabold sm:text-5xl">
            Évaluation économique
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Les scénarios distinguent calcul, estimation et données insuffisantes. Aucun gain n’est
            présenté comme garanti.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <HeroMetric icon={<Calculator />} label="Scénarios" value={String(scenarios.length)} />
            <HeroMetric
              icon={<TrendingUp />}
              label="Évaluations"
              value={String(evaluations.length)}
            />
            <HeroMetric
              icon={<CircleDollarSign />}
              label="Indice interne moyen"
              value={averageConfidence === null ? "À confirmer" : `${averageConfidence}%`}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            L’indice interne reflète les sources et hypothèses du modèle. Même à 100 %, il ne
            garantit ni les gains annoncés ni la réussite d’une automatisation.
          </p>
        </header>

        {primaryEvaluation && (
          <p className="text-sm text-slate-300">
            Repère économique du scénario probable pour : {brandText(primaryEvaluation.title)}. Ce
            n’est pas le total de l’audit. Les évaluations des différentes opportunités ne doivent
            pas être additionnées sans vérifier les hypothèses communes et les doubles comptes.
          </p>
        )}
        <section
          aria-labelledby="roi-executive-summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <SummaryMetric
            label="Économie annuelle de temps valorisée"
            metric={summaryMetrics?.savings}
            currency={currency}
          />
          <SummaryMetric label="Temps économisable" metric={summaryMetrics?.time} />
          <SummaryMetric
            label="Coût d’implémentation"
            metric={summaryMetrics?.cost}
            currency={currency}
          />
          <SummaryMetric label="ROI" metric={summaryMetrics?.roi} percent />
          <SummaryMetric label="Délai de retour" metric={summaryMetrics?.payback} />
          <h2 id="roi-executive-summary" className="sr-only">
            Synthèse ROI exécutive
          </h2>
        </section>

        <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-4 md:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-400">
            <Search size={17} />
            <Input
              aria-label="Rechercher une évaluation ROI"
              placeholder="Rechercher une évaluation…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-0 bg-transparent text-slate-100 shadow-none focus-visible:ring-0"
            />
          </label>
          <select
            aria-label="Filtrer par scénario"
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
          >
            <option value="all">Tous les scénarios</option>
            {["conservative", "expected", "optimistic"].map((item) => (
              <option key={item} value={item}>
                {scenarioLabel(item)}
              </option>
            ))}
          </select>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <EvidenceBlock
            title="Métriques calculées disponibles"
            items={knownMetrics.map((metric) => metricLabel(metric.code))}
            empty="Aucune métrique économique calculée n’est encore disponible."
          />
          <EvidenceBlock
            title="Évaluations et confiance du modèle"
            items={evaluations.map(
              (item) => `${brandText(item.title)} · confiance ${item.confidence}%`,
            )}
            empty="Aucune évaluation économique disponible."
          />
          <EvidenceBlock
            title="Données manquantes"
            items={missingMetrics.map((metric) => metricLabel(metric.code))}
            empty="Aucune donnée manquante publiée."
          />
        </section>

        {missingMetrics.length > 0 && (
          <section className="rounded-[1.5rem] border border-amber-400/25 bg-amber-500/10 p-5">
            <p className="text-sm font-semibold text-amber-100">Données complémentaires requises</p>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              Complétez les hypothèses avant de traiter ces valeurs comme des décisions économiques.
            </p>
            <p className="mt-4 inline-flex rounded-2xl border border-amber-200/30 px-4 py-2 text-sm font-bold text-amber-50">
              Compléter les hypothèses
            </p>
          </section>
        )}

        <section className="space-y-4" aria-live="polite">
          {!filtered.length ? (
            <SafeState />
          ) : (
            filtered.map((item) => {
              const roi = value(item.id, "roi_percentage");
              const payback = value(item.id, "payback_period");
              const savings = value(item.id, "annual_cost_saved");
              const benefit = value(item.id, "annual_benefit");
              const errorPart =
                savings &&
                benefit &&
                !savings.specialValue &&
                !benefit.specialValue &&
                savings.value !== null &&
                benefit.value !== null &&
                Number.isFinite(savings.value) &&
                Number.isFinite(benefit.value) &&
                benefit.value >= savings.value
                  ? {
                      value: benefit.value - savings.value,
                      specialValue: null,
                      unit: "currency/year",
                    }
                  : undefined;
              const cost = value(item.id, "implementation_cost");
              const scenarioType =
                scenarios.find((scenarioItem) => scenarioItem.id === item.scenarioId)?.type ??
                "scenario";
              const trace = traces.find((row) => row.evaluationId === item.id);
              return (
                <article
                  key={item.id}
                  className="rounded-[1.75rem] border border-white/10 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/20"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200">
                        {scenarioLabel(scenarioType)}
                      </span>
                      <h2 className="mt-3 text-xl font-bold text-white">{brandText(item.title)}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {brandText(item.description)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <p className="text-xs text-slate-400">État ROI</p>
                      <p className="mt-1 font-bold text-blue-100">{roiState(roi)}</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                    <p className="font-bold">Estimation sous hypothèses — pas un gain constaté</p>
                    <p>
                      {trace && trace.assumptions.length > 0 && trace.sharedEvaluationCount > 1
                        ? `Les hypothèses de ce scénario sont partagées par ${trace.sharedEvaluationCount} évaluations. Des chiffres identiques ne prouvent pas des gains indépendants : ne les additionnez pas.`
                        : "Vérifiez les hypothèses et les recouvrements avant de comparer ou d’additionner les gains. La pertinence pour cette activité reste à confirmer."}
                    </p>
                  </div>
                  <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Metric
                      label="Économie annuelle de temps valorisée"
                      metric={savings}
                      currency={currency}
                    />
                    <Metric
                      label="Heures économisables par an"
                      metric={value(item.id, "annual_hours_saved")}
                    />
                    <Metric
                      label="Bénéfice annuel total"
                      metric={value(item.id, "annual_benefit")}
                      currency={currency}
                    />
                    <Metric label="Coût d’implémentation" metric={cost} currency={currency} />
                    <Metric
                      label="Coût de formation"
                      metric={value(item.id, "training_cost")}
                      currency={currency}
                    />
                    <Metric
                      label="Coût d’infrastructure"
                      metric={value(item.id, "infrastructure_cost")}
                      currency={currency}
                    />
                    <Metric
                      label="Maintenance annuelle"
                      metric={value(item.id, "maintenance_cost")}
                      currency={currency}
                    />
                    <Metric
                      label="Bénéfice annuel net"
                      metric={value(item.id, "annual_net_benefit")}
                      currency={currency}
                    />
                    <Metric label="Retour" metric={payback} />
                    <Metric label="ROI" metric={roi} percent />
                    <Metric
                      label="Indice interne (pas une garantie)"
                      metric={{ value: item.confidence, specialValue: null, unit: "percent" }}
                      percent
                    />
                  </dl>
                  <div className="mt-4 rounded-2xl border border-amber-400/20 p-4">
                    <p className="text-sm text-amber-100">
                      Part attribuée aux erreurs évitées (hypothèse à vérifier)
                    </p>
                    <p className="mt-1 font-bold text-white">{formatMetric(errorPart, currency)}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Différence entre le bénéfice annuel total et le temps valorisé enregistrés. Ce
                      n’est pas une mesure des erreurs réellement évitées.
                    </p>
                  </div>
                  <AssumptionTrace trace={trace} currency={currency} />
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    Le bénéfice annuel total inclut le temps valorisé et le coût des erreurs évitées
                    selon les hypothèses du modèle enregistré. Ce montant doit être vérifié ; il ne
                    prouve pas qu’une erreur est évitée à chaque occurrence. Le ROI de première
                    année déduit la maintenance et l’investissement initial (implémentation,
                    formation et infrastructure). Le délai de retour utilise le bénéfice net
                    mensuel. Ces estimations ne constituent pas une autorisation d’automatiser.
                  </p>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-blue-200">
        {icon}
        <p className="text-xs font-bold tracking-[0.16em] uppercase">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Metric({
  label,
  metric,
  currency,
  percent = false,
}: {
  readonly label: string;
  readonly metric:
    Metric | { value: number | null; specialValue: string | null; unit: string } | undefined;
  readonly currency?: string;
  readonly percent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <dt className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">{label}</dt>
      <dd className="mt-2 font-semibold text-slate-100">
        {formatMetric(metric, currency, percent)}
      </dd>
    </div>
  );
}

function SummaryMetric({
  label,
  metric,
  currency,
  percent = false,
}: {
  readonly label: string;
  readonly metric: Metric | undefined;
  readonly currency?: string;
  readonly percent?: boolean;
}) {
  const safe =
    !metric ||
    metric.value === null ||
    !Number.isFinite(metric.value) ||
    metric.specialValue === "INSUFFICIENT_EVIDENCE";
  return (
    <article
      className={`rounded-[1.5rem] border p-5 ${
        safe ? "border-amber-400/25 bg-amber-500/10" : "border-blue-400/20 bg-blue-500/10"
      }`}
    >
      <p className="text-xs font-bold tracking-[0.18em] text-slate-400 uppercase">{label}</p>
      <p className="mt-3 text-xl font-extrabold [overflow-wrap:anywhere] text-white">
        {formatMetric(metric, currency, percent)}
      </p>
    </article>
  );
}

function formatMetric(
  metric: Metric | { value: number | null; specialValue: string | null; unit: string } | undefined,
  currency?: string,
  percent = false,
): string {
  if (!metric) return "Données complémentaires requises";
  if (metric.specialValue) return readableSpecial(metric.specialValue);
  if (metric.value === null || !Number.isFinite(metric.value))
    return "Données complémentaires requises";
  if (percent || metric.unit === "percent")
    return `${metric.value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  if (metric.unit.includes("currency"))
    return `${metric.value.toLocaleString("fr-FR")} ${currency ?? ""}`.trim();
  if (metric.unit === "hours/year") return `${metric.value.toLocaleString("fr-FR")} h/an`;
  if (metric.unit === "hours/month") return `${metric.value.toLocaleString("fr-FR")} h/mois`;
  if (metric.unit === "months")
    return `${metric.value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mois`;
  return `${metric.value.toLocaleString("fr-FR")} ${metric.unit}`;
}

function roiState(metric: Metric | undefined): string {
  if (!metric || metric.value === null) return "Données insuffisantes";
  if (metric.specialValue) return readableSpecial(metric.specialValue);
  return "Estimation disponible";
}

function readableSpecial(value: string): string {
  const labels: Record<string, string> = {
    INSUFFICIENT_EVIDENCE: "Données insuffisantes",
    STRATEGIC_NON_QUANTIFIED: "Stratégique non quantifié",
    CALCULATED: "Calculé",
    ESTIMATED: "Estimé",
    unbounded: "Non borné (investissement initial nul)",
    not_recovered: "Investissement non récupéré selon ces hypothèses",
  };
  return labels[value] ?? "État à examiner";
}

function scenarioLabel(value: string): string {
  const labels: Record<string, string> = {
    conservative: "Conservateur",
    expected: "Probable",
    optimistic: "Optimiste",
  };
  return labels[value] ?? "Scénario à examiner";
}

function EvidenceBlock({
  title,
  items,
  empty,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly empty: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {[...new Set(items)].slice(0, 6).map((item) => (
            <li key={item} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-400">
          {empty}
        </p>
      )}
    </section>
  );
}

function metricLabel(code: string): string {
  const labels: Record<string, string> = {
    annual_cost_saved: "Gain annuel",
    annual_time_saved: "Temps économisable",
    implementation_cost: "Coût d’implémentation",
    roi_percentage: "ROI",
    payback_period: "Délai de retour",
    annual_hours_saved: "Heures économisables par an",
    monthly_hours_saved: "Heures économisables par mois",
    monthly_cost_saved: "Gain mensuel",
    maintenance_cost: "Coût de maintenance",
    training_cost: "Coût de formation",
    infrastructure_cost: "Coût d’infrastructure",
    annual_benefit: "Bénéfice annuel sous hypothèses",
    annual_net_benefit: "Bénéfice annuel net sous hypothèses",
    confidence: "Indice interne du modèle",
  };
  return labels[code] ?? "Métrique supplémentaire à examiner";
}

function brandText(value: string): string {
  return customerDecisionText(value);
}

const assumptionLabels: Record<string, string> = {
  hourly_cost: "Coût d’une heure de travail",
  working_days: "Jours de travail par an",
  working_hours: "Heures de travail par jour",
  monthly_frequency: "Occurrences par mois",
  annual_frequency: "Occurrences par an",
  hours_saved_per_occurrence: "Heures supposées économisées par occurrence",
  implementation_cost: "Investissement d’implémentation",
  maintenance_cost: "Maintenance annuelle",
  training_cost: "Formation",
  infrastructure_cost: "Infrastructure",
  error_cost: "Coût d’erreur supposé évitable par occurrence",
};

function AssumptionTrace({
  trace,
  currency,
}: {
  readonly trace: RoiTrace | undefined;
  readonly currency: string;
}) {
  return (
    <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <summary className="cursor-pointer font-bold text-blue-200">
        Comprendre les chiffres et leurs sources
      </summary>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {trace
          ? `${trace.sourceReferenceCount} référence(s) source distincte(s) reliée(s) à cette évaluation.`
          : "Traçabilité détaillée non disponible dans cette vue."}{" "}
        Une référence liée ne constitue pas à elle seule une preuve du gain financier.
      </p>
      {trace && trace.assumptions.length > 0 ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {trace.assumptions.map((row) => (
            <div key={row.code} className="rounded-xl border border-white/10 p-3">
              <dt className="text-sm text-slate-300">
                {assumptionLabels[row.code] ?? "Hypothèse supplémentaire"}
              </dt>
              <dd className="mt-1 font-semibold text-white">
                {assumptionValue(row.code, row.value, currency)}
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  {row.source === "provided"
                    ? "Renseignée dans l’évaluation — à vérifier"
                    : row.source === "catalog_default"
                      ? "Valeur du catalogue — à vérifier pour cette activité"
                      : "Origine non confirmée"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-amber-200">
          Hypothèses détaillées non disponibles. Ne traitez pas ces montants comme des gains
          démontrés.
        </p>
      )}
      <p className="mt-4 text-sm leading-6 text-slate-300">
        Temps valorisé : heures économisables × coût horaire. Le bénéfice total ajoute une part
        supposée liée aux erreurs évitées. Vérifiez la fréquence réelle des erreurs et leur coût :
        une erreur évitée à chaque occurrence n’est pas démontrée par ce calcul. Les hypothèses
        renseignées ne sont pas automatiquement des observations vérifiées.
      </p>
    </details>
  );
}

function assumptionValue(code: string, value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "Non disponible";
  const number = value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
  if (
    [
      "hourly_cost",
      "implementation_cost",
      "maintenance_cost",
      "training_cost",
      "infrastructure_cost",
      "error_cost",
    ].includes(code)
  )
    return `${number} ${currency}`;
  if (["working_hours", "hours_saved_per_occurrence"].includes(code)) return `${number} h`;
  return number;
}

function SafeState() {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-amber-400/30 bg-amber-500/10 p-8 text-center">
      <AlertTriangle className="mx-auto text-amber-200" />
      <h2 className="mt-3 text-xl font-bold text-white">ROI non disponible pour ce filtre</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-100/80">
        Aucune valeur n’est inventée. Changez de scénario ou revenez au parcours d’audit pour
        compléter les preuves économiques.
      </p>
    </div>
  );
}
