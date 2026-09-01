import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link className="font-bold text-blue-200" href="/">
            Optivos
          </Link>
          <nav className="flex gap-4 text-sm text-slate-300">
            <Link href="/companies">Mon entreprise</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
