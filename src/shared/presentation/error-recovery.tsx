"use client";

import Link from "next/link";

export function ErrorRecovery({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-12 text-slate-100">
      <section
        role="alert"
        aria-labelledby="optivos-error-title"
        className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-slate-900 p-7"
      >
        <p className="text-sm font-semibold text-blue-300">Optivos</p>
        <h1 id="optivos-error-title" className="text-2xl font-semibold">
          Cette page n’a pas pu se charger
        </h1>
        <p className="text-sm leading-6 text-slate-300">
          Réessayez dans un instant. Si le problème persiste, revenez à l’accueil pour retrouver
          votre entreprise et votre audit.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={reset}
            type="button"
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500"
          >
            Réessayer
          </button>
          <Link href="/" className="text-sm text-blue-300 underline underline-offset-4">
            Revenir à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
