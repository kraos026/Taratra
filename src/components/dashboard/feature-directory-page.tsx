import Link from "next/link";

export function FeatureDirectoryPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm font-semibold text-violet-600">AutomateX</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-neutral-600">{description}</p>
      <div className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Sélectionnez une entreprise</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Ces données sont accessibles depuis le dossier tenant-scoped de chaque entreprise. Aucune
          valeur globale n’est simulée.
        </p>
        <Link className="mt-4 inline-block font-semibold text-violet-600" href="/companies">
          Voir les entreprises →
        </Link>
      </div>
      <Link className="text-sm font-semibold text-violet-600" href="/">
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
