"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
const steps = ["company", "business", "organization", "software", "processes", "review"] as const;
const labels = {
  company: "Entreprise",
  business: "Activité",
  organization: "Organisation",
  software: "Outils",
  processes: "Processus",
  review: "Révision",
};
type Step = (typeof steps)[number];
type Session = {
  id: string;
  lockVersion: number;
  currentStep: Step;
  status: string;
  answers: { step: Step; valueJson: unknown }[];
};
type Draft = Record<string, string>;
export function DiscoveryWizard({ companyId }: { companyId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<Step>("company");
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const index = steps.indexOf(step);
  useEffect(() => {
    fetch(`/api/companies/${companyId}/discovery`)
      .then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("Impossible de charger la découverte");
        return ((await r.json()) as { data: Session }).data;
      })
      .then((s) => {
        if (s) {
          setSession(s);
          setStep(s.currentStep);
          setDraft(readAnswers(s));
        } else {
          setMessage("Aucune découverte active. Démarrez une nouvelle Discovery si nécessaire.");
        }
        setBusy(false);
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : "Erreur");
        setBusy(false);
      });
  }, [companyId]);
  const progress = useMemo(() => Math.round(((index + 1) / steps.length) * 100), [index]);
  async function save(next?: Step) {
    if (!session) return;
    setBusy(true);
    setMessage("Enregistrement…");
    const response = await fetch(`/api/discovery-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockVersion: session.lockVersion, payload: payload(step, draft) }),
    });
    if (!response.ok) {
      setMessage(
        response.status === 409
          ? "Cette session a été modifiée ailleurs. Rechargez la page."
          : "Vérifiez les informations saisies.",
      );
      setBusy(false);
      return;
    }
    const value = ((await response.json()) as { data: Session }).data;
    setSession(value);
    if (next) setStep(next);
    setMessage("Enregistré");
    setBusy(false);
  }
  async function validate() {
    await save();
    if (!session) return;
    const response = await fetch(`/api/discovery-sessions/${session.id}/validate`, {
      method: "POST",
    });
    setMessage(
      response.ok
        ? "Discovery validée et prête pour les futurs moteurs."
        : "Complétez toutes les étapes avant validation.",
    );
  }
  async function startDiscovery() {
    setBusy(true);
    setMessage("Démarrage…");
    fetch(`/api/companies/${companyId}/discovery`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Impossible de démarrer la découverte");
        return ((await r.json()) as { data: Session }).data;
      })
      .then((s) => {
        setSession(s);
        setStep(s.currentStep);
        setDraft(readAnswers(s));
        setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Erreur"))
      .finally(() => setBusy(false));
  }
  if (busy && !session) return <WizardSkeleton />;
  if (!session)
    return (
      <div role="status" className="opt-empty mx-auto max-w-4xl space-y-4 p-6">
        <p>{message || "Aucune découverte active pour cette entreprise."}</p>
        <Button className="opt-primary" disabled={busy} onClick={startDiscovery}>
          Démarrer la découverte
        </Button>
      </div>
    );
  const readOnly = session.status === "validated";
  return (
    <div className="opt-container space-y-6">
      <header className="opt-hero">
        <p className="opt-eyebrow">Découverte guidée · {index + 1}/6</p>
        <h1 className="opt-title mt-3">Comprendre votre entreprise</h1>
        <p className="opt-copy mt-4 max-w-3xl">
          Une section à la fois pour comprendre votre activité, vos outils et les processus à
          améliorer. Vous pouvez sauvegarder et reprendre plus tard.
        </p>
      </header>
      <nav aria-label="Étapes de découverte" className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {steps.map((s, i) => (
          <button
            key={s}
            disabled={i > index + 1}
            onClick={() => setStep(s)}
            className={`rounded-2xl border p-3 text-left text-xs transition ${
              s === step
                ? "border-blue-400/50 bg-blue-500/15 text-blue-100"
                : "border-white/10 bg-slate-900/70 text-slate-400 hover:bg-white/5"
            }`}
          >
            <span className="mb-2 grid size-7 place-items-center rounded-full bg-white/10 font-bold">
              {i + 1}
            </span>
            {labels[s]}
          </button>
        ))}
      </nav>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <Card className="border-white/10 bg-slate-900/80 text-slate-50 shadow-2xl shadow-slate-950/20">
        <CardHeader className="border-b border-white/10">
          <p className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
            Question principale
          </p>
          <CardTitle>{labels[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          <StepFields step={step} draft={draft} setDraft={setDraft} />
        </CardContent>
      </Card>
      <footer className="flex items-center justify-between">
        <span aria-live="polite" className="text-sm text-neutral-500">
          {message}
        </span>
        <div className="flex gap-3">
          {index > 0 && (
            <Button
              className="opt-secondary"
              variant="outline"
              onClick={() => setStep(steps[index - 1])}
            >
              Précédent
            </Button>
          )}
          {index < steps.length - 1 ? (
            <Button
              className="opt-primary"
              disabled={busy || readOnly}
              onClick={() => save(steps[index + 1])}
            >
              Enregistrer et continuer
            </Button>
          ) : (
            <Button className="opt-primary" disabled={busy || readOnly} onClick={validate}>
              Valider et continuer vers l’interview
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
function Field({
  name,
  label,
  draft,
  setDraft,
  type = "text",
}: {
  name: string;
  label: string;
  draft: Draft;
  setDraft: (v: Draft) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-200" htmlFor={name}>
        {label}
      </Label>
      <Input
        id={name}
        type={type}
        value={draft[name] ?? ""}
        onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
        className="opt-input border-white/10 bg-slate-950/60"
      />
    </div>
  );
}
function SelectField({
  name,
  label,
  draft,
  setDraft,
  options,
  fallback,
}: {
  name: string;
  label: string;
  draft: Draft;
  setDraft: (v: Draft) => void;
  options: { value: string; label: string }[];
  fallback: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-200" htmlFor={name}>
        {label}
      </Label>
      <select
        id={name}
        value={draft[name] ?? fallback}
        onChange={(event) => setDraft({ ...draft, [name]: event.target.value })}
        className="opt-select h-11 px-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function StepFields({
  step,
  draft,
  setDraft,
}: {
  step: Step;
  draft: Draft;
  setDraft: (v: Draft) => void;
}) {
  if (step === "company")
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <Field name="industry" label="Secteur" draft={draft} setDraft={setDraft} />
        <Field name="countryCode" label="Pays (ISO, ex. FR)" draft={draft} setDraft={setDraft} />
        <Field
          name="employeeCount"
          label="Effectif"
          type="number"
          draft={draft}
          setDraft={setDraft}
        />
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Activité de l’entreprise</Label>
          <Textarea
            id="description"
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
      </div>
    );
  if (step === "business")
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <Field name="businessModel" label="Business model" draft={draft} setDraft={setDraft} />
        <Field name="growthStage" label="Phase de croissance" draft={draft} setDraft={setDraft} />
        <Field
          name="revenueAmount"
          label="Chiffre d’affaires"
          type="number"
          draft={draft}
          setDraft={setDraft}
        />
        <Field name="revenueCurrency" label="Devise" draft={draft} setDraft={setDraft} />
        <Field name="revenueYear" label="Année" type="number" draft={draft} setDraft={setDraft} />
        <Field
          name="offerings"
          label="Produits et services (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
        <SelectField
          name="offeringType"
          label="Type des offres saisies"
          draft={draft}
          setDraft={setDraft}
          fallback="service"
          options={[
            { value: "service", label: "Services" },
            { value: "product", label: "Produits" },
          ]}
        />
        <Field
          name="objectives"
          label="Objectifs (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
        <SelectField
          name="objectivePriority"
          label="Priorité des objectifs"
          draft={draft}
          setDraft={setDraft}
          fallback="3"
          options={[1, 2, 3, 4, 5].map((value) => ({
            value: String(value),
            label: `${value} / 5`,
          }))}
        />
        <Field
          name="challenges"
          label="Challenges (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
        <SelectField
          name="challengeSeverity"
          label="Sévérité des challenges"
          draft={draft}
          setDraft={setDraft}
          fallback="3"
          options={[1, 2, 3, 4, 5].map((value) => ({
            value: String(value),
            label: `${value} / 5`,
          }))}
        />
      </div>
    );
  if (step === "organization")
    return (
      <div className="space-y-5">
        <Field
          name="departments"
          label="Départements (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
        <Field
          name="roles"
          label="Rôles clés (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
      </div>
    );
  if (step === "software")
    return (
      <Field
        name="software"
        label="Logiciels utilisés (séparés par virgule)"
        draft={draft}
        setDraft={setDraft}
      />
    );
  if (step === "processes")
    return (
      <div className="space-y-5">
        <SelectField
          name="processCategory"
          label="Catégorie des processus saisis"
          draft={draft}
          setDraft={setDraft}
          fallback="operations"
          options={[
            ["sales", "Commercial"],
            ["finance", "Finance"],
            ["hr", "Ressources humaines"],
            ["marketing", "Marketing"],
            ["it", "IT"],
            ["administration", "Administration"],
            ["operations", "Opérations"],
            ["support", "Support client"],
          ].map(([value, label]) => ({ value, label }))}
        />
        <Field
          name="processes"
          label="Processus clés (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
        <Field
          name="painPoints"
          label="Irritants observés (séparés par virgule)"
          draft={draft}
          setDraft={setDraft}
        />
      </div>
    );
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Prêt pour validation</h3>
      <p className="text-sm text-slate-300">
        Vérifiez le résumé avant de continuer. Les informations seront utilisées pour préparer les
        prochaines questions et l’analyse de votre audit.
      </p>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={draft.confirmed === "true"}
          onChange={(e) => setDraft({ ...draft, confirmed: String(e.target.checked) })}
        />
        Je confirme que ces informations sont suffisamment justes pour continuer.
      </label>
    </div>
  );
}
function split(v: string | undefined) {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function payload(step: Step, d: Draft) {
  if (step === "company")
    return {
      step,
      industry: d.industry,
      countryCode: d.countryCode,
      employeeCount: Number(d.employeeCount),
      description: d.description || null,
    };
  if (step === "business")
    return {
      step,
      businessModel: d.businessModel,
      growthStage: d.growthStage,
      revenueAmount: d.revenueAmount ? Number(d.revenueAmount) : null,
      revenueCurrency: d.revenueCurrency || null,
      revenueYear: d.revenueYear ? Number(d.revenueYear) : null,
      offerings: split(d.offerings).map((name) => ({
        type: d.offeringType === "product" ? "product" : "service",
        name,
        description: null,
      })),
      objectives: split(d.objectives).map((title) => ({
        title,
        description: null,
        priority: Number(d.objectivePriority ?? 3),
        targetDate: null,
      })),
      challenges: split(d.challenges).map((title) => ({
        title,
        description: null,
        severity: Number(d.challengeSeverity ?? 3),
      })),
    };
  if (step === "organization") {
    const departments = split(d.departments).map((name, i) => ({
      clientId: String(i),
      name,
      description: null,
      headcount: null,
    }));
    return {
      step,
      departments,
      roles: split(d.roles).map((title) => ({
        departmentClientId: null,
        title,
        headcount: 1,
        responsibilities: [],
      })),
    };
  }
  if (step === "software")
    return {
      step,
      items: split(d.software).map((name) => ({
        name,
        purpose: null,
        criticality: null,
        usersCount: null,
      })),
    };
  if (step === "processes")
    return {
      step,
      items: split(d.processes).map((name) => ({
        name,
        categoryCode: d.processCategory ?? "operations",
        description: null,
        frequency: null,
        volume: null,
        manualHoursMonth: null,
        painPoints: split(d.painPoints),
      })),
    };
  return { step, confirmed: d.confirmed === "true" };
}
function readAnswers(session: Session) {
  const draft: Draft = {};
  for (const answer of session.answers) {
    const value = answer.valueJson as Record<string, unknown>;
    for (const [key, v] of Object.entries(value)) {
      if (key === "step") continue;
      if (Array.isArray(v))
        draft[key] = v
          .map((x) =>
            typeof x === "object" && x !== null && "name" in x
              ? String((x as { name: unknown }).name)
              : typeof x === "object" && x !== null && "title" in x
                ? String((x as { title: unknown }).title)
                : String(x),
          )
          .join(", ");
      else if (v !== null) draft[key] = String(v);
    }
  }
  return draft;
}
function WizardSkeleton() {
  return (
    <div role="status" aria-label="Chargement de Discovery" className="mx-auto max-w-4xl space-y-4">
      {[1, 2, 3].map((x) => (
        <div key={x} className="h-28 animate-pulse rounded-3xl bg-slate-900/80" />
      ))}
    </div>
  );
}
