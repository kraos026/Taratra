import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanyShell } from "@/components/dashboard/company-shell";
import { loadAgentCompanies } from "@/modules/agent-workspace/application/agent-workspace-access";
import { agentWorkspaceHref } from "@/modules/agent-workspace/application/agent-workspace-policy";
import { AgentAvatar } from "@/modules/agent-workspace/presentation/agent-avatar";

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
          <p className="text-sm font-medium text-indigo-300">Atelier IA · Hermes</p>
          <div className="mt-4 flex items-center gap-4">
            <AgentAvatar size={72} />
            <h1 className="text-3xl font-bold">Votre travail, bien entouré.</h1>
          </div>
          <p className="mt-3 text-slate-300">
            Retrouvez vos équipes, confiez une mission à Hermes et gardez le dernier mot sur les
            résultats.
          </p>
        </header>
        <Link
          href="/atelier-ia/entreprises"
          className="block rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-5 focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <h2 className="font-semibold">Ouvrir mes équipes IA →</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Retrouvez vos équipes enregistrées ou créez-en une : objectif, personnages, missions et
            validations.
          </p>
        </Link>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm text-amber-100">
          Le pilote textuel s’utilise dans une équipe reliée au VPS. Les ateliers de dossiers
          ci-dessous servent au suivi des missions liées ; leur lancement reste à raccorder. Plafond
          de nouveaux frais API : 0 €.
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
