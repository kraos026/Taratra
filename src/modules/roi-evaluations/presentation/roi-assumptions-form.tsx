"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";
import {
  createActionLock,
  presentNextAction,
} from "@/modules/assisted-audit/presentation/assisted-audit-action-plan";
import type { AssumptionCode } from "../domain/roi-engine";

type AssumptionState = { unknown: boolean; value: string };
type AssumptionFormState = Record<AssumptionCode, AssumptionState>;
export type RoiDetail = {
  snapshot: {
    id: string;
    currency: string;
    lockVersion: number;
    status: string;
    provenanceJson?: unknown;
  };
  metrics: { value: unknown }[];
};

export const roiAssumptionFields: {
  code: AssumptionCode;
  label: string;
  help: string;
  group: "Time and work" | "Costs" | "Automation";
}[] = [
  {
    code: "working_days",
    label: "Working days per year",
    help: "Typical working days in one year.",
    group: "Time and work",
  },
  {
    code: "working_hours",
    label: "Working hours per day",
    help: "Typical paid hours in one working day.",
    group: "Time and work",
  },
  {
    code: "monthly_frequency",
    label: "Occurrences per month",
    help: "How often the process runs in a typical month.",
    group: "Time and work",
  },
  {
    code: "annual_frequency",
    label: "Occurrences per year",
    help: "How often the process runs in a typical year.",
    group: "Time and work",
  },
  {
    code: "hourly_cost",
    label: "Hourly staff cost",
    help: "Estimated fully loaded cost for one hour of work.",
    group: "Costs",
  },
  {
    code: "implementation_cost",
    label: "Implementation cost",
    help: "One-time cost to implement the automation.",
    group: "Costs",
  },
  {
    code: "maintenance_cost",
    label: "Annual maintenance cost",
    help: "Expected recurring maintenance cost per year.",
    group: "Costs",
  },
  {
    code: "training_cost",
    label: "Training cost",
    help: "One-time cost to train the people involved.",
    group: "Costs",
  },
  {
    code: "infrastructure_cost",
    label: "Infrastructure cost",
    help: "One-time systems or infrastructure cost.",
    group: "Costs",
  },
  {
    code: "error_cost",
    label: "Cost per error",
    help: "Estimated cost of one avoidable process error.",
    group: "Costs",
  },
  {
    code: "hours_saved_per_occurrence",
    label: "Hours saved per occurrence",
    help: "Estimated time the automation saves each time it runs.",
    group: "Automation",
  },
];

export function emptyAssumptions(): AssumptionFormState {
  return Object.fromEntries(
    roiAssumptionFields.map(({ code }) => [code, { unknown: false, value: "" }]),
  ) as AssumptionFormState;
}

export function buildRoiRequest(currency: string, assumptions: AssumptionFormState) {
  const errors: Partial<Record<AssumptionCode | "currency", string>> = {};
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Enter a three-letter currency code.";
  const payload = {} as Record<
    AssumptionCode,
    { status: "known"; value: number } | { status: "unknown" }
  >;
  for (const { code } of roiAssumptionFields) {
    const state = assumptions[code];
    if (state.unknown) payload[code] = { status: "unknown" };
    else {
      const value = Number(state.value);
      if (state.value.trim() === "" || !Number.isFinite(value) || value < 0)
        errors[code] = "Enter a non-negative number or choose “I don't know yet”.";
      else payload[code] = { status: "known", value };
    }
  }
  return Object.keys(errors).length
    ? { success: false as const, errors }
    : { success: true as const, data: { currency, assumptions: payload } };
}
type RoiRequestData = Extract<ReturnType<typeof buildRoiRequest>, { success: true }>["data"];

export function restoreAssumptions(detail: RoiDetail) {
  const assumptions = emptyAssumptions();
  const provenance = detail.snapshot.provenanceJson;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance))
    return assumptions;
  const inputs = (provenance as { assumptionInputs?: unknown }).assumptionInputs;
  if (!Array.isArray(inputs)) return assumptions;
  for (const input of inputs) {
    if (!input || typeof input !== "object" || Array.isArray(input)) continue;
    const value = input as { code?: unknown; status?: unknown; value?: unknown };
    const field = roiAssumptionFields.find(({ code }) => code === value.code);
    if (!field) continue;
    assumptions[field.code] =
      value.status === "unknown"
        ? { unknown: true, value: "" }
        : typeof value.value === "number"
          ? { unknown: false, value: String(value.value) }
          : assumptions[field.code];
  }
  return assumptions;
}

export function RoiAssumptionsForm({
  companyId,
  opportunityId,
  initialRoiId,
}: {
  companyId: string;
  opportunityId: string;
  initialRoiId?: string;
}) {
  const [audit, setAudit] = useState<AssistedAuditReadModel | null>(null);
  const [roi, setRoi] = useState<RoiDetail | null>(null);
  const [currency, setCurrency] = useState("");
  const [assumptions, setAssumptions] = useState(emptyAssumptions);
  const [errors, setErrors] = useState<Partial<Record<AssumptionCode | "currency", string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lock = useRef(createActionLock());

  useEffect(() => {
    let active = true;
    void loadAudit(companyId)
      .then(async (model) => {
        const automation = artifact(model, "AUTOMATION_OPPORTUNITIES");
        if (automation?.id !== opportunityId)
          throw new Error("This ROI source is not part of the current audit.");
        const currentRoi = artifact(model, "ROI");
        if (initialRoiId && !currentRoi)
          throw new Error("The requested ROI draft is not part of the current audit.");
        const detail = currentRoi ? await loadRoi(currentRoi.id) : null;
        return { model, detail };
      })
      .then(({ model, detail }) => {
        if (!active) return;
        setAudit(model);
        if (detail) applyDetail(detail, setRoi, setCurrency, setAssumptions);
      })
      .catch((caught: unknown) => {
        if (active) setMessage(safeMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, opportunityId, initialRoiId]);

  const editable = canEditRoi(audit, roi);
  const unknown = roiAssumptionFields.filter(({ code }) => assumptions[code].unknown);
  const next = audit ? presentNextAction(audit, companyId) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || !lock.current.acquire()) return;
    const result = buildRoiRequest(currency.toUpperCase(), assumptions);
    if (!result.success) {
      setErrors(result.errors);
      lock.current.release();
      return;
    }
    setErrors({});
    setMessage(null);
    setConflict(false);
    setSaving(true);
    try {
      const { model, detail } = await saveAndRefreshRoi({
        companyId,
        opportunityId,
        roi,
        request: result.data,
      });
      setAudit(model);
      applyDetail(detail, setRoi, setCurrency, setAssumptions);
      setMessage(
        unknown.length
          ? "ROI estimate incomplete. Some assumptions still need to be confirmed before AutomateX can calculate and publish the complete financial ROI."
          : "Assumptions saved. Continue with the next audit action when you are ready.",
      );
    } catch (caught) {
      const failure = caught as ApiFailure;
      if (failure.status === 409 || failure.code === "ROI_CONFLICT") {
        setConflict(true);
        setMessage(
          "These ROI assumptions were updated elsewhere. Reload the latest version before continuing.",
        );
      } else setMessage(safeMessage(caught));
    } finally {
      lock.current.release();
      setSaving(false);
    }
  }

  async function reload() {
    setLoading(true);
    setConflict(false);
    setMessage(null);
    try {
      const model = await loadAudit(companyId);
      const current = artifact(model, "ROI");
      const detail = current ? await loadRoi(current.id) : null;
      setAudit(model);
      if (detail) applyDetail(detail, setRoi, setCurrency, setAssumptions);
    } catch (caught) {
      setMessage(safeMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  if (loading)
    return (
      <main className="mx-auto max-w-5xl p-6" role="status">
        Loading ROI assumptions…
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">Automation Audit · ROI</p>
        <h1 className="text-3xl font-semibold">Your ROI assumptions</h1>
        <p className="text-muted-foreground max-w-3xl">
          AutomateX calculations are estimates based on the assumptions you provide. They are not
          guaranteed savings.
        </p>
      </header>

      {message && (
        <div role={conflict ? "alert" : "status"} className="flex gap-3 rounded-lg border p-4">
          {conflict ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <p>{message}</p>
        </div>
      )}

      {conflict && (
        <Button type="button" variant="outline" onClick={() => void reload()}>
          Reload latest version
        </Button>
      )}

      <form onSubmit={(event) => void submit(event)} className="space-y-6" aria-busy={saving}>
        <Card>
          <CardHeader>
            <CardTitle>Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <label htmlFor="currency" className="mb-2 block font-medium">
              Currency code
            </label>
            <Input
              id="currency"
              value={currency}
              maxLength={3}
              placeholder="EUR"
              disabled={!editable || saving}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              aria-invalid={Boolean(errors.currency)}
              aria-describedby="currency-help currency-error"
            />
            <p id="currency-help" className="text-muted-foreground mt-2 text-sm">
              Use the three-letter currency for these assumptions.
            </p>
            {errors.currency && (
              <p id="currency-error" className="mt-1 text-sm text-red-700">
                {errors.currency}
              </p>
            )}
          </CardContent>
        </Card>

        {(["Time and work", "Costs", "Automation"] as const).map((group) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{group}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              {roiAssumptionFields
                .filter((field) => field.group === group)
                .map((field) => (
                  <AssumptionInput
                    key={field.code}
                    field={field}
                    state={assumptions[field.code]}
                    error={errors[field.code]}
                    disabled={!editable || saving}
                    onChange={(state) =>
                      setAssumptions((current) => ({ ...current, [field.code]: state }))
                    }
                  />
                ))}
            </CardContent>
          </Card>
        ))}

        {unknown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ROI estimate incomplete</CardTitle>
            </CardHeader>
            <CardContent>
              <p>These assumptions are still unknown:</p>
              <ul className="mt-2 list-disc pl-5">
                {unknown.map((field) => (
                  <li key={field.code}>{field.label}</li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-sm">
                Unavailable calculations are not shown as zero.
              </p>
            </CardContent>
          </Card>
        )}

        {!editable && (
          <p role="status" className="rounded-lg border p-4">
            You have read-only access to these ROI assumptions.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {editable && (
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : roi ? "Save revised assumptions" : "Calculate ROI draft"}
            </Button>
          )}
          <Link
            href={`/companies/${companyId}/automation-audit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {next?.label ?? "Return to audit"}
          </Link>
        </div>
      </form>
    </main>
  );
}

export function canEditRoi(model: AssistedAuditReadModel | null, roi: RoiDetail | null) {
  const stage = model?.stages.find((candidate) => candidate.stage === "ROI");
  return Boolean(stage?.availableActions.length && (!roi || roi.snapshot.status === "draft"));
}

function AssumptionInput({
  field,
  state,
  error,
  disabled,
  onChange,
}: {
  field: (typeof roiAssumptionFields)[number];
  state: AssumptionState;
  error?: string;
  disabled: boolean;
  onChange: (state: AssumptionState) => void;
}) {
  const id = `assumption-${field.code}`;
  return (
    <fieldset className="space-y-2">
      <label htmlFor={id} className="font-medium">
        {field.label}
      </label>
      <Input
        id={id}
        type="number"
        min="0"
        step="any"
        value={state.value}
        disabled={disabled || state.unknown}
        onChange={(event) => onChange({ unknown: false, value: event.target.value })}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help ${id}-error`}
      />
      <p id={`${id}-help`} className="text-muted-foreground text-sm">
        {field.help}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.unknown}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              unknown: event.target.checked,
              value: event.target.checked ? "" : state.value,
            })
          }
        />
        I don&apos;t know yet
      </label>
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

type ApiFailure = Error & { status?: number; code?: string };
async function loadAudit(companyId: string) {
  return fetchData<AssistedAuditReadModel>(`/api/companies/${companyId}/automation-audit`);
}
async function loadRoi(id: string) {
  return fetchData<RoiDetail>(`/api/roi/${id}`);
}
export async function saveRoiAssumptions(
  {
    opportunityId,
    roi,
    request,
  }: {
    opportunityId: string;
    roi: RoiDetail | null;
    request: RoiRequestData;
  },
  fetcher: typeof fetch = fetch,
) {
  const url = roi
    ? `/api/roi/${roi.snapshot.id}/revise`
    : `/api/automation-opportunities/${opportunityId}/roi`;
  const body = roi ? { ...request, lockVersion: roi.snapshot.lockVersion } : request;
  return fetchData<{ id: string }>(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    fetcher,
  );
}
export async function saveAndRefreshRoi(
  input: {
    companyId: string;
    opportunityId: string;
    roi: RoiDetail | null;
    request: RoiRequestData;
  },
  fetcher: typeof fetch = fetch,
) {
  const saved = await saveRoiAssumptions(input, fetcher);
  const model = await fetchData<AssistedAuditReadModel>(
    `/api/companies/${input.companyId}/automation-audit`,
    undefined,
    fetcher,
  );
  const current = artifact(model, "ROI");
  const detail = await fetchData<RoiDetail>(
    `/api/roi/${current?.id ?? saved.id}`,
    undefined,
    fetcher,
  );
  return { model, detail };
}
async function fetchData<T>(
  url: string,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(url, init);
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok || !payload?.data) {
    const error = new Error(
      payload?.error?.message ?? "This ROI request could not be completed.",
    ) as ApiFailure;
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload.data;
}
function artifact(model: AssistedAuditReadModel, stage: "AUTOMATION_OPPORTUNITIES" | "ROI") {
  return model.stages.find((candidate) => candidate.stage === stage)?.artifact ?? null;
}
function applyDetail(
  detail: RoiDetail,
  setRoi: (value: RoiDetail) => void,
  setCurrency: (value: string) => void,
  setAssumptions: (value: AssumptionFormState) => void,
) {
  setRoi(detail);
  setCurrency(detail.snapshot.currency);
  setAssumptions(restoreAssumptions(detail));
}
function safeMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : "This ROI request could not be completed.";
}
