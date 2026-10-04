"use client";
import { useMemo, useState } from "react";
import NextLink from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auditLabel } from "@/modules/assisted-audit/presentation/audit-readable-copy";
import { aiOpportunityText } from "./ai-opportunity-copy";

type Opportunity = {
  id: string;
  title: string;
  description: string;
  businessProblem: string;
  risk: string;
  confidence: number;
  feasibility: number;
  businessImpact: number;
  technicalComplexity: number;
  dataReadiness: number;
  aiReadiness: number;
  implementationEffort: string;
};
type Link = { opportunityId: string; capabilityId: string };
type Capability = { id: string; title: string };
export function AiOpportunitiesExplorer({
  opportunities,
  links,
  capabilities,
  companyId,
}: {
  opportunities: Opportunity[];
  links: Link[];
  capabilities: Capability[];
  companyId?: string;
}) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [capability, setCapability] = useState("all");
  const titleById = new Map(capabilities.map((item) => [item.id, item.title]));
  const filtered = useMemo(
    () =>
      opportunities.filter((item) => {
        const itemCapabilities = links.filter((link) => link.opportunityId === item.id);
        return (
          (risk === "all" || item.risk === risk) &&
          (capability === "all" ||
            itemCapabilities.some((link) => link.capabilityId === capability)) &&
          `${aiOpportunityText(item.title)} ${aiOpportunityText(item.description)} ${aiOpportunityText(item.businessProblem)}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [opportunities, links, query, risk, capability],
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 text-slate-100 sm:p-6">
      {companyId && (
        <NextLink
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-sky-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"
          href={`/companies/${companyId}/automation-audit`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Retour au parcours de l’audit
        </NextLink>
      )}
      <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-8">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-sky-200">
          <Sparkles size={18} aria-hidden="true" /> PISTES D’ASSISTANCE
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Les usages de l’IA à examiner</h1>
        <p className="mt-3 text-sm text-slate-300">
          Ces pistes proviennent des règles appliquées aux constats de l’analyse. Elles ne sont ni
          des gains garantis, ni des automatisations autorisées. Vérifiez les données disponibles et
          les contrôles humains avant de poursuivre.
        </p>
        <p className="mt-4 border-t border-slate-700 pt-4 text-sm text-slate-300">
          Votre prochaine étape : examiner ces pistes, puis revenir au parcours pour les valider.
          L’estimation économique et la décision finale viennent ensuite.
        </p>
      </header>
      <section
        className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 md:grid-cols-3"
        aria-label="Filtres"
      >
        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Rechercher</span>
          <Input
            className="h-11 border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-400"
            aria-label="Rechercher une piste"
            placeholder="Rechercher une piste"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Niveau de risque</span>
          <select
            aria-label="Filtrer par risque"
            className="h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-slate-100 [color-scheme:dark] outline-none focus-visible:ring-2 focus-visible:ring-sky-400 [&>option]:bg-slate-950 [&>option]:text-slate-100"
            value={risk}
            onChange={(event) => setRisk(event.target.value)}
          >
            <option value="all">Tous les risques</option>
            {["low", "medium", "high", "critical"].map((value) => (
              <option key={value} value={value}>
                {auditLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Type d’assistance</span>
          <select
            aria-label="Filtrer par usage"
            className="h-11 w-full rounded-md border border-slate-600 bg-slate-950 px-3 text-slate-100 [color-scheme:dark] outline-none focus-visible:ring-2 focus-visible:ring-sky-400 [&>option]:bg-slate-950 [&>option]:text-slate-100"
            value={capability}
            onChange={(event) => setCapability(event.target.value)}
          >
            <option value="all">Tous les usages</option>
            {capabilities.map((item) => (
              <option key={item.id} value={item.id}>
                {aiOpportunityText(item.title)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <p className="text-sm text-slate-300" role="status">
        {filtered.length} piste{filtered.length > 1 ? "s" : ""} affichée
        {filtered.length > 1 ? "s" : ""} sur {opportunities.length}
      </p>
      <section className="space-y-4" aria-live="polite">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              Aucune piste ne correspond à ces filtres.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card
              key={item.id}
              className="rounded-2xl border-slate-700 bg-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{aiOpportunityText(item.title)}</CardTitle>
                  <Badge>Risque : {auditLabel(item.risk)}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {links
                    .filter((link) => link.opportunityId === item.id)
                    .map((link) => (
                      <Badge
                        className="border border-sky-400/30 bg-sky-400/10 text-sky-200"
                        key={link.capabilityId}
                      >
                        {aiOpportunityText(titleById.get(link.capabilityId) ?? "Usage à préciser")}
                      </Badge>
                    ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{aiOpportunityText(item.businessProblem)}</p>
                <p className="text-sm leading-relaxed text-slate-300">
                  {aiOpportunityText(item.description)}
                </p>
                {item.dataReadiness === 0 && (
                  <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Données nécessaires à compléter : aucun résultat ni gain de cette piste n’est
                    démontré à ce stade.
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">
                    Comprendre les indices du moteur
                  </summary>
                  <p className="my-3 text-sm text-slate-300">
                    Ces indices internes ne sont pas des pourcentages de réussite. La confiance dans
                    les sources ne remplace pas les données manquantes ni la validation humaine.
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
                    {[
                      ["Impact potentiel", item.businessImpact],
                      ["Faisabilité", item.feasibility],
                      ["Préparation des données", item.dataReadiness],
                      ["Préparation aux usages IA", item.aiReadiness],
                      ["Complexité", item.technicalComplexity],
                      ["Confiance dans les sources", item.confidence],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-semibold">{Number(value).toFixed(0)}/100</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </CardContent>
            </Card>
          ))
        )}
      </section>
      {companyId && (
        <NextLink
          className="flex items-center justify-between gap-3 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 font-semibold text-sky-100 hover:bg-sky-500/20 focus-visible:outline-2 focus-visible:outline-sky-400"
          href={`/companies/${companyId}/automation-audit`}
        >
          Poursuivre la revue dans le parcours d’audit <ArrowRight size={18} aria-hidden="true" />
        </NextLink>
      )}
    </main>
  );
}
