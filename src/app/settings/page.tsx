import Link from "next/link";
export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <p className="text-sm font-semibold text-violet-600">AutomateX</p>
      <h1 className="text-3xl font-bold">Paramètres</h1>
      <div className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Bientôt disponible</h2>
        <p className="mt-2 text-sm text-neutral-500">
          La gestion des paramètres n’a pas encore de contrat backend public. Aucun contrôle
          trompeur n’est affiché.
        </p>
      </div>
      <Link className="font-semibold text-violet-600" href="/">
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
