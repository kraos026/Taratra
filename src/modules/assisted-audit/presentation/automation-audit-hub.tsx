"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, LockKeyhole } from "lucide-react";
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
  const action = presentNextAction(model, companyId);
  const ambiguity = model.stages.find((stage) => stage.status === "AMBIGUOUS");
  const auditComplete = model.currentStage === "COMPLETED";

  return (
    <main className="mx-auto max-w-6xl space-y-6" aria-labelledby="audit-title">
      <header className="space-y-3">
        <Link
          className="text-sm text-neutral-500 hover:text-violet-700"
          href={`/companies/${companyId}`}
        >
          ← Back to {model.company.name}
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wider text-violet-700 uppercase">
              Assisted Automation Audit
            </p>
            <h1 id="audit-title" className="text-3xl font-bold sm:text-4xl">
              Automation Audit
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              We’re learning how your company works so we can identify where automation could save
              time and improve operations.
            </p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 text-sm dark:bg-neutral-950">
            <span className="text-muted-foreground block">Overall progress</span>
            <strong>
              {completed} of {visibleStages.length} stages complete
            </strong>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          {error}
        </div>
      )}

      <section aria-labelledby="audit-progress-title">
        <h2 id="audit-progress-title" className="sr-only">
          Audit progress
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStages.map((stage) => (
            <li key={stage.stage}>
              <Card
                className={cn(
                  "h-full",
                  stage.stage === model.currentStage && "border-violet-500 ring-1 ring-violet-200",
                )}
              >
                <CardContent className="flex items-start gap-3 pt-5">
                  <StatusIcon status={stage.status} />
                  <div className="min-w-0">
                    <p className="font-semibold">{stage.label}</p>
                    <StatusText status={stage.status} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {auditComplete ? (
        <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle>Automation Audit Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>AutomateX has analyzed your company and prepared your action plan.</p>
            <ActionControl action={action} busy={busy} onCommand={onCommand} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Next step</Badge>
              <span className="text-muted-foreground text-sm">
                {model.stages.find((stage) => stage.stage === model.currentStage)?.label}
              </span>
            </div>
            <CardTitle>{action?.label ?? "Review required"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {action?.description ??
                model.blockingReason ??
                "Your current role can review progress but cannot perform the next action."}
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
          Choose a process to analyze
        </h2>
        <p className="text-muted-foreground">
          AutomateX found multiple process maps that could continue this audit. No process has been
          selected automatically.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {candidates.map((candidate) => {
          const action = presentProcessCandidateAction(candidate);
          return (
            <Card key={candidate.id}>
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="font-semibold">Process map version {candidate.version}</p>
                  <p className="text-muted-foreground text-sm">Status: {candidate.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/process-maps/${candidate.id}`}
                  >
                    Review details
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
        {action.label}
      </Link>
    );
  if (action.kind === "unavailable")
    return (
      <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
        <strong>{action.label}</strong>
        <p>This input screen is not available yet. No value will be invented.</p>
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
      {busy ? "Working…" : action.label}
    </Button>
  );
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
    NOT_STARTED: "Not started",
    IN_PROGRESS: "In progress",
    READY_FOR_REVIEW: "Ready for review",
    READY_TO_PUBLISH: "Ready for approval",
    COMPLETED: "Complete",
    BLOCKED: "Waiting for a prerequisite",
    AMBIGUOUS: "Your choice is required",
  };
  return <p className="text-muted-foreground text-sm">{text[status]}</p>;
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
  if (status === 401) return "Please sign in to view this audit.";
  if (status === 403) return "You do not have permission to access this company audit.";
  if (status === 404) return "This company could not be found in your organization.";
  if (serverMessage?.toLowerCase().includes("discovery"))
    return "We need more company information before continuing.";
  return "Something went wrong while updating the audit. Please try again.";
}
