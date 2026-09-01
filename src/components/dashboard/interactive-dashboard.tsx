"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ChevronRight,
  CircleGauge,
  Clock3,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { dashboardRoutes, dashboardSearchRoute } from "./dashboard-navigation";

type Company = {
  id: string;
  name: string;
  sectorId: string | null;
  status: string;
};

type Audit = {
  id: string;
  status: string;
  progressPercentage: number;
  updatedAt: string;
  company: { id: string; name: string };
};

type PagePayload<T> = { items: T[]; total: number };

type AdvancedAudit = {
  currentStage: string;
  overallStatus: string;
  nextAction: string | null;
};

const navigation = [
  [LayoutDashboard, "Vue d’ensemble", dashboardRoutes.overview],
  [Building2, "Mon entreprise", dashboardRoutes.companies],
  [CircleGauge, "Audit", dashboardRoutes.audit],
  [Lightbulb, "Opportunités", dashboardRoutes.opportunities],
  [BarChart3, "ROI", dashboardRoutes.roi],
  [FileText, "Plan d’action", dashboardRoutes.actionPlan],
  [Target, "Résultats", dashboardRoutes.results],
] as const;

async function loadPage<T>(url: string): Promise<PagePayload<T>> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as {
    data?: PagePayload<T>;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Impossible de charger le tableau de bord.");
  }
  return payload.data;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function InteractiveDashboard() {
  const router = useRouter();
  const [companies, setCompanies] = useState<PagePayload<Company>>();
  const [audits, setAudits] = useState<PagePayload<Audit>>();
  const [advancedAudits, setAdvancedAudits] = useState<Map<string, AdvancedAudit>>(new Map());
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all([
      loadPage<Company>("/api/companies?page=1&pageSize=3&sortBy=updatedAt&sortOrder=desc"),
      loadPage<Audit>("/api/audits?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc"),
    ])
      .then(([companyPage, auditPage]) => {
        setCompanies(companyPage);
        setAudits(auditPage);
        return Promise.all(
          companyPage.items.map(async (company) => {
            const response = await fetch(`/api/companies/${company.id}/automation-audit`, {
              cache: "no-store",
            });
            const payload = (await response.json()) as { data?: AdvancedAudit };
            return [company.id, response.ok ? payload.data : undefined] as const;
          }),
        );
      })
      .then((rows) => {
        setAdvancedAudits(
          new Map(rows.filter((row): row is readonly [string, AdvancedAudit] => Boolean(row[1]))),
        );
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Impossible de charger les données."),
      );
  }, []);

  const activeAudits = audits?.items.filter((audit) =>
    ["draft", "in_progress", "completed"].includes(audit.status),
  ).length;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("search") ?? "");
    router.push(dashboardSearchRoute(value));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={dashboardRoutes.overview} aria-label="Accueil Optivos">
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            Opti<span>vos</span>
          </span>
        </Link>
        <nav aria-label="Navigation principale">
          <p className="nav-label">PILOTE OPTIVOS</p>
          {navigation.map(([Icon, label, href]) => (
            <Link className={href === "/" ? "nav-item active" : "nav-item"} href={href} key={label}>
              <Icon size={19} />
              <span>{label}</span>
              {label === "Audit" && activeAudits !== undefined && <b>{activeAudits}</b>}
            </Link>
          ))}
        </nav>
        <div className="upgrade" aria-label="Cadre du pilote">
          <span>
            <Sparkles size={17} />
          </span>
          <strong>Pilote Optivos</strong>
          <p>Audit privé sur optivos.vip, fondé sur vos données et vos preuves publiées.</p>
          <button type="button" disabled title="Activation commerciale après validation pilote">
            Pilot only
          </button>
        </div>
        <div className="profile">
          <div className="avatar">OV</div>
          <div>
            <strong>Compte connecté</strong>
            <small>Espace sécurisé</small>
          </div>
          <form action="/auth/logout" method="post">
            <button type="submit">Se deconnecter</button>
          </form>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <form className="search" role="search" onSubmit={search}>
            <Search size={18} />
            <input name="search" aria-label="Rechercher" placeholder="Rechercher une entreprise…" />
            <button type="submit" aria-label="Lancer la recherche">
              Rechercher
            </button>
          </form>
          <Link className="help" href="https://optivos.vip" aria-label="Aide Optivos">
            ?
          </Link>
          <Link className="primary" href={dashboardRoutes.companies}>
            <Sparkles size={17} />
            Lancer un audit Optivos
          </Link>
        </header>

        <div className="page">
          <div className="heading">
            <div>
              <p className="eyebrow">TABLEAU DE BORD</p>
              <h1>Bienvenue dans Optivos</h1>
              <p>
                Votre cockpit pilote pour décider quoi automatiser, quoi corriger et quoi éviter.
              </p>
            </div>
            <button
              className="outline"
              type="button"
              disabled
              title="Le journal d’activité reste masqué pendant le pilote"
            >
              Feedback pilote · Préparé
            </button>
          </div>

          {error && (
            <p className="dashboard-error" role="alert">
              {error}
            </p>
          )}

          <div className="stats">
            <article>
              <div className="stat-icon purple">
                <Building2 />
              </div>
              <div>
                <p>Mon entreprise</p>
                <strong>{companies?.total ?? "—"}</strong>
                <small>Données réelles</small>
              </div>
            </article>
            <article>
              <div className="stat-icon blue">
                <CircleGauge />
              </div>
              <div>
                <p>Audits actifs</p>
                <strong>{activeAudits ?? "—"}</strong>
                <small>{audits ? `${audits.total} au total` : "Chargement…"}</small>
              </div>
            </article>
            <article>
              <div className="stat-icon green">
                <Target />
              </div>
              <div>
                <p>Opportunités</p>
                <strong>—</strong>
                <small>Depuis l’audit publié</small>
              </div>
            </article>
            <article>
              <div className="stat-icon orange">
                <Clock3 />
              </div>
              <div>
                <p>Heures économisables</p>
                <strong>—</strong>
                <small>Données complémentaires requises</small>
              </div>
            </article>
          </div>

          <div className="grid">
            <section className="panel companies">
              <div className="panel-head">
                <div>
                  <h2>Mon entreprise</h2>
                  <p>Dossiers récents de votre organisation pilote</p>
                </div>
                <Link href={dashboardRoutes.companies}>
                  Ouvrir <ArrowRight size={15} />
                </Link>
              </div>
              <div className="company-list">
                {companies && companies.items.length === 0 && (
                  <p className="empty-state">Aucune entreprise. Créez votre dossier pilote.</p>
                )}
                {!companies && !error && <p className="empty-state">Chargement…</p>}
                {companies?.items.map((company) => {
                  const advancedAudit = advancedAudits.get(company.id);
                  const companyName = brandText(company.name);
                  return (
                    <div className="company" key={company.id}>
                      <div className="company-logo violet">{initials(companyName)}</div>
                      <div className="company-name">
                        <strong>{companyName}</strong>
                        <small>{company.sectorId ?? "Secteur non renseigné"}</small>
                      </div>
                      <div className={`badge ${advancedAudit ? "running" : "todo"}`}>
                        <i />
                        {advancedAudit
                          ? advancedAudit.overallStatus.replaceAll("_", " ")
                          : "Audit avancé à démarrer"}
                      </div>
                      <div className="progress-wrap">
                        <div>
                          <span>Parcours avancé</span>
                          <b>{advancedAudit?.currentStage.replaceAll("_", " ") ?? "Discovery"}</b>
                        </div>
                        <div className="progress">
                          <i style={{ width: advancedAudit ? "100%" : "0%" }} />
                        </div>
                      </div>
                      <Link
                        className="company-open"
                        href={`/companies/${company.id}/automation-audit`}
                        aria-label={`Ouvrir l'audit avancé de ${companyName}`}
                      >
                        <ChevronRight />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel score">
              <div className="panel-head">
                <div>
                  <h2>Performance globale</h2>
                  <p>Disponible depuis les rapports d’audit validés</p>
                </div>
                <select
                  aria-label="Période"
                  defaultValue="30"
                  disabled
                  title="Filtrage temporel bientôt disponible"
                >
                  <option value="30">30 derniers jours</option>
                </select>
              </div>
              <div className="score-body">
                <div className="unavailable ring">
                  <div>
                    <strong>—</strong>
                    <span>/100</span>
                  </div>
                </div>
                <div className="score-copy">
                  <h3>Aucune moyenne globale calculée</h3>
                  <p>
                    Optivos n’invente pas de score. Ouvrez un audit réel pour consulter son analyse.
                  </p>
                  <Link href={dashboardRoutes.companies}>
                    Voir l’analyse <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </section>

            <section className="panel activity">
              <div className="panel-head">
                <div>
                  <h2>États de décision</h2>
                  <p>Optivos distingue décision, preuve manquante et contrôle humain</p>
                </div>
                <button
                  type="button"
                  disabled
                  title="Exécution opérationnelle masquée pendant le pilote"
                >
                  •••
                </button>
              </div>
              <div className="grid gap-2 text-sm text-neutral-600">
                <p className="empty-state">Automatiser maintenant · après résultat publié</p>
                <p className="empty-state">Corriger avant d’automatiser · après analyse</p>
                <p className="empty-state">
                  Données complémentaires requises · visible dans le ROI
                </p>
              </div>
            </section>

            <section className="cta">
              <div className="cta-icon">
                <Sparkles />
              </div>
              <div>
                <span>PRÊT À COMMENCER ?</span>
                <h2>Lancez votre audit pilote Optivos</h2>
                <p>Sélectionnez votre entreprise pour suivre le parcours canonique complet.</p>
              </div>
              <Link className="cta-link" href={dashboardRoutes.companies}>
                Ouvrir mon entreprise <ArrowRight size={17} />
              </Link>
            </section>
          </div>
          <footer>
            <span>Optivos · Fondations sécurisées</span>
            <span>Aucune donnée métier n’est simulée sur ce tableau de bord.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function brandText(value: string): string {
  return value.replaceAll("AutomateX", "Optivos").replaceAll("AUTOMATEX", "OPTIVOS");
}
