import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link className="font-bold text-violet-700" href="/">
            AutomateX
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/companies">Entreprises</Link>
            <Link href="/questionnaires">Questionnaires</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
