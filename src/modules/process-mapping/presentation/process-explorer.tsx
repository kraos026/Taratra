"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Detail = {
  map: {
    id: string;
    name: string;
    status: string;
    versionNumber: number;
    processPatternVersion: number;
    completenessPercentage: string;
    confidencePercentage: string;
    coveragePercentage: string;
    readyForBusinessIntelligence: boolean;
    createdAt: string;
  };
  nodes: {
    id: string;
    nodeKey: string;
    nodeType: string;
    name: string;
    description: string | null;
    sequence: number | null;
  }[];
  edges: { id: string; fromNodeId: string; toNodeId: string; edgeType: string }[];
  ownership: {
    ownerKnowledgeNodeId: string | null;
    departmentKnowledgeNodeId: string | null;
    participantKnowledgeNodeIds: string[];
    supportingSystemNodeIds: string[];
  } | null;
  validations: {
    id: string;
    code: string;
    severity: string;
    message: string;
    nodeKey: string | null;
  }[];
  factUsage: { knowledgeFactId: string; usage: string; reason: string }[];
};
export function ProcessExplorer({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/process-maps/${id}`)
      .then(async (r) => {
        const p = (await r.json()) as { data?: Detail; error?: { message?: string } };
        if (!r.ok || !p.data) throw new Error(p.error?.message ?? "Process map unavailable");
        return p.data;
      })
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [id]);
  if (error)
    return (
      <div role="alert" className="rounded-xl border border-red-300 p-6">
        {error}
      </div>
    );
  if (!detail)
    return (
      <div
        role="status"
        className="h-64 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800"
      />
    );
  const node = detail.nodes.find((n) => n.id === selected);
  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-600">PROCESS INTELLIGENCE</p>
        <h1 className="text-3xl font-bold">{detail.map.name}</h1>
        <p className="text-muted-foreground">
          Version {detail.map.versionNumber} · pattern v{detail.map.processPatternVersion} ·{" "}
          {detail.map.status}
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-4">
        <Metric label="Complétude" value={`${detail.map.completenessPercentage}%`} />
        <Metric label="Confiance" value={`${detail.map.confidencePercentage}%`} />
        <Metric label="Coverage" value={`${detail.map.coveragePercentage}%`} />
        <Metric
          label="Business Intelligence"
          value={detail.map.readyForBusinessIntelligence ? "Prêt" : "Non prêt"}
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Graph view</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {detail.nodes.map((n, i) => (
              <div key={n.id} className="flex items-center gap-3">
                <button
                  onClick={() => setSelected(n.id)}
                  className="min-w-44 rounded-xl border p-4 text-left hover:border-violet-500"
                >
                  <span className="text-xs text-violet-600 uppercase">{n.nodeType}</span>
                  <strong className="block">{n.name}</strong>
                </button>
                {i < detail.nodes.length - 1 && <span aria-hidden>→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tree view</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {detail.nodes.map((n) => (
                <li key={n.id}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setSelected(n.id)}
                  >
                    {(n.sequence ?? 0) + 1}. {n.name}
                  </Button>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Validation panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.validations.map((v) => (
              <div
                key={v.id}
                className={`rounded-lg border p-3 ${v.severity === "error" ? "border-red-400" : v.severity === "warning" ? "border-orange-400" : "border-blue-400"}`}
              >
                <strong className="uppercase">{v.severity}</strong>
                <p>{v.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {node && (
        <Card>
          <CardHeader>
            <CardTitle>Détail — {node.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{node.description ?? "Aucune description supplémentaire."}</p>
            <p className="text-muted-foreground mt-2 text-sm">Identifiant : {node.nodeKey}</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ProcessMapHistory({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Detail["map"][]>([]);
  useEffect(() => {
    fetch(`/api/companies/${companyId}/process-maps?pageSize=100`)
      .then((r) => r.json())
      .then((p: { data?: { items: Detail["map"][] } }) => setItems(p.data?.items ?? []));
  }, [companyId]);
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Process Maps</h1>
        <p className="text-muted-foreground">Historique versionné des processus reconstruits.</p>
      </header>
      <div className="grid gap-4">
        {items.length ? (
          items.map((item) => (
            <Link key={item.id} href={`/process-maps/${item.id}`}>
              <Card className="hover:border-violet-500">
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <strong>{item.name}</strong>
                    <p className="text-muted-foreground text-sm">
                      Version {item.versionNumber} · {item.status}
                    </p>
                  </div>
                  <span>{item.completenessPercentage}%</span>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center">
              Aucune cartographie publiée ou en cours.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
