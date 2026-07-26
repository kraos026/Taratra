"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
          `${item.title} ${item.description} ${item.businessProblem}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [opportunities, links, query, risk, capability],
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">Deterministic AI Opportunity Engine</p>
        <h1 className="text-3xl font-semibold">AI Opportunities Explorer</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-3" aria-label="Filters">
        <Input
          aria-label="Search opportunities"
          placeholder="Search opportunities"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter by risk"
          className="bg-background rounded-md border px-3"
          value={risk}
          onChange={(event) => setRisk(event.target.value)}
        >
          <option value="all">All risks</option>
          {["low", "medium", "high", "critical"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter by capability"
          className="bg-background rounded-md border px-3"
          value={capability}
          onChange={(event) => setCapability(event.target.value)}
        >
          <option value="all">All capabilities</option>
          {capabilities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </section>
      <section className="space-y-4" aria-live="polite">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              No AI opportunities match these filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{item.title}</CardTitle>
                  <Badge>{item.risk}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {links
                    .filter((link) => link.opportunityId === item.id)
                    .map((link) => (
                      <Badge className="border bg-transparent" key={link.capabilityId}>
                        {titleById.get(link.capabilityId)}
                      </Badge>
                    ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{item.businessProblem}</p>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
                  {[
                    ["Impact", item.businessImpact],
                    ["Feasibility", item.feasibility],
                    ["Data readiness", item.dataReadiness],
                    ["AI readiness", item.aiReadiness],
                    ["Complexity", item.technicalComplexity],
                    ["Confidence", item.confidence],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold">{Number(value).toFixed(0)}/100</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
