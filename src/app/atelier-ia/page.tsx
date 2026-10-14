import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyShell } from "@/components/dashboard/company-shell";
import { loadAgentCompanies } from "@/modules/agent-workspace/application/agent-workspace-access";
import { agentWorkspaceHref } from "@/modules/agent-workspace/application/agent-workspace-policy";

export const dynamic = "force-dynamic";
export default async function AgentWorkspaceIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  const data = await loadAgentCompanies(page);
  if (data instanceof Response) {
    if (data.status === 401) redirect("/login");
    if (data.status === 404 || data.status === 403) notFound();
    throw new Error("L’atelier est temporairement indisponible.");
  }
  return (
    <CompanyShell>
      <section className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-sm font-medium text-indigo-300">Atelier IA · Démonstration</p>
          <h1 className="mt-2 text-3xl font-bold">Un espace pour vos missions</h1>
          <p className="mt-3 text-slate-300">
            Ouvrez un dossier entreprise pour préparer une mission, suivre son parcours et retrouver
            un exemple de résultat.
          </p>
        </header>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-100">
          Cet espace est expérimental. Hermes et les modèles IA ne sont pas activés. Les simulations
          n’effectuent aucune action externe.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.companies.map((company) => (
            <Link
              key={company.id}
              href={agentWorkspaceHref(company.id)}
              className="rounded-2xl border border-white/10 bg-slate-900 p-6 hover:border-indigo-400/50 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <h2 className="font-semibold">{company.name}</h2>
              <p className="mt-2 text-sm text-indigo-300">Ouvrir l’atelier →</p>
            </Link>
          ))}
        </div>
        {data.companies.length === 0 && (
          <p>
            Aucun dossier disponible.{" "}
            <Link href="/companies" className="text-indigo-300 underline">
              Ouvrir vos entreprises
            </Link>
            .
          </p>
        )}
        <nav aria-label="Pagination des entreprises" className="flex items-center gap-4">
          {data.page > 1 && (
            <Link href={`/atelier-ia?page=${data.page - 1}`} className="text-indigo-300 underline">
              Précédent
            </Link>
          )}
          <span className="text-sm text-slate-400">Page {data.page}</span>
          {data.page < data.totalPages && (
            <Link href={`/atelier-ia?page=${data.page + 1}`} className="text-indigo-300 underline">
              Suivant
            </Link>
          )}
        </nav>
      </section>
    </CompanyShell>
  );
}
