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
};
type ConnectorLink = { opportunityId: string; connectorId: string; available: boolean };
type Pattern = { id: string; title: string };
export function AutomationOpportunitiesExplorer({
  opportunities,
  connectors,
  patterns,
}: {
  opportunities: Opportunity[];
  connectors: ConnectorLink[];
  patterns: Pattern[];
}) {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState("all");
  const [complexity, setComplexity] = useState("all");
  const patternTitles = new Map(patterns.map((item) => [item.id, item.title]));
  const filtered = useMemo(
    () =>
      opportunities.filter(
        (item) =>
          (pattern === "all" || item.patternId === pattern) &&
          (complexity === "all" || item.implementationEffort === complexity) &&
          `${item.title} ${item.description} ${item.businessProblem}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [opportunities, pattern, complexity, query],
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">Deterministic Automation Opportunity Engine</p>
        <h1 className="text-3xl font-semibold">Automation Opportunities Explorer</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-3" aria-label="Filters">
        <Input
          aria-label="Search opportunities"
          placeholder="Search opportunities"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter by pattern"
          className="bg-background rounded-md border px-3"
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
        >
          <option value="all">All patterns</option>
          {patterns.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by complexity"
          className="bg-background rounded-md border px-3"
          value={complexity}
          onChange={(event) => setComplexity(event.target.value)}
        >
          <option value="all">All complexity levels</option>
          {["very_low", "low", "medium", "high", "very_high"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </section>
      <section className="space-y-4" aria-live="polite">
        {!filtered.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              No automation opportunities match these filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{item.title}</CardTitle>
                  <Badge>{item.implementationEffort}</Badge>
                </div>
                <div className="flex gap-2">
                  <Badge className="border bg-transparent">
                    {patternTitles.get(item.patternId)}
                  </Badge>
                  <Badge className="border bg-transparent">{item.triggerType}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{item.businessProblem}</p>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-7">
                  {[
                    ["Impact", item.businessImpact],
                    ["Coverage", item.automationCoverage],
                    ["Feasibility", item.technicalFeasibility],
                    ["Connectors", item.connectorAvailability],
                    ["Readiness", item.automationReadiness],
                    ["Complexity", item.complexityScore],
                    ["Confidence", item.confidence],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold">{Number(value).toFixed(0)}/100</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-muted-foreground text-xs">
                  {
                    connectors.filter((link) => link.opportunityId === item.id && link.available)
                      .length
                  }{" "}
                  evidenced connectors
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
