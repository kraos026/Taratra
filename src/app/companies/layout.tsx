import Link from "next/link";
import {
  BarChart3,
  Building2,
  CircleGauge,
  FileText,
  LayoutDashboard,
  Sparkles,
  Target,
} from "lucide-react";

const pilotNavigation = [
  [LayoutDashboard, "Vue d’ensemble", "/"],
  [Building2, "Mon entreprise", "/companies"],
  [CircleGauge, "Audit", "/companies"],
  [Sparkles, "Opportunités", "/recommendations"],
  [BarChart3, "ROI", "/companies"],
  [FileText, "Plan d’action", "/recommendations"],
  [Target, "Résultats", "/companies"],
] as const;

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-72 border-r border-white/10 bg-slate-950/95 px-5 py-6 lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 font-['Manrope'] text-xl font-extrabold" href="/">
          <span className="grid size-10 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Sparkles size={19} />
          </span>
          Optivos
        </Link>
        <nav className="mt-10 space-y-1" aria-label="Navigation pilote">
          <p className="px-3 text-xs font-bold tracking-[0.22em] text-slate-500 uppercase">
            Pilote
          </p>
          {pilotNavigation.map(([Icon, label, href]) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                label === "Mon entreprise"
                  ? "bg-blue-500/15 text-blue-100 ring-1 ring-blue-400/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-3xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-slate-300">
          <p className="font-semibold text-blue-100">Audit privé Optivos</p>
          <p className="mt-2 text-xs leading-5">
            Toutes les vues pilote restent fondées sur les données publiées de votre entreprise.
          </p>
        </div>
      </aside>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:ml-72 lg:px-10">{children}</main>
    </div>
  );
}
