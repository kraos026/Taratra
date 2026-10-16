import { loadAgentCompany } from "@/modules/agent-workspace/application/agent-workspace-access";
import { readHermesConnection } from "@/modules/agent-workspace/infrastructure/hermes-health-client";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const company = await loadAgentCompany((await params).id);
  if (company instanceof Response) {
    company.headers.set("Cache-Control", "private, no-store");
    return company;
  }
  return Response.json(
    { data: await readHermesConnection(company.id) },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
