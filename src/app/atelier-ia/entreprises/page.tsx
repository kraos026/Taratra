import { notFound, redirect } from "next/navigation";
import { CompanyShell } from "@/components/dashboard/company-shell";
import { listAgentCompanies } from "@/modules/agent-workspace/application/agent-companies";
import {
  loadAgentCompanies,
  loadAgentCompany,
} from "@/modules/agent-workspace/application/agent-workspace-access";
import { AgentCompanyPanel } from "@/modules/agent-workspace/presentation/agent-company-panel";
import { agentCompanyListSchema } from "@/modules/agent-workspace/domain/agent-company";
export const dynamic = "force-dynamic";
export default async function AgentCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const selected = (await searchParams).company;
  const [response, available, linked] = await Promise.all([
    listAgentCompanies(),
    loadAgentCompanies(1),
    selected ? loadAgentCompany(selected) : Promise.resolve(null),
  ]);
  if (response.status === 401) redirect("/login");
  if (response.status === 403 || response.status === 404) notFound();
  if (linked instanceof Response) notFound();
  const body = response.ok
    ? ((await response.json()) as {
        data: { items: unknown[]; hasMore: boolean; canWrite: boolean };
      })
    : null;
  const parsed = body ? agentCompanyListSchema.safeParse(body.data) : null;
  const companies = available instanceof Response ? [] : available.companies;
  if (linked && !companies.some((c) => c.id === linked.id))
    companies.push({ id: linked.id, name: linked.name });
  return (
    <CompanyShell verifiedCompanyId={linked?.id}>
      <AgentCompanyPanel
        initial={parsed?.success ? parsed.data.items : []}
        canWrite={Boolean(parsed?.success && body?.data.canWrite)}
        companies={companies}
        initialCompanyId={linked?.id}
        unavailable={!parsed?.success}
        initialHasMore={parsed?.success ? parsed.data.hasMore : false}
      />
    </CompanyShell>
  );
}
