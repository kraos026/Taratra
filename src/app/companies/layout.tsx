import Link from "next/link";
import { Building2, LayoutDashboard, Sparkles } from "lucide-react";

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-bold" href="/">
            <span className="grid size-9 place-items-center rounded-lg bg-violet-600 text-white">
              <Sparkles size={18} />
            </span>
            AutomateX
          </Link>
          <nav className="flex gap-2">
            <Link
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              href="/"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700"
              href="/companies"
            >
              <Building2 size={16} />
              Entreprises
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
