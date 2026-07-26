import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="border-b bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link className="font-bold text-violet-700" href="/">
            AutomateX
          </Link>
          <Link href="/companies">Entreprises</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
