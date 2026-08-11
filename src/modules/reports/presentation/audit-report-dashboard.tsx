"use client";
import { useEffect, useState } from "react";
import type { AuditReport } from "../domain/audit-report";
import { ExecutiveSummary } from "./executive-summary";
import { ReportCharts } from "./report-charts";
import { RecommendationsTable } from "./recommendations-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readApiResponse } from "@/shared/presentation/api-client";
export function AuditReportDashboard({
  auditId,
  initialReport = null,
}: {
  auditId: string;
  initialReport?: AuditReport | null;
}) {
  const [report, setReport] = useState<AuditReport | null>(initialReport);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialReport) return;
    const controller = new AbortController();
    fetch(`/api/audits/${auditId}/report`, { signal: controller.signal })
      .then(async (r) => {
        setReport(await readApiResponse<AuditReport>(r, "Impossible de charger le rapport"));
      })
      .catch((e) => {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [auditId, initialReport]);
  if (error)
    return (
      <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800">
        {error}
      </div>
    );
  if (!report) return <ReportSkeleton />;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-neutral-500">
          {report.organization.name} · {report.company.name}
        </p>
        <h1 className="text-3xl font-bold">Rapport exécutif</h1>
      </header>
      <section
        aria-label="Synthèse des indicateurs"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Kpi label="Score global" value={`${report.scores.global.percentage.toFixed(0)}/100`} />
        <Kpi label="Maturité" value={report.audit.maturity ?? "Non renseignée"} />
        <Kpi label="Recommandations" value={String(report.recommendations.length)} />
        <Kpi label="Quick Wins" value={String(report.roi.quickWins)} />
        <Kpi
          label="ROI annuel"
          value={`${report.roi.annualSavings.toLocaleString("fr-FR")} ${report.roi.currency ?? ""}`}
        />
        <Kpi label="Temps économisé/an" value={`${report.roi.hoursYear.toFixed(1)} h`} />
        <Kpi label="Date d’audit" value={new Date(report.audit.date).toLocaleDateString("fr-FR")} />
      </section>
      <ExecutiveSummary summary={report.summary} />
      <ScoreSections report={report} />
      <ReportCharts charts={report.charts} />
      <RecommendationsTable items={report.recommendations} currency={report.roi.currency} />
    </div>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-neutral-500">{label}</p>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
function ScoreSections({ report }: { report: AuditReport }) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs ROI">
        <Kpi
          label="Heures/mois"
          value={
            report.roi.hoursMonth === null
              ? "Non disponible"
              : `${report.roi.hoursMonth.toFixed(1)} h`
          }
        />
        <Kpi label="Heures/an" value={`${report.roi.hoursYear.toFixed(1)} h`} />
        <Kpi
          label="Coût d’implémentation"
          value={`${report.roi.implementationCost.toLocaleString("fr-FR")} ${report.roi.currency ?? ""}`}
        />
        <Kpi
          label="Payback le plus court"
          value={
            report.roi.paybackMonths === null ? "—" : `${report.roi.paybackMonths.toFixed(1)} mois`
          }
        />
        <Kpi label="Quick Wins" value={String(report.roi.quickWins)} />
        <Kpi label="Strategic" value={String(report.roi.strategic)} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Scores par domaine</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.scores.categories.map((s) => (
            <article
              key={s.categoryId}
              className={`rounded-lg border-l-4 p-4 report-score-${s.tone}`}
            >
              <h3 className="font-semibold">{s.category}</h3>
              <p className="text-2xl font-bold">{s.percentage.toFixed(0)}/100</p>
              <p className="text-sm text-neutral-500">
                {s.ruleCount} règles · {s.recommendationCount} recommandations
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
function ReportSkeleton() {
  return (
    <div aria-label="Chargement du rapport" role="status" className="space-y-6">
      <span className="sr-only">Chargement</span>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      ))}
    </div>
  );
}
