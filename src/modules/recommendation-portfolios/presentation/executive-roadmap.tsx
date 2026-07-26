"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
export function ExecutiveRoadmap({ recommendations }: { recommendations: Item[] }) {
  const [query, setQuery] = useState(""),
    [priority, setPriority] = useState("all"),
    [phase, setPhase] = useState("all");
  const filtered = useMemo(
    () =>
      recommendations.filter(
        (item) =>
          (priority === "all" || item.priority === priority) &&
          (phase === "all" || item.roadmapPhase === phase) &&
          `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [recommendations, query, priority, phase],
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">Deterministic Recommendation Engine</p>
        <h1 className="text-3xl font-semibold">Executive Roadmap</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-3">
        <Input
          aria-label="Search recommendations"
          placeholder="Search recommendations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter priority"
          className="bg-background rounded-md border px-3"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          {["critical", "high", "medium", "low", "future"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter phase"
          className="bg-background rounded-md border px-3"
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
        >
          <option value="all">All phases</option>
          {["phase_1", "phase_2", "phase_3", "phase_4"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </section>
      <section className="space-y-4">
        {!filtered.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              No recommendations match these filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex justify-between">
                  <CardTitle>{item.title}</CardTitle>
                  <div className="flex gap-2">
                    <Badge>{item.priority}</Badge>
                    <Badge className="border bg-transparent">{item.roadmapPhase}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{item.description}</p>
                <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    ["Category", item.category],
                    ["Priority score", item.priorityScore],
                    ["ROI", item.roiSpecialValue ?? item.expectedRoi ?? "—"],
                    ["Investment", item.implementationCost],
                    ["Confidence", item.confidence],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-muted-foreground text-sm">{label}</dt>
                      <dd className="font-semibold">{String(value)}</dd>
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
