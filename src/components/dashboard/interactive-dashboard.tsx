"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CircleGauge, Clock3, Sparkles, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { ErrorState, LoadingState } from "@/components/app-shell/page-states";
import { readApiResponse } from "@/shared/presentation/api-client";
import { companyRoute, dashboardRoutes } from "./dashboard-navigation";

type Company = { id: string; name: string; sectorId: string | null; status: string };
type Audit = {
  id: string;
  status: string;
  progressPercentage: number;
  updatedAt: string;
  company: { id: string; name: string };
};
type PagePayload<T> = { items: T[]; total: number };

async function loadPage<T>(url: string) {
  return readApiResponse<PagePayload<T>>(
    await fetch(url, { cache: "no-store" }),
    "Impossible de charger le tableau de bord.",
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function InteractiveDashboard() {
  const [companies, setCompanies] = useState<PagePayload<Company>>();
  const [audits, setAudits] = useState<PagePayload<Audit>>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(undefined);
    void Promise.all([
      loadPage<Company>("/api/companies?page=1&pageSize=3&sortBy=updatedAt&sortOrder=desc"),
      loadPage<Audit>("/api/audits?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc"),
    ])
      .then(([companyPage, auditPage]) => {
        setCompanies(companyPage);
        setAudits(auditPage);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Impossible de charger vos données."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.all([
      loadPage<Company>("/api/companies?page=1&pageSize=3&sortBy=updatedAt&sortOrder=desc"),
      loadPage<Audit>("/api/audits?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc"),
    ])
      .then(([companyPage, auditPage]) => {
        setCompanies(companyPage);
        setAudits(auditPage);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Impossible de charger vos données."),
      )
      .finally(() => setLoading(false));
  }, []);
  const latestAuditByCompany = useMemo(() => {
    const result = new Map<string, Audit>();
    audits?.items.forEach((audit) => {
      if (!result.has(audit.company.id)) result.set(audit.company.id, audit);
    });
    return result;
  }, [audits]);
  const activeAudits = audits?.items.filter((audit) =>
    ["draft", "in_progress", "completed"].includes(audit.status),
  ).length;

  return (
    <AppShell>
      <div className="page">
        <div className="heading">
          <div>
            <p className="eyebrow">TABLEAU DE BORD</p>
            <h1>Bienvenue dans AutomateX</h1>
            <p>Suivez les entreprises et audits de votre organisation.</p>
          </div>
        </div>
        {loading && <LoadingState label="Chargement de votre tableau de bord…" />}
        {error && (
          <ErrorState message="Impossible de charger votre tableau de bord." retry={load} />
        )}
        {!loading && !error && (
          <>
            <div className="stats">
              <article>
                <div className="stat-icon purple">
                  <Building2 />
                </div>
                <div>
                  <p>Entreprises</p>
                  <strong>{companies?.total ?? 0}</strong>
                  <small>Données réelles</small>
                </div>
              </article>
              <article>
                <div className="stat-icon blue">
                  <CircleGauge />
                </div>
                <div>
                  <p>Audits actifs</p>
                  <strong>{activeAudits ?? 0}</strong>
                  <small>{audits?.total ?? 0} au total</small>
                </div>
              </article>
              <article>
                <div className="stat-icon green">
                  <Target />
                </div>
                <div>
                  <p>Opportunités</p>
                  <strong>—</strong>
                  <small>Depuis un audit évalué</small>
                </div>
              </article>
              <article>
                <div className="stat-icon orange">
                  <Clock3 />
                </div>
                <div>
                  <p>Temps économisable</p>
                  <strong>—</strong>
                  <small>Depuis les rapports validés</small>
                </div>
              </article>
            </div>
            <div className="grid">
              <section className="panel companies">
                <div className="panel-head">
                  <div>
                    <h2>Entreprises récentes</h2>
                    <p>Dernières entreprises de votre organisation</p>
                  </div>
                  <Link href="/companies">
                    Voir toutes <ArrowRight size={15} />
                  </Link>
                </div>
                <div className="company-list">
                  {companies?.items.length === 0 && (
                    <div className="empty-state">
                      <p>Aucune entreprise pour le moment.</p>
                      <Link href="/companies/new">Ajouter une entreprise</Link>
                    </div>
                  )}
                  {companies?.items.map((company) => {
                    const audit = latestAuditByCompany.get(company.id);
                    const progress = audit?.progressPercentage ?? 0;
                    return (
                      <div className="company" key={company.id}>
                        <div className="company-logo violet">{initials(company.name)}</div>
                        <div className="company-name">
                          <strong>{company.name}</strong>
                          <small>{company.sectorId ?? "Secteur non renseigné"}</small>
                        </div>
                        <div className={`badge ${audit ? "running" : "todo"}`}>
                          <i />
                          {audit
                            ? audit.status.replaceAll("_", " ")
                            : company.status.replaceAll("_", " ")}
                        </div>
                        <div className="progress-wrap">
                          <div>
                            <span>Dernier audit</span>
                            <b>{audit ? `${progress}%` : "Aucun"}</b>
                          </div>
                          <div className="progress">
                            <i style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <Link
                          className="company-open"
                          href={companyRoute(company.id)}
                          aria-label={`Ouvrir ${company.name}`}
                        >
                          <ArrowRight />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="panel score">
                <div className="panel-head">
                  <div>
                    <h2>Analyse et recommandations</h2>
                    <p>Les résultats restent liés aux audits réels.</p>
                  </div>
                </div>
                <div className="score-body">
                  <div className="unavailable ring">
                    <div>
                      <strong>—</strong>
                      <span>/100</span>
                    </div>
                  </div>
                  <div className="score-copy">
                    <h3>Aucun score global inventé</h3>
                    <p>Consultez un audit terminé pour afficher ses résultats canoniques.</p>
                    <Link href={dashboardRoutes.audits}>
                      Voir les audits <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </section>
              <section className="cta">
                <div className="cta-icon">
                  <Sparkles />
                </div>
                <div>
                  <span>PRÊT À COMMENCER ?</span>
                  <h2>Lancez votre prochain audit</h2>
                  <p>Sélectionnez une entreprise et un questionnaire publié.</p>
                </div>
                <Link className="cta-link" href="/audits/new">
                  Démarrer un audit <ArrowRight size={17} />
                </Link>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
