"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CircleGauge,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { dashboardRoutes, dashboardSearchRoute } from "@/components/dashboard/dashboard-navigation";

const navigation = [
  [LayoutDashboard, "Vue d’ensemble", dashboardRoutes.overview],
  [Building2, "Entreprises", dashboardRoutes.companies],
  [Users, "CRM", dashboardRoutes.crm],
  [CircleGauge, "Audits", dashboardRoutes.audits],
  [Lightbulb, "Recommandations", dashboardRoutes.recommendations],
  [FileText, "Rapports", dashboardRoutes.reports],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.split("?")[0]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      dashboardSearchRoute(String(new FormData(event.currentTarget).get("search") ?? "")),
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Accueil AutomateX">
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            Automate<span>X</span>
          </span>
        </Link>
        <nav aria-label="Navigation principale">
          <p className="nav-label">ESPACE DE TRAVAIL</p>
          {navigation.map(([Icon, label, href]) => (
            <Link
              className={`nav-item ${isActive(pathname, href) ? "active" : ""}`}
              href={href}
              key={label}
            >
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <p className="nav-label second">GESTION</p>
          <Link
            className={`nav-item ${isActive(pathname, dashboardRoutes.knowledge) ? "active" : ""}`}
            href={dashboardRoutes.knowledge}
          >
            <BarChart3 size={19} />
            <span>Base de connaissances</span>
          </Link>
          <Link
            className={`nav-item ${isActive(pathname, dashboardRoutes.settings) ? "active" : ""}`}
            href={dashboardRoutes.settings}
          >
            <Settings size={19} />
            <span>Paramètres</span>
          </Link>
        </nav>
        <div className="upgrade">
          <span>
            <Sparkles size={17} />
          </span>
          <strong>AutomateX Pro</strong>
          <p>Fonctionnalités avancées en préparation.</p>
          <button type="button" disabled title="Bientôt disponible">
            Bientôt disponible
          </button>
        </div>
        <div className="profile">
          <div className="avatar">AX</div>
          <div>
            <strong>Compte connecté</strong>
            <small>Espace sécurisé</small>
          </div>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <form className="search" role="search" onSubmit={search}>
            <Search size={18} />
            <input name="search" aria-label="Rechercher" placeholder="Rechercher une entreprise…" />
            <button type="submit">Rechercher</button>
          </form>
          <Link className="help" href="/settings" aria-label="Aide et paramètres">
            ?
          </Link>
          <Link className="primary" href="/audits/new">
            <Sparkles size={17} />
            Nouvel audit
          </Link>
        </header>
        <div className="app-page">{children}</div>
      </section>
    </main>
  );
}
