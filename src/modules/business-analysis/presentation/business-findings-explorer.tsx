"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileCheck2, Search } from "lucide-react";
import {
  auditLabel,
  auditText,
  analysisValidationCopy,
} from "@/modules/assisted-audit/presentation/audit-readable-copy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnalysisRebuildControl } from "./analysis-rebuild-control";

type Finding = {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  confidencePercentage: number | string;
  businessImpact: string;
  evidenceCount?: number;
};
type Metric = { id: string; label?: string; dimension?: string; score: number | string };

export function BusinessFindingsExplorer({
  findings,
  scores,
  health,
  companyId,
  validations = [],
  rebuild,
}: {
  findings: Finding[];
  scores: Metric[];
  health: Metric[];
  companyId?: string;
  validations?: { id: string; code: string; severity: string }[];
  rebuild?: { id: string; lockVersion: number };
}) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const filtered = useMemo(
    () =>
      findings.filter(
        (finding) =>
          (severity === "all" || finding.severity === severity) &&
          `${auditText(finding.title)} ${auditText(finding.description)} ${auditLabel(finding.category)}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [findings, query, severity],
  );
  return (
    <main className="opt-container space-y-6 py-6">
      <header className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        {companyId && (
          <Link className="text-sm text-blue-300" href={`/companies/${companyId}/automation-audit`}>
            ← Retour à l’audit
          </Link>
        )}
        <p className="mt-4 text-xs font-semibold tracking-widest text-blue-300 uppercase">
          Comprendre avant de décider
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Les constats de votre analyse</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Examinez les points d’attention et les références source. Les scores sont des indicateurs
          internes du moteur, pas des gains financiers, une probabilité de réussite ou une
          autorisation d’automatiser.
        </p>
      </header>
      {rebuild && <AnalysisRebuildControl {...rebuild} />}
      <section aria-label="Contrôles de validation" className="space-y-3">
        <h2 className="text-xl font-semibold">Ce qu’il faut vérifier avant de continuer</h2>
        {validations.length === 0 && (
          <p className="text-slate-300">
            Contrôles de validation non disponibles. N’en déduisez pas que l’analyse est validée.
          </p>
        )}
        {validations.map((validation) => (
          <div
            key={validation.id}
            role={validation.severity === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-xl border p-4 ${validation.severity === "error" ? "border-amber-400/40 bg-amber-500/10" : "border-slate-700 bg-slate-900/60"}`}
          >
            <AlertTriangle className="mt-1 shrink-0 text-amber-300" size={20} aria-hidden />
            <div>
              <h3 className="font-semibold">{auditLabel(validation.severity)}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {analysisValidationCopy(validation.code)}
              </p>
            </div>
          </div>
        ))}
        {companyId && (
          <div className="flex flex-wrap gap-4 text-sm text-blue-300">
            <Link href={`/companies/${companyId}/discovery`}>
              Consulter les informations de l’entreprise
            </Link>
            <Link href={`/companies/${companyId}/interview`}>
              Consulter les réponses de l’entretien
            </Link>
          </div>
        )}
      </section>
      <details className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5">
        <summary className="cursor-pointer font-semibold">
          Comprendre les indicateurs internes
        </summary>
        <p className="my-4 text-sm text-slate-300">
          Ces scores reflètent les règles appliquées aux sources disponibles. Un score élevé ne
          remplace pas une preuve manquante et ne supprime aucun contrôle humain.
        </p>
        <section
          aria-label="Indicateurs de contexte"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {health.map((item) => (
            <Card key={item.id} className="opt-card">
              <CardHeader>
                <CardTitle className="text-sm">
                  {auditLabel(item.dimension ?? "Indicateur")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">
                {Number(item.score).toFixed(0)}
              </CardContent>
            </Card>
          ))}
        </section>
        <section
          aria-label="Scores du processus"
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {scores.map((item) => (
            <Card key={item.id} className="opt-card">
              <CardHeader>
                <CardTitle className="text-sm">{auditLabel(item.label ?? "Indicateur")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl">{Number(item.score).toFixed(0)} / 100</CardContent>
            </Card>
          ))}
        </section>
      </details>
      <section className="flex flex-col gap-3 sm:flex-row">
        <Search className="mt-2 shrink-0 text-blue-300" aria-hidden size={20} />
        <Input
          aria-label="Rechercher un constat"
          placeholder="Rechercher un constat"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filtrer par gravité"
          className="bg-background rounded-md border px-3 py-2"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="all">Toutes les gravités</option>
          {["critical", "high", "medium", "low", "information"].map((value) => (
            <option key={value} value={value}>
              {auditLabel(value)}
            </option>
          ))}
        </select>
      </section>
      <section aria-live="polite" className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              Aucun constat ne correspond à ces filtres.
            </CardContent>
          </Card>
        ) : (
          filtered.map((finding) => (
            <details
              key={finding.id}
              className="rounded-xl border border-slate-700 bg-slate-900/60 p-5"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="font-medium">{auditText(finding.title)}</span>
                <span className="flex gap-2">
                  <Badge className="border bg-transparent">{auditLabel(finding.category)}</Badge>
                  <Badge>{auditLabel(finding.severity)}</Badge>
                </span>
              </summary>
              <div className="mt-4 space-y-2 text-sm">
                <p>{auditText(finding.description)}</p>
                <p>
                  <strong>Piste à examiner :</strong> {auditText(finding.businessImpact)}
                </p>
                <p>
                  <strong>Indice de confiance interne :</strong>{" "}
                  {Number(finding.confidencePercentage).toFixed(0)} % — ce n’est pas une certitude
                  ni une autorisation d’automatiser.
                </p>
                <p className="flex items-center gap-2">
                  <FileCheck2 size={16} aria-hidden />
                  {finding.evidenceCount === undefined
                    ? "Références source non disponibles"
                    : finding.evidenceCount === 0
                      ? "Aucune référence source reliée — preuve à compléter"
                      : `${finding.evidenceCount} référence(s) source reliée(s) — à examiner`}
                </p>
              </div>
            </details>
          ))
        )}
      </section>
    </main>
  );
}
