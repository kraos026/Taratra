"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleGauge,
  Circle,
  ClipboardCheck,
  FileText,
  Loader2,
  LockKeyhole,
  MapIcon,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AssistedAuditArtifactReference,
  AssistedAuditReadModel,
  AssistedAuditStageStatus,
} from "../application/assisted-audit-model";
import {
  createActionLock,
  performAuditCommandAndRefresh,
  presentNextAction,
  presentProcessCandidateAction,
  type AuditActionPresentation,
  type AuditCommandRequest,
} from "./assisted-audit-action-plan";

export function AutomationAuditHub({ companyId }: { companyId: string }) {
  const [model, setModel] = useState<AssistedAuditReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionLock = useRef(createActionLock());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/companies/${companyId}/automation-audit`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: AssistedAuditReadModel;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.data)
        throw new Error(customerError(response.status, payload?.error?.message));
      setModel(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The audit could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    let active = true;

    void fetch(`/api/companies/${companyId}/automation-audit`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          data?: AssistedAuditReadModel;
          error?: { message?: string };
        } | null;
        if (!response.ok || !payload?.data)
          throw new Error(customerError(response.status, payload?.error?.message));
        return payload.data;
      })
      .then((data) => {
        if (active) setModel(data);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : "The audit could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companyId]);

  async function run(request: AuditCommandRequest) {
    if (!actionLock.current.acquire()) return;
    setBusy(true);
    setError(null);
    try {
      await performAuditCommandAndRefresh(request, load);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? customerError(0, caught.message)
          : "This action could not be completed.",
      );
    } finally {
      actionLock.current.release();
      setBusy(false);
    }
  }

  if (loading && !model) return <AuditHubSkeleton />;
  if (!model)
    return (
      <AuditHubError message={error ?? "The audit is not available."} onRetry={() => void load()} />
    );

  return (
    <AutomationAuditView
      companyId={companyId}
      model={model}
      busy={busy}
      error={error}
      onCommand={(request) => void run(request)}
    />
  );
}

export function AutomationAuditView({
  companyId,
  model,
  busy,
  error,
  onCommand,
}: {
  companyId: string;
  model: AssistedAuditReadModel;
  busy: boolean;
  error: string | null;
  onCommand: (request: AuditCommandRequest) => void;
}) {
  const visibleStages = model.stages.filter((stage) => stage.stage !== "COMPLETED");
  const completed = visibleStages.filter((stage) => stage.status === "COMPLETED").length;
  const progress = Math.round((completed / Math.max(visibleStages.length, 1)) * 100);
  const action = presentNextAction(model, companyId);
  const ambiguity = model.stages.find((stage) => stage.status === "AMBIGUOUS");
  const auditComplete = model.currentStage === "COMPLETED";
  const companyName = brandText(model.company.name);
  const clientSteps = buildClientSteps(model);
  const activeStep = clientSteps.find((step) => step.status !== "COMPLETED") ?? clientSteps.at(-1);

  return (
    <main className="opt-container space-y-6" aria-labelledby="audit-title">
      <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/70 p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
        <Link
          className="mb-5 inline-flex text-sm text-blue-300 hover:text-blue-100"
          href={`/companies/${companyId}`}
        >
          ← Retour à {companyName}
        </Link>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
              <Sparkles size={15} /> Parcours Optivos
            </p>
            <h1
              id="audit-title"
              className="font-['Manrope'] text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Audit
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Nous comprenons votre entreprise, vos preuves et vos contraintes avant de recommander
              quoi automatiser, corriger ou différer.
            </p>
          </div>
          <div className="min-w-56 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <span className="text-xs font-bold tracking-[0.18em] text-slate-400 uppercase">
              Progression
            </span>
            <strong className="mt-2 block text-3xl text-white">{progress}%</strong>
            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-blue-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {completed} / {visibleStages.length} étapes terminées
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100"
        >
          {error}
        </div>
      )}

      <section aria-labelledby="audit-progress-title">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="opt-eyebrow">Chemin de décision</p>
            <h2
              id="audit-progress-title"
              className="font-['Manrope'] text-2xl font-bold text-white"
            >
              7 étapes lisibles côté métier
            </h2>
          </div>
          {activeStep && (
            <p className="text-sm text-slate-300">
              Étape actuelle : <strong className="text-white">{activeStep.label}</strong>
            </p>
          )}
        </div>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {clientSteps.map((step, index) => (
            <li key={step.label}>
              <Card
                className={cn(
                  "h-full border-white/10 bg-slate-900/80 text-slate-50",
                  step.current && "border-blue-400/60 ring-1 ring-blue-400/30",
                )}
              >
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl bg-blue-500/15 text-blue-200">
                      {step.icon}
                    </div>
                    <span className="text-xs font-bold text-slate-500">0{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{step.label}</p>
                    <p className="mt-2 text-sm leading-5 text-slate-400">{step.description}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <StatusIcon status={step.status} />
                    <StatusText status={step.status} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {auditComplete ? (
        <Card className="opt-card border-emerald-400/40 bg-emerald-500/10">
          <CardHeader>
            <CardTitle>Audit Optivos terminé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Optivos a analysé votre entreprise et préparé votre plan d’action.</p>
            <ActionControl action={action} busy={busy} onCommand={onCommand} />
          </CardContent>
        </Card>
      ) : (
        <Card className="opt-card">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-500/15 text-blue-100">Prochaine action</Badge>
              <span className="text-sm text-slate-400">{activeStep?.label}</span>
            </div>
            <CardTitle className="font-['Manrope'] text-2xl">
              {action ? customerActionLabel(action.label) : "Informations requises"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300">
              {action?.description
                ? customerActionDescription(action.description)
                : model.blockingReason
                  ? customerBlocker(model.blockingReason)
                  : "Votre accès permet de consulter l’avancement. Une personne autorisée doit réaliser la prochaine action."}
            </p>
            <ActionControl action={action} busy={busy} onCommand={onCommand} />
            {model.blockingReason && !action && (
              <p className="flex items-center gap-2 text-sm text-amber-800" role="status">
                <LockKeyhole size={16} aria-hidden /> {model.blockingReason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {ambiguity && (
        <ProcessMapChoice
          candidates={ambiguity.candidateArtifacts}
          busy={busy}
          onCommand={onCommand}
        />
      )}
    </main>
  );
}

function ProcessMapChoice({
  candidates,
  busy,
  onCommand,
}: {
  candidates: AssistedAuditArtifactReference[];
  busy: boolean;
  onCommand: (request: AuditCommandRequest) => void;
}) {
  return (
    <section aria-labelledby="process-choice-title" className="space-y-3">
      <div>
        <h2 id="process-choice-title" className="text-xl font-semibold">
          Choisir le processus à analyser
        </h2>
        <p className="text-muted-foreground">
          Optivos a trouvé plusieurs cartographies possibles. Aucun processus n’est sélectionné
          automatiquement.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {candidates.map((candidate) => {
          const action = presentProcessCandidateAction(candidate);
          return (
            <Card key={candidate.id} className="opt-card">
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="font-semibold">Cartographie version {candidate.version}</p>
                  <p className="text-sm text-slate-400">Statut : {candidate.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/process-maps/${candidate.id}`}
                  >
                    Voir le détail
                  </Link>
                  <ActionControl action={action} busy={busy} onCommand={onCommand} compact />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ActionControl({
  action,
  busy,
  onCommand,
  compact = false,
}: {
  action: AuditActionPresentation | null;
  busy: boolean;
  onCommand: (request: AuditCommandRequest) => void;
  compact?: boolean;
}) {
  if (!action) return null;
  if (action.kind === "navigate")
    return (
      <Link className={buttonVariants({ size: compact ? "sm" : "lg" })} href={action.href}>
        {customerActionLabel(action.label)}
      </Link>
    );
  if (action.kind === "unavailable")
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"
      >
        <strong>{action.label}</strong>
        <p>Cette étape n’est pas disponible pour le moment. Aucune donnée ne sera inventée.</p>
      </div>
    );
  return (
    <Button
      size={compact ? "sm" : "lg"}
      disabled={busy}
      aria-busy={busy}
      onClick={() => onCommand(action.request)}
    >
      {busy && <Loader2 className="animate-spin" size={16} aria-hidden />}
      {busy ? "Traitement…" : customerActionLabel(action.label)}
    </Button>
  );
}

function brandText(value: string): string {
  return value.replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}

function StatusIcon({ status }: { status: AssistedAuditStageStatus }) {
  if (status === "COMPLETED")
    return <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden />;
  if (status === "BLOCKED" || status === "AMBIGUOUS")
    return <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} aria-hidden />;
  return <Circle className="mt-0.5 shrink-0 text-violet-600" size={20} aria-hidden />;
}

function StatusText({ status }: { status: AssistedAuditStageStatus }) {
  const text: Record<AssistedAuditStageStatus, string> = {
    NOT_STARTED: "À faire",
    IN_PROGRESS: "En cours",
    READY_FOR_REVIEW: "À valider",
    READY_TO_PUBLISH: "Prêt à publier",
    COMPLETED: "Terminé",
    BLOCKED: "Informations requises",
    AMBIGUOUS: "Choix requis",
  };
  return <p className="text-sm text-slate-400">{text[status]}</p>;
}

function AuditHubSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading automation audit" className="space-y-6">
      <div
        role="status"
        className="h-28 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800"
      >
        <span className="sr-only">Loading automation audit…</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800"
          />
        ))}
      </div>
    </main>
  );
}

function AuditHubError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-4 py-10 text-center" role="alert">
        <AlertTriangle className="mx-auto text-red-600" aria-hidden />
        <p>{message}</p>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function customerError(status: number, serverMessage?: string): string {
  if (status === 401) return "Connectez-vous pour consulter cet audit.";
  if (status === 403) return "Vous n’avez pas accès à cet audit.";
  if (status === 404) return "Cette entreprise est introuvable dans votre espace.";
  if (serverMessage?.toLowerCase().includes("discovery"))
    return "Des informations sur l’entreprise sont nécessaires avant de continuer.";
  return "L’audit n’a pas pu être mis à jour. Réessayez.";
}

type ClientStep = {
  readonly label: string;
  readonly description: string;
  readonly status: AssistedAuditStageStatus;
  readonly current: boolean;
  readonly icon: ReactNode;
};

function buildClientSteps(model: AssistedAuditReadModel): ClientStep[] {
  const byStage = new Map(model.stages.map((stage) => [stage.stage, stage]));
  const currentIn = (stages: AssistedAuditReadModel["stages"][number]["stage"][]) =>
    stages.includes(model.currentStage);
  const statusFor = (stages: AssistedAuditReadModel["stages"][number]["stage"][]) => {
    const current = byStage.get(model.currentStage);
    if (current && stages.includes(model.currentStage)) return current.status;
    return combineStatuses(stages.map((stage) => byStage.get(stage)?.status ?? "NOT_STARTED"));
  };

  return [
    {
      label: "Compréhension",
      description: "Décrire l’entreprise et compléter les questions clés.",
      status: statusFor(["DISCOVERY", "INTERVIEW", "KNOWLEDGE"]),
      current: currentIn(["DISCOVERY", "INTERVIEW", "KNOWLEDGE"]),
      icon: <ClipboardCheck size={18} />,
    },
    {
      label: "Processus",
      description: "Identifier le parcours opérationnel réellement utilisé.",
      status: statusFor(["PROCESS_MAP"]),
      current: currentIn(["PROCESS_MAP"]),
      icon: <MapIcon size={18} />,
    },
    {
      label: "Analyse",
      description: "Repérer les frictions, risques et causes probables.",
      status: statusFor(["BUSINESS_ANALYSIS", "AI_OPPORTUNITIES"]),
      current: currentIn(["BUSINESS_ANALYSIS", "AI_OPPORTUNITIES"]),
      icon: <BarChart3 size={18} />,
    },
    {
      label: "Opportunités",
      description: "Prioriser les pistes d’automatisation réalistes.",
      status: statusFor(["AUTOMATION_OPPORTUNITIES"]),
      current: currentIn(["AUTOMATION_OPPORTUNITIES"]),
      icon: <Sparkles size={18} />,
    },
    {
      label: "ROI",
      description: "Qualifier la valeur lorsque les preuves le permettent.",
      status: statusFor(["ROI"]),
      current: currentIn(["ROI"]),
      icon: <CircleGauge size={18} />,
    },
    {
      label: "Plan d’action",
      description: "Transformer les recommandations en décisions pilotables.",
      status: statusFor(["RECOMMENDATIONS"]),
      current: currentIn(["RECOMMENDATIONS"]),
      icon: <Target size={18} />,
    },
    {
      label: "Résultats",
      description: "Consulter la synthèse finale et les prochaines étapes.",
      status: model.currentStage === "COMPLETED" ? "COMPLETED" : statusFor(["COMPLETED"]),
      current: model.currentStage === "COMPLETED",
      icon: <FileText size={18} />,
    },
  ];
}

function combineStatuses(statuses: AssistedAuditStageStatus[]): AssistedAuditStageStatus {
  if (statuses.some((status) => status === "AMBIGUOUS")) return "AMBIGUOUS";
  if (statuses.some((status) => status === "BLOCKED")) return "BLOCKED";
  if (statuses.every((status) => status === "COMPLETED")) return "COMPLETED";
  if (statuses.some((status) => status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (statuses.some((status) => status === "READY_FOR_REVIEW")) return "READY_FOR_REVIEW";
  if (statuses.some((status) => status === "READY_TO_PUBLISH")) return "READY_TO_PUBLISH";
  return "NOT_STARTED";
}

function customerActionLabel(label: string): string {
  return label
    .replaceAll("Continue the interview", "Continuer l’entretien")
    .replaceAll("Start discovery", "Commencer la compréhension")
    .replaceAll("Continue discovery", "Continuer la compréhension")
    .replaceAll("View results", "Voir les résultats");
}

function customerActionDescription(description: string): string {
  if (/remaining operational questions/i.test(description))
    return "Répondez aux dernières questions utiles pour poursuivre l’audit.";
  return description
    .replaceAll("Discovery", "compréhension")
    .replaceAll("Interview", "entretien")
    .replaceAll("Knowledge", "synthèse des preuves")
    .replaceAll("Process Map", "processus")
    .replaceAll("AI Opportunities", "opportunités")
    .replaceAll("Automation Opportunities", "opportunités d’automatisation")
    .replaceAll("Action Plan", "plan d’action");
}

function customerBlocker(reason: string): string {
  if (/interview/i.test(reason)) return "Terminez et validez l’entretien avant de continuer.";
  if (/discovery|company information/i.test(reason))
    return "Complétez la compréhension de l’entreprise avant de continuer.";
  if (/process/i.test(reason)) return "Choisissez ou validez le processus avant de continuer.";
  return customerActionDescription(reason)
    .replaceAll("Complete", "Terminez")
    .replaceAll("first", "avant de continuer");
}
