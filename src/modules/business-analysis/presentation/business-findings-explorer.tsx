"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Finding = {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  confidencePercentage: number | string;
  businessImpact: string;
};
type Metric = { id: string; label?: string; dimension?: string; score: number | string };

export function BusinessFindingsExplorer({
  findings,
  scores,
  health,
}: {
  findings: Finding[];
  scores: Metric[];
  health: Metric[];
}) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const filtered = useMemo(
    () =>
      findings.filter(
        (finding) =>
          (severity === "all" || finding.severity === severity) &&
          `${finding.title} ${finding.description} ${finding.category}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [findings, query, severity],
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">Deterministic Business Analysis</p>
        <h1 className="text-3xl font-semibold">Business Findings Explorer</h1>
      </header>
      <section aria-label="Business health" className="grid gap-4 md:grid-cols-4">
        {health.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">{item.dimension}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {Number(item.score).toFixed(0)}
            </CardContent>
          </Card>
        ))}
      </section>
      <section aria-label="Business scores" className="grid gap-4 md:grid-cols-3">
        {scores.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl">{Number(item.score).toFixed(0)} / 100</CardContent>
          </Card>
        ))}
      </section>
      <section className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Search findings"
          placeholder="Search findings"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter by severity"
          className="bg-background rounded-md border px-3 py-2"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          <option value="all">All severities</option>
          {["critical", "high", "medium", "low", "information"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </section>
      <section aria-live="polite" className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">No findings match these filters.</CardContent>
          </Card>
        ) : (
          filtered.map((finding) => (
            <details key={finding.id} className="rounded-lg border p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="font-medium">{finding.title}</span>
                <span className="flex gap-2">
                  <Badge className="border bg-transparent">{finding.category}</Badge>
                  <Badge>{finding.severity}</Badge>
                </span>
              </summary>
              <div className="mt-4 space-y-2 text-sm">
                <p>{finding.description}</p>
                <p>
                  <strong>Impact:</strong> {finding.businessImpact}
                </p>
                <p>
                  <strong>Confidence:</strong> {Number(finding.confidencePercentage).toFixed(0)}%
                </p>
              </div>
            </details>
          ))
        )}
      </section>
    </main>
  );
}
