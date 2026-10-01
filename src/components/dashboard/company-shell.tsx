"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AssistedAuditReadModel } from "@/modules/assisted-audit/application/assisted-audit-model";
import {
  companyIdFromPath,
  companyNavigationHref,
  loadCompanyNavigation,
} from "@/components/dashboard/company-navigation";
import {
  BarChart3,
  Building2,
  CircleGauge,
  FileText,
  LayoutDashboard,
  Sparkles,
  Target,
} from "lucide-react";
import { OptivosLogo } from "@/components/brand/optivos-logo";

const pilotNavigation = [
  [LayoutDashboard, "Vue d’ensemble", "/"],
  [Building2, "Mon entreprise", "/companies"],
  [CircleGauge, "Audit", "/companies"],
  [Sparkles, "Opportunités", "/recommendations"],
  [BarChart3, "ROI", "/companies"],
  [FileText, "Plan d’action", "/recommendations"],
  [Target, "Résultats", "/companies"],
] as const;

export function CompanyShell({
  children,
  verifiedCompanyId,
}: {
  children: React.ReactNode;
  verifiedCompanyId?: string;
}) {
  const pathname = usePathname();
  const companyId = verifiedCompanyId ?? companyIdFromPath(pathname);
  const [navigation, setNavigation] = useState<{
    pathname: string;
    model: AssistedAuditReadModel | null;
  } | null>(null);
  const model = navigation?.pathname === pathname ? navigation.model : null;

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    void loadCompanyNavigation(companyId, controller.signal)
      .then((model) => {
        if (!controller.signal.aborted) setNavigation({ pathname, model });
      })
      .catch(() => {
        if (!controller.signal.aborted) setNavigation({ pathname, model: null });
      });
    return () => controller.abort();
  }, [companyId, pathname]);

  function navigationHref(label: (typeof pilotNavigation)[number][1], fallback: string): string {
    return companyNavigationHref(companyId, model, label, fallback);
  }

  function isActive(label: (typeof pilotNavigation)[number][1]): boolean {
    if (/\/results/.test(pathname)) return label === "Résultats";
    if (/\/recommendations\//.test(pathname)) return label === "Plan d’action";
    if (/\/roi\//.test(pathname)) return label === "ROI";
    if (/\/automation-opportunities|\/ai-opportunities/.test(pathname))
      return label === "Opportunités";
    if (/\/automation-audit|\/discovery|\/interview|\/process-maps/.test(pathname))
      return label === "Audit";
    return label === "Mon entreprise";
  }

  return (
    <div className="workspace-shell min-h-screen text-slate-50">
      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-10 hidden w-64 overflow-y-auto px-4 py-6 lg:flex lg:flex-col">
        <Link
          className="relative rounded-2xl p-1 focus-visible:ring-2 focus-visible:ring-blue-400"
          href="/"
          aria-label="Accueil Optivos"
        >
          <OptivosLogo subtitle="Intelligence de décision" />
        </Link>
        <nav className="relative mt-9 space-y-1" aria-label="Navigation principale">
          <p className="mb-3 px-3 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Espace de travail
          </p>
          {pilotNavigation.map(([Icon, label, href]) => (
            <Link
              key={label}
              href={navigationHref(label, href)}
              aria-current={isActive(label) ? "page" : undefined}
              aria-label={label}
              className={`workspace-nav group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(label)
                  ? "bg-indigo-400/10 text-indigo-200 ring-1 ring-indigo-400/20"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              <span className="grid size-7 place-items-center">
                <Icon size={17} strokeWidth={1.8} />
              </span>
              <span className="workspace-nav-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="relative mt-auto rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
          <p className="relative flex items-center gap-2 font-semibold text-blue-100">
            <Sparkles size={15} /> Décisions fondées sur les preuves
          </p>
          <p className="mt-2 text-xs leading-5">
            Optivos distingue les faits, les estimations et les informations encore nécessaires.
          </p>
        </div>
      </aside>
      <header className="workspace-mobile-header sticky top-0 z-20 border-b border-white/10 px-4 pt-3 pb-2 lg:hidden">
        <Link
          className="inline-flex rounded-xl focus-visible:ring-2 focus-visible:ring-blue-400"
          href="/"
          aria-label="Accueil Optivos"
        >
          <OptivosLogo compact />
          <span className="ml-2 self-center font-['Manrope'] text-lg font-extrabold tracking-[-0.04em]">
            Optivos
          </span>
        </Link>
        <nav
          className="mt-3 flex [scrollbar-width:none] gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
          aria-label="Navigation principale mobile"
        >
          {pilotNavigation.map(([Icon, label, href]) => (
            <Link
              key={label}
              href={navigationHref(label, href)}
              aria-current={isActive(label) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isActive(label)
                  ? "bg-blue-500/20 text-blue-100 ring-1 ring-blue-400/30"
                  : "text-slate-400"
              }`}
            >
              <Icon size={15} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="workspace-body min-w-0 lg:ml-64">
        <header className="workspace-toolbar hidden items-center justify-between gap-4 px-8 lg:flex">
          <p className="text-sm text-slate-400">
            Espace de travail{" "}
            <span className="mx-3 text-slate-600" aria-hidden="true">
              /
            </span>
            <span className="font-medium text-slate-100">
              {pilotNavigation.find(([, label]) => isActive(label))?.[1]}
            </span>
          </p>
          <span className="text-xs text-slate-400">Optivos · Intelligence de décision</span>
        </header>
        <main className="workspace-content min-h-screen px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
