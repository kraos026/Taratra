"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
}: {
  currency: string;
  scenarios: Scenario[];
  evaluations: Evaluation[];
  metrics: Metric[];
}) {
  const [scenario, setScenario] = useState("expected"),
    [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const scenarioIds = new Set(
      scenarios
        .filter((item) => scenario === "all" || item.type === scenario)
        .map((item) => item.id),
    );
    return evaluations.filter(
      (item) =>
        scenarioIds.has(item.scenarioId) &&
        `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
    );
  }, [evaluations, scenarios, scenario, query]);
  const value = (id: string, code: string) =>
    metrics.find((item) => item.evaluationId === id && item.code === code);
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">Deterministic ROI Engine · {currency}</p>
        <h1 className="text-3xl font-semibold">ROI Explorer</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-2" aria-label="Filters">
        <Input
          aria-label="Search evaluations"
          placeholder="Search evaluations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter by scenario"
          className="bg-background rounded-md border px-3"
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
        >
          <option value="all">All scenarios</option>
          {["conservative", "expected", "optimistic"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </section>
      <section className="space-y-4" aria-live="polite">
        {!filtered.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              No ROI evaluations match these filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => {
            const roi = value(item.id, "roi_percentage"),
              payback = value(item.id, "payback_period"),
              savings = value(item.id, "annual_cost_saved"),
              cost = value(item.id, "implementation_cost");
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{item.title}</CardTitle>
                    <Badge>
                      {scenarios.find((scenarioItem) => scenarioItem.id === item.scenarioId)?.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-sm">{item.description}</p>
                  <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {[
                      ["Annual savings", savings],
                      ["Implementation", cost],
                      ["Payback", payback],
                      ["ROI", roi],
                      [
                        "Confidence",
                        { value: item.confidence, specialValue: null, unit: "percent" },
                      ],
                    ].map(([label, metric]) => (
                      <div key={String(label)}>
                        <dt className="text-muted-foreground text-sm">{label as string}</dt>
                        <dd className="font-semibold">
                          {typeof metric === "object" && metric
                            ? (metric.specialValue ??
                              `${Number(metric.value).toFixed(2)} ${metric.unit === "percent" ? "%" : metric.unit.includes("currency") ? currency : metric.unit}`)
                            : "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </main>
  );
}
