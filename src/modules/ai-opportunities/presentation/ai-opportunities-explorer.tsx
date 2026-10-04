"use client";
import { useMemo, useState } from "react";
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
}: {
  opportunities: Opportunity[];
  links: Link[];
  capabilities: Capability[];
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
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">PISTES D’ASSISTANCE</p>
        <h1 className="text-3xl font-semibold">Les usages de l’IA à examiner</h1>
        <p className="mt-3 text-sm text-slate-300">
          Ces pistes proviennent des règles appliquées aux constats de l’analyse. Elles ne sont ni
          des gains garantis, ni des automatisations autorisées. Vérifiez les données disponibles et
          les contrôles humains avant de poursuivre.
        </p>
      </header>
      <section className="grid gap-3 md:grid-cols-3" aria-label="Filtres">
        <Input
          aria-label="Rechercher une piste"
          placeholder="Rechercher une piste"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filtrer par risque"
          className="bg-background rounded-md border px-3"
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
        <select
          aria-label="Filtrer par usage"
          className="bg-background rounded-md border px-3"
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
      </section>
      <section className="space-y-4" aria-live="polite">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              Aucune piste ne correspond à ces filtres.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{aiOpportunityText(item.title)}</CardTitle>
                  <Badge>Risque : {auditLabel(item.risk)}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {links
                    .filter((link) => link.opportunityId === item.id)
                    .map((link) => (
                      <Badge className="border bg-transparent" key={link.capabilityId}>
                        {aiOpportunityText(titleById.get(link.capabilityId) ?? "Usage à préciser")}
                      </Badge>
                    ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{aiOpportunityText(item.businessProblem)}</p>
                <p className="text-muted-foreground text-sm">
                  {aiOpportunityText(item.description)}
                </p>
                {item.dataReadiness === 0 && (
                  <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm">
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
    </main>
  );
}
