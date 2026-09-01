import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link className="font-bold text-blue-200" href="/">
            Optivos
          </Link>
          <Link className="text-sm text-slate-300 hover:text-white" href="/companies">
            Mon entreprise
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
