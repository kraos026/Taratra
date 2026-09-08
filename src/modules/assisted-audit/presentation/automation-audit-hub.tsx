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
import { buildCustomerJourney, customerStatusLabel, journeyProgress } from "./canonical-journey";

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
  const progress = journeyProgress(model);
  const action = presentNextAction(model, companyId);
  const ambiguity = model.stages.find((stage) => stage.status === "AMBIGUOUS");
  const auditComplete = model.currentStage === "COMPLETED";
  const companyName = brandText(model.company.name);
  const clientSteps = buildCustomerJourney(model).map((step) => ({
    ...step,
    icon: journeyIcon(step.key),
  }));
  const activeStep = clientSteps.find((step) => step.status !== "COMPLETED") ?? clientSteps.at(-1);

  return (
    <main className="opt-container space-y-5" aria-labelledby="audit-title">
      <header className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <Link
          className="mb-3 inline-flex text-sm text-blue-300 hover:text-blue-100"
          href={`/companies/${companyId}`}
        >
          ← Retour à {companyName}
        </Link>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.28em] text-blue-300 uppercase">
              <Sparkles size={15} /> Parcours Optivos
            </p>
            <h1
              id="audit-title"
              className="font-['Manrope'] text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Audit
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Identifiez quoi automatiser, quoi améliorer et ce qui doit rester sous contrôle
              humain.
            </p>
          </div>
          <div className="w-full shrink-0 lg:w-60">
            <span className="text-xs font-bold tracking-[0.18em] text-slate-400 uppercase">
              Progression
            </span>
            <div className="mt-1 flex items-end justify-between gap-4">
              <strong className="block text-3xl text-white">{progress}%</strong>
              <span className="pb-1 text-xs text-slate-400">{activeStep?.label}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-blue-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">Progression validée, sans estimation</p>
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-label="Votre prochaine action" className="min-w-0">
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
                  <p className="flex items-center gap-2 text-sm text-amber-200" role="status">
                    <LockKeyhole size={16} aria-hidden /> {customerBlocker(model.blockingReason)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </section>
        <aside
          className="rounded-2xl border border-blue-400/15 bg-blue-500/[0.04] p-5"
          aria-label="Comment avance votre audit"
        >
          <p className="text-sm font-semibold text-white">Vous gardez la main</p>
          <ol className="mt-4 space-y-4 text-sm">
            <li>
              <strong className="text-blue-200">1. Vous décrivez votre activité</strong>
              <p className="mt-1 leading-5 text-slate-400">
                Quelques informations, puis des questions sur votre travail quotidien.
              </p>
            </li>
            <li>
              <strong className="text-blue-200">2. Optivos prépare l’analyse</strong>
              <p className="mt-1 leading-5 text-slate-400">
                Processus, possibilités d’automatisation et estimation économique, selon les données
                disponibles.
              </p>
            </li>
            <li>
              <strong className="text-blue-200">3. Vous examinez les propositions</strong>
              <p className="mt-1 leading-5 text-slate-400">
                Vous validez chaque étape. Aucune automatisation n’est déployée par cet audit.
              </p>
            </li>
          </ol>
        </aside>
      </div>

      <section aria-labelledby="audit-progress-title" className="pb-4">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="opt-eyebrow">Chemin de décision</p>
            <h2 id="audit-progress-title" className="font-['Manrope'] text-lg font-bold text-white">
              De la compréhension à la décision
            </h2>
          </div>
          {activeStep && (
            <p className="text-sm text-slate-300">
              Étape actuelle : <strong className="text-white">{activeStep.label}</strong>
            </p>
          )}
        </div>
        <ol className="flex overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
          {clientSteps.map((step, index) => (
            <li
              key={step.label}
              aria-current={step.current ? "step" : undefined}
              className={cn(
                "relative min-w-32 flex-1 border-r border-white/10 p-3 last:border-r-0",
                step.current && "bg-blue-500/12",
              )}
              title={step.description}
            >
              <div>
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-400",
                    step.current && "bg-blue-500 text-white",
                    step.status === "COMPLETED" && "bg-emerald-500/15 text-emerald-300",
                  )}
                >
                  {step.icon}
                </div>
                <div className="mt-3 min-w-0">
                  <span className="text-[10px] font-bold tracking-widest text-slate-600">
                    0{index + 1}
                  </span>
                  <p className="truncate text-sm font-bold text-white">{step.label}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusIcon status={step.status} />
                    <StatusText status={step.status} current={step.current} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

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
    return <CheckCircle2 className="shrink-0 text-emerald-400" size={14} aria-hidden />;
  if (status === "BLOCKED" || status === "AMBIGUOUS")
    return <AlertTriangle className="shrink-0 text-amber-400" size={14} aria-hidden />;
  return <Circle className="shrink-0 text-slate-600" size={13} aria-hidden />;
}

function StatusText({
  status,
  current = false,
}: {
  status: AssistedAuditStageStatus;
  current?: boolean;
}) {
  const label =
    current && status === "NOT_STARTED" ? "Prêt à démarrer" : customerStatusLabel(status);
  return <p className="truncate text-xs text-slate-400">{label}</p>;
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
          Réessayer
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

function journeyIcon(key: ReturnType<typeof buildCustomerJourney>[number]["key"]): ReactNode {
  if (key === "UNDERSTANDING") return <ClipboardCheck size={18} />;
  if (key === "PROCESS") return <MapIcon size={18} />;
  if (key === "ANALYSIS") return <BarChart3 size={18} />;
  if (key === "AUTOMATION") return <Sparkles size={18} />;
  if (key === "ROI") return <CircleGauge size={18} />;
  if (key === "PLAN") return <Target size={18} />;
  return <FileText size={18} />;
}

function customerActionLabel(label: string): string {
  return label
    .replaceAll("Start company discovery", "Commencer la compréhension")
    .replaceAll("Continue the interview", "Continuer l’entretien")
    .replaceAll("Start discovery", "Commencer la compréhension")
    .replaceAll("Continue discovery", "Continuer la compréhension")
    .replaceAll("View results", "Voir les résultats");
}

function customerActionDescription(description: string): string {
  if (/tell optivos how your company is organized and operates/i.test(description))
    return "Décrivez votre activité, votre organisation et vos processus. Vous pourrez enregistrer et reprendre à tout moment.";
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
  if (/read-only access/i.test(reason)) return "Votre accès permet la consultation uniquement.";
  if (/interview/i.test(reason)) return "Terminez et validez l’entretien avant de continuer.";
  if (/discovery|company information/i.test(reason))
    return "Complétez la compréhension de l’entreprise avant de continuer.";
  if (/process/i.test(reason)) return "Choisissez ou validez le processus avant de continuer.";
  return customerActionDescription(reason)
    .replaceAll("Complete", "Terminez")
    .replaceAll("first", "avant de continuer");
}
