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
    <div className="min-h-screen bg-[#030817] text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 overflow-hidden border-r border-white/[0.08] bg-[#040a19]/95 px-5 py-6 shadow-[24px_0_80px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:flex lg:flex-col">
        <span className="pointer-events-none absolute -top-24 -left-24 size-56 rounded-full bg-blue-600/10 blur-3xl" />
        <Link
          className="relative rounded-2xl p-1 focus-visible:ring-2 focus-visible:ring-blue-400"
          href="/"
          aria-label="Accueil Optivos"
        >
          <OptivosLogo subtitle="Intelligence de décision" />
        </Link>
        <nav className="relative mt-11 space-y-1.5" aria-label="Navigation principale">
          <p className="px-3 text-xs font-bold tracking-[0.22em] text-slate-500 uppercase">
            Espace de travail
          </p>
          {pilotNavigation.map(([Icon, label, href]) => (
            <Link
              key={label}
              href={navigationHref(label, href)}
              aria-current={isActive(label) ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                isActive(label)
                  ? "bg-gradient-to-r from-blue-500/20 to-indigo-500/10 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.28),0_8px_24px_rgba(30,64,175,0.10)]"
                  : "text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.05] hover:text-slate-100"
              }`}
            >
              <span
                className={`grid size-8 place-items-center rounded-xl transition ${isActive(label) ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.03] group-hover:bg-white/[0.06]"}`}
              >
                <Icon size={17} strokeWidth={1.8} />
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="relative mt-auto overflow-hidden rounded-3xl border border-blue-400/15 bg-gradient-to-br from-blue-500/[0.12] to-indigo-500/[0.04] p-4 text-sm text-slate-300 shadow-[inset_0_1px_rgba(255,255,255,0.04)]">
          <span className="absolute top-0 right-0 size-20 rounded-full bg-blue-400/10 blur-2xl" />
          <p className="relative flex items-center gap-2 font-semibold text-blue-100">
            <Sparkles size={15} /> Décisions fondées sur les preuves
          </p>
          <p className="mt-2 text-xs leading-5">
            Optivos distingue les faits, les estimations et les informations encore nécessaires.
          </p>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#040a19]/95 px-4 pt-3 pb-2 backdrop-blur-xl lg:hidden">
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_72%_-10%,rgba(59,130,246,0.10),transparent_30rem)] px-4 py-6 sm:px-6 lg:ml-72 lg:px-10">
        {children}
      </main>
    </div>
  );
}
