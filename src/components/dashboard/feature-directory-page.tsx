"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CircleGauge, FileText, Target } from "lucide-react";

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

export function FeatureDirectoryPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [company, setCompany] = useState<Company | null>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void loadLatestCompany()
      .then((nextCompany) => {
        if (!active) return;
        setCompany(nextCompany);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Impossible de charger cette page.");
      });
    return () => {
      active = false;
    };
  }, []);

  const companyAuditHref = company ? `/companies/${company.id}/automation-audit` : "/companies";
  const companyResultsHref = company
    ? `/companies/${company.id}/automation-audit/results`
    : "/companies";
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
              <p className="opt-eyebrow">Plan d’action</p>
              <h2 className="mt-3 text-xl font-bold text-white">Prioriser sans surpromettre</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Optivos distingue les automatisations prêtes, celles qui exigent une correction et
                celles qui demandent davantage de preuves.
              </p>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
