"use client";

import Link from "next/link";
import { GroupedNavigation } from "./grouped-navigation";
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
  Bot,
} from "lucide-react";
import {
  agentLabVisible,
  agentWorkspaceHref,
} from "@/modules/agent-workspace/application/agent-workspace-policy";
import { OptivosLogo } from "@/components/brand/optivos-logo";

const decisionNavigation = [
  [LayoutDashboard, "Vue d’ensemble", "/"],
  [Building2, "Mon entreprise", "/companies"],
  [CircleGauge, "Audit", "/companies"],
  [Sparkles, "Opportunités", "/recommendations"],
  [BarChart3, "ROI", "/companies"],
  [FileText, "Plan d’action", "/recommendations"],
  [Target, "Résultats", "/companies"],
] as const;
const pilotNavigation = agentLabVisible()
  ? [...decisionNavigation, [Bot, "Atelier IA", "/atelier-ia"] as const]
  : decisionNavigation;

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
    if (label === "Atelier IA") return agentWorkspaceHref(companyId);
    return companyNavigationHref(companyId, model, label, fallback);
  }

  function isActive(label: (typeof pilotNavigation)[number][1]): boolean {
    if (pathname.endsWith("/atelier-ia") || pathname === "/atelier-ia")
      return label === "Atelier IA";
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
        <div className="relative mt-9 mb-6">
          <GroupedNavigation
            key={pathname}
            entries={pilotNavigation.map(([icon, label, href]) => ({
              icon,
              label,
              href: navigationHref(label, href),
              active: isActive(label),
            }))}
          />
        </div>
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
        <GroupedNavigation
          key={pathname}
          mobile
          entries={pilotNavigation.map(([icon, label, href]) => ({
            icon,
            label,
            href: navigationHref(label, href),
            active: isActive(label),
          }))}
        />
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
