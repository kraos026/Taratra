"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Circle,
  CircleGauge,
  FileText,
  Lightbulb,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";
import {
  buildCustomerJourney,
  customerJourneyRoutes,
  customerStageLabel,
  customerStatusLabel,
} from "@/modules/assisted-audit/presentation/canonical-journey";

type Company = {
  id: string;
  name: string;
  sectorId: string | null;
};

type PagePayload<T> = { items: T[]; total: number };

async function loadLatestCompany(): Promise<Company | null> {
  const response = await fetch("/api/companies?page=1&pageSize=1&sortBy=updatedAt&sortOrder=desc", {
    cache: "no-store",
  });
  const payload = (await response.json()) as { data?: PagePayload<Company> };
  if (!response.ok || !payload.data) {
    throw new Error("Impossible de charger le contexte entreprise.");
  }
  return payload.data.items[0] ?? null;
}

async function loadAuditModel(companyId: string): Promise<AssistedAuditReadModel | null> {
  const response = await fetch(`/api/companies/${companyId}/automation-audit`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  const payload = (await response.json()) as { data?: AssistedAuditReadModel };
  if (!response.ok || !payload.data) {
    throw new Error("Impossible de charger l’avancement de l’audit.");
  }
  return payload.data;
}

export function FeatureDirectoryPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [company, setCompany] = useState<Company | null>();
  const [audit, setAudit] = useState<AssistedAuditReadModel | null>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void loadLatestCompany()
      .then((nextCompany) => {
        if (!active) return;
        setCompany(nextCompany);
        setError(undefined);
        if (!nextCompany) {
          setAudit(null);
          return null;
        }
        return loadAuditModel(nextCompany.id);
      })
      .then((nextAudit) => {
        if (active && nextAudit !== undefined) setAudit(nextAudit);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Impossible de charger cette page.");
      });
    return () => {
      active = false;
    };
  }, []);

  const routes = company ? customerJourneyRoutes(company.id, audit) : null;
  const companyAuditHref = routes?.audit ?? "/companies";
  const companyResultsHref = routes?.results ?? "/companies";
  const companyDecisionHref = company
    ? `/companies/${company.id}/automation-audit/decision-center`
    : "/companies";

  return (
    <main className="opt-page px-5 py-8 sm:px-8">
      <div className="opt-container space-y-6">
        <section className="opt-hero">
          <p className="opt-eyebrow">Optivos</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <h1 className="opt-title">{title}</h1>
              <p className="opt-copy mt-4 max-w-3xl">{description}</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link className="opt-secondary" href="/">
                Tableau de bord
              </Link>
              <Link className="opt-primary" href={companyAuditHref}>
                Continuer l’audit <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <section className="opt-empty" role="alert">
            {error}
          </section>
        )}

        {company === undefined && !error && (
          <section className="opt-empty" role="status">
            Chargement du contexte entreprise…
          </section>
        )}

        {company === null && !error && (
          <section className="opt-card p-6 sm:p-8">
            <Building2 className="text-blue-300" size={34} />
            <h2 className="mt-4 text-2xl font-bold text-white">Ajoutez votre entreprise</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Le plan d’action se construit à partir d’un audit publié. Créez ou ouvrez votre
              entreprise pour lancer le parcours Optivos.
            </p>
            <Link className="opt-primary mt-5" href="/companies">
              Ouvrir Mon entreprise <ArrowRight size={17} />
            </Link>
          </section>
        )}

        {company && (
          <section className="grid gap-4 lg:grid-cols-3">
            <article className="opt-card p-6 lg:col-span-2">
              <p className="opt-eyebrow">Contexte actif</p>
              <h2 className="mt-3 text-2xl font-bold text-white">Entreprise active</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Secteur : {company.sectorId ?? "à préciser"}. Ouvrez l’audit pour consulter les
                opportunités, l’impact, les risques et les prochaines actions liées à cette
                entreprise.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="opt-primary" href={companyAuditHref}>
                  Ouvrir l’audit <CircleGauge size={17} />
                </Link>
                <Link className="opt-secondary" href={companyDecisionHref}>
                  Decision Center <Target size={17} />
                </Link>
                <Link className="opt-secondary" href={companyResultsHref}>
                  Résultats <FileText size={17} />
                </Link>
              </div>
            </article>
            <article className="opt-card p-6">
              <p className="opt-eyebrow">État moteur</p>
              <h2 className="mt-3 text-xl font-bold text-white">
                {audit ? customerStageLabel(audit.currentStage) : "Audit à ouvrir"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {audit
                  ? "Les écrans suivent l’état publié par le moteur : pas de plan, ROI ou résultat final avant les étapes nécessaires."
                  : "Le plan d’action apparaît après les premières étapes d’audit."}
              </p>
            </article>
          </section>
        )}

        {company && audit && <EngineProgress audit={audit} />}
      </div>
    </main>
  );
}

function EngineProgress({ audit }: { readonly audit: AssistedAuditReadModel }) {
  const steps = buildCustomerJourney(audit);
  return (
    <section className="opt-card p-6 sm:p-8" aria-labelledby="engine-progress-title">
      <p className="opt-eyebrow">Parcours moteur</p>
      <h2 id="engine-progress-title" className="mt-3 text-2xl font-bold text-white">
        De la compréhension aux résultats
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
        Chaque écran correspond à une étape publiée du moteur Optivos. Les estimations restent
        prudentes lorsque les preuves sont incomplètes.
      </p>
      <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`rounded-3xl border p-4 ${
              step.current ? "border-blue-300/50 bg-blue-500/10" : "border-white/10 bg-slate-950/45"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-white/5 text-blue-200">
                {journeyIcon(step.key)}
              </span>
              <span className="text-xs font-bold text-slate-500">0{index + 1}</span>
            </div>
            <h3 className="mt-4 font-bold text-white">{step.label}</h3>
            <p className="mt-2 text-sm leading-5 text-slate-400">{step.description}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
              {step.status === "COMPLETED" ? (
                <CheckCircle2 className="text-emerald-300" size={16} />
              ) : (
                <Circle className={step.current ? "text-blue-300" : "text-slate-500"} size={16} />
              )}
              {customerStatusLabel(step.status)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function journeyIcon(key: ReturnType<typeof buildCustomerJourney>[number]["key"]) {
  if (key === "UNDERSTANDING") return <ShieldCheck size={18} />;
  if (key === "PROCESS" || key === "ROI") return <CircleGauge size={18} />;
  if (key === "ANALYSIS") return <BarChart3 size={18} />;
  if (key === "AUTOMATION") return <Lightbulb size={18} />;
  if (key === "PLAN") return <Target size={18} />;
  return <FileText size={18} />;
}
