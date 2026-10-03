"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, CircleCheck, Hand, ListChecks } from "lucide-react";
import { auditLabel, auditText } from "@/modules/assisted-audit/presentation/audit-readable-copy";

export type ProcessMapDetail = {
  map: {
    id: string;
    companyId?: string;
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
    executionMode: string | null;
    estimatedDurationMinutes: string | null;
    actorKnowledgeNodeId: string | null;
    frequency: string | null;
    knowledgeFactIds: string[];
    attributesJson: {
      executionMetadataProjection?: {
        status?: string;
        durationSemantic?: string;
        requiresHumanValidation?: boolean;
      };
    } | null;
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
type Detail = ProcessMapDetail;
export function ProcessExplorer({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/process-maps/${id}`)
      .then(async (r) => {
        const p = (await r.json()) as { data?: Detail; error?: { message?: string } };
        if (!r.ok || !p.data)
          throw new Error("Cette cartographie n’est pas disponible dans votre espace.");
        return p.data;
      })
      .then(setDetail)
      .catch(() =>
        setError(
          "Impossible de charger cette cartographie. Vérifiez votre connexion ou votre accès au dossier.",
        ),
      );
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
  return <ProcessMapView detail={detail} selected={selected} onSelect={setSelected} />;
}

export function ProcessMapView({
  detail,
  selected,
  onSelect,
}: {
  detail: Detail;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const node = detail.nodes.find((n) => n.id === selected);
  return (
    <main className="opt-container min-w-0 space-y-6 py-6">
      <header className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        {detail.map.companyId && (
          <Link
            className="mb-4 inline-flex text-sm text-blue-300"
            href={`/companies/${detail.map.companyId}/automation-audit`}
          >
            ← Retour à l’audit
          </Link>
        )}
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-blue-300 uppercase">
          <GitBranch size={18} aria-hidden /> Comprendre le travail
        </p>
        <h1 className="mt-3 text-3xl font-bold">{auditText(detail.map.name)}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Version {detail.map.versionNumber} · {auditLabel(detail.map.status)}
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
          Cette cartographie décrit le processus à examiner. Elle ne déploie aucune automatisation.
          Sélectionnez une étape pour consulter ses informations source et ses transitions.
        </p>
      </header>
      <section
        aria-label="Indicateurs de la cartographie"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label="Informations renseignées"
          value={`${detail.map.completenessPercentage} %`}
          explanation="Complétude de la structure ; des preuves métier peuvent encore manquer."
        />
        <Metric
          label="Confiance interne"
          value={`${detail.map.confidencePercentage} %`}
          explanation="Indice du moteur sur cette cartographie, pas une probabilité de réussite."
        />
        <Metric
          label="Couverture du modèle"
          value={`${detail.map.coveragePercentage} %`}
          explanation="Couverture évaluée pour le modèle de processus, pas un pourcentage de tâches automatisables."
        />
        <Metric
          label="Étape d’analyse"
          value={detail.map.readyForBusinessIntelligence ? "Structure exploitable" : "À compléter"}
          explanation="Ce signal ne vaut ni approbation, ni rentabilité, ni autorisation d’automatiser."
        />
      </section>
      <Card className="opt-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks size={20} aria-hidden /> Les étapes de votre processus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-300">
            Les étapes sont affichées sans inventer d’enchaînement. Le détail indique les
            transitions enregistrées.
          </p>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detail.nodes.map((n, i) => (
              <li key={n.id} className="min-w-0">
                <button
                  onClick={() => onSelect(n.id)}
                  aria-pressed={selected === n.id}
                  className={`h-full w-full min-w-0 rounded-xl border bg-slate-900/70 p-5 text-left text-slate-100 transition-colors hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-400 ${selected === n.id ? "border-blue-400" : "border-slate-700"}`}
                >
                  <span className="text-xs font-semibold text-blue-300">
                    {i + 1} · {auditLabel(n.nodeType)}
                  </span>
                  <strong className="mt-2 block break-words">{auditText(n.name)}</strong>
                  {n.attributesJson?.executionMetadataProjection?.requiresHumanValidation ===
                    true && (
                    <span className="mt-3 flex items-center gap-2 text-xs text-amber-200">
                      <Hand size={14} aria-hidden /> Validation humaine requise
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="opt-card">
          <CardHeader>
            <CardTitle>Repères du processus</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {detail.nodes.map((n) => (
                <li key={n.id}>
                  <Button
                    variant="outline"
                    className="h-auto w-full justify-start border-slate-700 bg-slate-900/70 whitespace-normal text-slate-100 hover:bg-slate-800"
                    onClick={() => onSelect(n.id)}
                  >
                    {auditText(n.name)}
                  </Button>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card className="opt-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleCheck size={20} aria-hidden /> Contrôles de la cartographie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.validations.map((v) => (
              <div
                key={v.id}
                className={`rounded-lg border p-3 ${v.severity === "error" ? "border-red-400" : v.severity === "warning" ? "border-orange-400" : "border-blue-400"}`}
              >
                <strong>{auditLabel(v.severity)}</strong>
                <p>{auditText(v.message)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {node && (
        <Card className="opt-card">
          <CardHeader>
            <CardTitle>Détail — {node.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {node.description
                ? auditText(node.description)
                : "Aucune description supplémentaire."}
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Metadata
                label="Mode d’exécution"
                value={node.executionMode ? auditLabel(node.executionMode) : "Inconnu"}
              />
              <Metadata
                label="Durée"
                value={
                  node.estimatedDurationMinutes
                    ? `${node.estimatedDurationMinutes} min`
                    : "Inconnue"
                }
              />
              <Metadata
                label="Fréquence"
                value={node.frequency ? auditLabel(node.frequency) : "Inconnue"}
              />
              <Metadata
                label="Acteur"
                value={node.actorKnowledgeNodeId ? "Relié à la connaissance" : "À valider"}
              />
              <Metadata
                label="Validation humaine"
                value={
                  node.attributesJson?.executionMetadataProjection?.requiresHumanValidation === true
                    ? "Requise selon la source"
                    : node.attributesJson?.executionMetadataProjection?.requiresHumanValidation ===
                        false
                      ? "Non requise selon la source — à examiner"
                      : "Non renseignée"
                }
              />
              <Metadata label="Faits source" value={`${node.knowledgeFactIds.length}`} />
            </dl>
            <div className="mt-4 text-sm">
              <h3 className="font-semibold">Transitions enregistrées</h3>
              <ul className="mt-2 space-y-2">
                {detail.edges
                  .filter((edge) => edge.fromNodeId === node.id)
                  .map((edge) => (
                    <li key={edge.id}>
                      Vers{" "}
                      {auditText(
                        detail.nodes.find((target) => target.id === edge.toNodeId)?.name ??
                          "une étape non renseignée",
                      )}
                    </li>
                  ))}
              </ul>
              {!detail.edges.some((edge) => edge.fromNodeId === node.id) && (
                <p>Aucune transition sortante enregistrée.</p>
              )}
            </div>
            <details className="mt-4 text-xs text-slate-400">
              <summary className="cursor-pointer">Détails techniques de traçabilité</summary>
              <p className="mt-2 break-all">Référence de l’étape : {node.nodeKey}</p>
              <p>Version du modèle : {detail.map.processPatternVersion}</p>
              <p>
                État des informations d’exécution :{" "}
                {node.attributesJson?.executionMetadataProjection?.status ?? "Non renseigné"}
              </p>
            </details>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
function Metric({
  label,
  value,
  explanation,
}: {
  label: string;
  value: string;
  explanation: string;
}) {
  return (
    <Card className="opt-card">
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="mt-3 text-xs leading-5 text-slate-300">{explanation}</p>
      </CardContent>
    </Card>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
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
        <h1 className="text-3xl font-bold">Cartographies des processus</h1>
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
                      Version {item.versionNumber} · {auditLabel(item.status)}
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
