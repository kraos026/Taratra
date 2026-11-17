import { notFound, redirect } from "next/navigation";
import { loadAgentCompany } from "@/modules/agent-workspace/application/agent-workspace-access";
import { AgentWorkspacePanel } from "@/modules/agent-workspace/presentation/agent-workspace-panel";

export const dynamic = "force-dynamic";
export default async function CompanyAgentWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const company = await loadAgentCompany((await params).id);
  if (company instanceof Response) {
    if (company.status === 401) redirect("/login");
    if (company.status === 404 || company.status === 403) notFound();
    throw new Error("L’atelier est temporairement indisponible.");
  }
  return <AgentWorkspacePanel key={company.id} company={company} />;
}
