"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { customerDecisionText } from "@/modules/company-intake/presentation/customer-decision-copy";

type AssumptionState = { unknown: boolean; value: string };
type AssumptionFormState = Record<AssumptionCode, AssumptionState>;
type FormErrors = Partial<Record<AssumptionCode | "currency", string>>;
export type ActivityFormState = {
  opportunityId: string;
  title: string;
  assumptions: AssumptionFormState;
};
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
    label: "Jours travaillés par an",
    help: "Nombre de jours effectivement travaillés sur une année habituelle.",
    group: "Time and work",
  },
  {
    code: "working_hours",
    label: "Heures travaillées par jour",
    help: "Durée habituelle d’une journée de travail, en heures.",
    group: "Time and work",
  },
  {
    code: "monthly_frequency",
    label: "Opérations par mois",
    help: "Nombre de fois où ce processus est réalisé dans un mois habituel.",
    group: "Time and work",
  },
  {
    code: "annual_frequency",
    label: "Opérations par an",
    help: "Nombre de fois où ce processus est réalisé dans une année habituelle. Vérifiez sa cohérence avec le volume mensuel.",
    group: "Time and work",
  },
  {
    code: "hourly_cost",
    label: "Coût horaire du personnel",
    help: "Coût estimé d’une heure de travail, charges comprises, dans la devise choisie.",
    group: "Costs",
  },
  {
    code: "implementation_cost",
    label: "Coût de mise en œuvre",
    help: "Dépense initiale estimée pour mettre en place l’automatisation, dans la devise choisie.",
    group: "Costs",
  },
  {
    code: "maintenance_cost",
    label: "Coût annuel de maintenance",
    help: "Dépense récurrente estimée pour la maintenance sur une année.",
    group: "Costs",
  },
  {
    code: "training_cost",
    label: "Coût de formation",
    help: "Dépense initiale estimée pour former les personnes concernées.",
    group: "Costs",
  },
  {
    code: "infrastructure_cost",
    label: "Coût d’infrastructure",
    help: "Dépense initiale estimée pour les systèmes ou l’infrastructure nécessaires.",
    group: "Costs",
  },
  {
    code: "error_cost",
    label: "Coût par erreur",
    help: "Coût estimé d’une erreur évitable dans ce processus, dans la devise choisie.",
    group: "Costs",
  },
  {
    code: "hours_saved_per_occurrence",
    label: "Heures économisables par opération",
    help: "Temps qui pourrait être économisé à chaque opération, en heures. Ce n’est pas la durée totale du processus ni un gain garanti. Si vous ne le savez pas, indiquez-le.",
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
  if (!/^[A-Z]{3}$/.test(currency))
    errors.currency = "Saisissez un code de devise à trois lettres.";
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
        errors[code] = "Saisissez un nombre positif ou nul, ou cochez « Je ne sais pas encore ».";
      else payload[code] = { status: "known", value };
    }
  }
  return Object.keys(errors).length
    ? { success: false as const, errors }
    : { success: true as const, data: { currency, assumptions: payload } };
}
type RoiRequestData = Extract<ReturnType<typeof buildRoiRequest>, { success: true }>["data"] & {
  activities?: {
    opportunityId: string;
    assumptions: Extract<
      ReturnType<typeof buildRoiRequest>,
      { success: true }
    >["data"]["assumptions"];
  }[];
};

export function buildActivityRoiRequest(currency: string, activities: ActivityFormState[]) {
  const activityErrors: Record<string, FormErrors> = {};
  const payload: NonNullable<RoiRequestData["activities"]> = [];
  const errors: FormErrors = {};
  if (
    !activities.length ||
    new Set(activities.map((row) => row.opportunityId)).size !== activities.length
  )
    throw new Error("La liste des activités de cet audit est indisponible ou incohérente.");
  for (const activity of activities) {
    const result = buildRoiRequest(currency, activity.assumptions);
    if (!result.success) {
      activityErrors[activity.opportunityId] = result.errors;
      if (result.errors.currency) errors.currency = result.errors.currency;
    } else
      payload.push({ opportunityId: activity.opportunityId, assumptions: result.data.assumptions });
  }
  if (Object.keys(activityErrors).length)
    return { success: false as const, errors, activityErrors };
  // The legacy API field remains explicit UNKNOWN; activity mode never inherits these inputs.
  const unknown = Object.fromEntries(
    roiAssumptionFields.map(({ code }) => [code, { status: "unknown" as const }]),
  ) as RoiRequestData["assumptions"];
  return { success: true as const, data: { currency, assumptions: unknown, activities: payload } };
}

export function restoreActivityForms(
  detail: RoiDetail | null,
  sources: { id: string; title: string }[],
): ActivityFormState[] | null {
  const blank = () =>
    sources.map((row) => ({
      opportunityId: row.id,
      title: customerDecisionText(row.title),
      assumptions: emptyAssumptions(),
    }));
  if (!detail) return blank();
  const provenance = detail.snapshot.provenanceJson;
  if (!provenance || typeof provenance !== "object" || !("activityInputs" in provenance))
    return null;
  const rows = provenance.activityInputs;
  if (!Array.isArray(rows) || rows.length !== sources.length)
    throw new Error(
      "Les hypothèses par activité sont incomplètes. Aucun repli vers les valeurs communes n’a été effectué.",
    );
  const forms = blank();
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.opportunityId !== "string" ||
      seen.has(row.opportunityId)
    )
      throw new Error("Les hypothèses par activité sont incohérentes.");
    seen.add(row.opportunityId);
    const form = forms.find((item) => item.opportunityId === row.opportunityId);
    if (
      !form ||
      !Array.isArray(row.assumptionInputs) ||
      row.assumptionInputs.length !== roiAssumptionFields.length
    )
      throw new Error("Les hypothèses par activité ne correspondent pas à cet audit.");
    const codes = new Set<string>();
    for (const input of row.assumptionInputs) {
      const field = roiAssumptionFields.find(({ code }) => code === input?.code);
      if (!field || codes.has(field.code))
        throw new Error("Une hypothèse par activité est invalide.");
      codes.add(field.code);
      if (input.status === "unknown" && !("value" in input))
        form.assumptions[field.code] = { unknown: true, value: "" };
      else if (
        input.status === "known" &&
        typeof input.value === "number" &&
        Number.isFinite(input.value) &&
        input.value >= 0
      )
        form.assumptions[field.code] = { unknown: false, value: String(input.value) };
      else throw new Error("Une hypothèse par activité est invalide.");
    }
  }
  return forms;
}

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
  const [activities, setActivities] = useState<ActivityFormState[]>([]);
  const [activityMode, setActivityMode] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(0);
  const [activityErrors, setActivityErrors] = useState<Record<string, FormErrors>>({});
  const [errors, setErrors] = useState<Partial<Record<AssumptionCode | "currency", string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lock = useRef(createActionLock());

  const restoreDetail = useCallback(
    (detail: RoiDetail | null, sources: { id: string; title: string }[]) => {
      const restored = restoreActivityForms(detail, sources);
      setActivities(
        restored ??
          sources.map((row) => ({
            opportunityId: row.id,
            title: customerDecisionText(row.title),
            assumptions: emptyAssumptions(),
          })),
      );
      setActivityMode(restored !== null);
      setSelectedActivity(0);
      if (detail) applyDetail(detail, setRoi, setCurrency, setAssumptions);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void loadAudit(companyId)
      .then(async (model) => {
        const automation = artifact(model, "AUTOMATION_OPPORTUNITIES");
        if (automation?.id !== opportunityId)
          throw new Error("Cette source de calcul ne fait pas partie de l’audit actuel.");
        const currentRoi = artifact(model, "ROI");
        if (initialRoiId && !currentRoi)
          throw new Error("L’estimation demandée ne fait pas partie de l’audit actuel.");
        const [detail, source] = await Promise.all([
          currentRoi ? loadRoi(currentRoi.id) : Promise.resolve(null),
          fetchData<{
            snapshot: { id: string; companyId: string };
            opportunities: { id: string; title: string }[];
          }>(`/api/automation-opportunities/${opportunityId}`),
        ]);
        if (
          source.snapshot.id !== opportunityId ||
          source.snapshot.companyId !== companyId ||
          !source.opportunities.length ||
          new Set(source.opportunities.map((row) => row.id)).size !== source.opportunities.length
        )
          throw new Error("La liste des activités ne correspond pas à cet audit.");
        return { model, detail, sources: source.opportunities };
      })
      .then(({ model, detail, sources }) => {
        if (!active) return;
        restoreDetail(detail, sources);
        setAudit(model);
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
  }, [companyId, opportunityId, initialRoiId, restoreDetail]);

  const editable = canEditRoi(audit, roi);
  const activeActivity = activities[selectedActivity];
  const currentAssumptions = activityMode
    ? (activeActivity?.assumptions ?? emptyAssumptions())
    : assumptions;
  const currentErrors = activityMode
    ? (activityErrors[activeActivity?.opportunityId ?? ""] ?? {})
    : errors;
  const unknown = roiAssumptionFields.filter(({ code }) => currentAssumptions[code].unknown);
  const hasUnknown = activityMode
    ? activities.some((row) => Object.values(row.assumptions).some((state) => state.unknown))
    : unknown.length > 0;
  const next = audit ? presentNextAction(audit, companyId) : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || !lock.current.acquire()) return;
    const result = activityMode
      ? buildActivityRoiRequest(currency.toUpperCase(), activities)
      : (() => {
          const common = buildRoiRequest(currency.toUpperCase(), assumptions);
          return common.success
            ? common
            : { ...common, activityErrors: {} as Record<string, FormErrors> };
        })();
    if (!result.success) {
      setErrors(result.errors);
      if (activityMode) {
        setActivityErrors(result.activityErrors);
        setSelectedActivity(
          activities.findIndex((row) => Boolean(result.activityErrors[row.opportunityId])),
        );
      }
      lock.current.release();
      return;
    }
    setErrors({});
    setActivityErrors({});
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
      restoreDetail(
        detail,
        activities.map((row) => ({ id: row.opportunityId, title: row.title })),
      );
      setAudit(model);
      setMessage(
        hasUnknown
          ? "Données complémentaires requises. Certaines hypothèses doivent rester visibles avant qu’Optivos puisse publier un ROI complet."
          : "Hypothèses enregistrées. Vous pouvez poursuivre l’audit ; les résultats restent des estimations, pas des gains garantis.",
      );
    } catch (caught) {
      const failure = caught as ApiFailure;
      if (failure.status === 409 || failure.code === "ROI_CONFLICT") {
        setConflict(true);
        setMessage(
          "Ces hypothèses ont été modifiées dans une autre session. Rechargez la dernière version avant de poursuivre.",
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
      if (detail)
        restoreDetail(
          detail,
          activities.map((row) => ({ id: row.opportunityId, title: row.title })),
        );
    } catch (caught) {
      setMessage(safeMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  if (loading)
    return (
      <main className="mx-auto max-w-5xl p-6" role="status">
        Chargement des hypothèses économiques…
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">Audit Optivos · ROI</p>
        <h1 className="text-3xl font-semibold">Estimer la rentabilité, sans inventer les gains</h1>
        <p className="text-muted-foreground max-w-3xl">
          Les calculs Optivos sont des estimations fondées sur les hypothèses et preuves que vous
          fournissez. Ils ne sont pas des gains garantis.
        </p>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Ne renseignez que des données documentées. Une valeur inconnue n’est pas zéro : cochez «
          Je ne sais pas encore » pour la conserver comme donnée manquante. Le temps total passé sur
          une opération n’est pas automatiquement du temps économisable.
        </p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
            Estimation chiffrée : disponible uniquement lorsque les données publiées le permettent.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            Estimation non disponible : des données ou des preuves complémentaires sont nécessaires.
          </p>
        </div>
      </header>

      {message && (
        <div role={conflict ? "alert" : "status"} className="flex gap-3 rounded-lg border p-4">
          {conflict ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <p>{message}</p>
        </div>
      )}

      {conflict && (
        <Button type="button" variant="outline" onClick={() => void reload()}>
          Recharger la dernière version
        </Button>
      )}

      <form onSubmit={(event) => void submit(event)} className="space-y-6" aria-busy={saving}>
        <Card>
          <CardHeader>
            <CardTitle>
              {activityMode
                ? "Une estimation propre à chaque activité"
                : "Hypothèses communes · estimation historique"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {activityMode
                ? "Renseignez uniquement les volumes, temps et coûts propres à l’activité choisie. Les montants ne sont pas copiés entre activités et ne doivent pas être additionnés sans vérifier les recouvrements."
                : "Cette estimation utilise le même jeu d’hypothèses pour plusieurs activités. Elle ne démontre pas des gains indépendants."}
            </p>
            {!activityMode && editable && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setActivityMode(true);
                  setSelectedActivity(0);
                  setErrors({});
                }}
              >
                Renseigner séparément chaque activité
              </Button>
            )}
            {activityMode && (
              <div className="flex flex-wrap gap-2" aria-label="Choisir une activité">
                {activities.map((row, index) => (
                  <Button
                    key={row.opportunityId}
                    type="button"
                    variant={selectedActivity === index ? "default" : "outline"}
                    aria-pressed={selectedActivity === index}
                    disabled={saving}
                    onClick={() => setSelectedActivity(index)}
                  >
                    {index + 1}. {row.title}
                    {activityErrors[row.opportunityId] ? " · à compléter" : ""}
                  </Button>
                ))}
              </div>
            )}
            {activityMode && activeActivity && (
              <p className="font-medium">
                Activité {selectedActivity + 1} sur {activities.length} · {activeActivity.title}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Devise de l’estimation</CardTitle>
          </CardHeader>
          <CardContent>
            <label htmlFor="currency" className="mb-2 block font-medium">
              Code de devise
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
              Utilisez un code de devise à trois lettres, par exemple EUR. Tous les coûts doivent
              être exprimés dans cette même devise.
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
              <CardTitle>
                {group === "Time and work"
                  ? "Volume et temps de travail"
                  : group === "Costs"
                    ? "Coûts à documenter"
                    : "Temps potentiellement économisable"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              {roiAssumptionFields
                .filter((field) => field.group === group)
                .map((field) => (
                  <AssumptionInput
                    key={field.code}
                    field={field}
                    state={currentAssumptions[field.code]}
                    error={currentErrors[field.code]}
                    disabled={!editable || saving}
                    onChange={(state) =>
                      activityMode
                        ? setActivities((current) =>
                            current.map((row, index) =>
                              index === selectedActivity
                                ? {
                                    ...row,
                                    assumptions: { ...row.assumptions, [field.code]: state },
                                  }
                                : row,
                            ),
                          )
                        : setAssumptions((current) => ({ ...current, [field.code]: state }))
                    }
                  />
                ))}
            </CardContent>
          </Card>
        ))}

        {unknown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Données complémentaires requises</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Ces hypothèses restent inconnues :</p>
              <ul className="mt-2 list-disc pl-5">
                {unknown.map((field) => (
                  <li key={field.code}>{field.label}</li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-sm">
                Les calculs indisponibles ne sont jamais affichés comme zéro.
              </p>
            </CardContent>
          </Card>
        )}

        {!editable && (
          <p role="status" className="rounded-lg border p-4">
            Ces hypothèses sont accessibles en lecture seule.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {editable && (
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {saving
                ? "Enregistrement…"
                : roi
                  ? "Enregistrer les hypothèses révisées"
                  : "Créer une estimation provisoire"}
            </Button>
          )}
          <Link
            href={`/companies/${companyId}/automation-audit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {next?.label ?? "Retour à l’audit"}
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
        Je ne sais pas encore
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
      payload?.error?.message ?? "Cette demande d’estimation n’a pas pu aboutir.",
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
  return caught instanceof Error
    ? caught.message
    : "Cette demande d’estimation n’a pas pu aboutir.";
}
