import { z } from "zod";
import { agentCompanyContext } from "../infrastructure/agent-company-context";
import { readHermesConnection } from "../infrastructure/hermes-health-client";
import { readHermesInventory } from "../infrastructure/hermes-inventory-client";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const failure = (status: number) =>
  json({ error: { message: "Consultation de cet espace indisponible." } }, status);

/** RLS and the canonical organization are checked before any runtime request. */
export async function readAgentCompanyRuntime(id: string, kind: "connection" | "inventory") {
  const context = await agentCompanyContext();
  if (context instanceof Response) return failure(context.status);
  if (!z.string().uuid().safeParse(id).success) return failure(404);
  try {
    const { data, error } = await context.client
      .from("agent_company_workspaces")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("id", id)
      .maybeSingle();
    if (error) return failure(503);
    if (!data) return failure(404);
    if (data.id !== id) return failure(503);
    const scope = { workspaceId: id };
    const result =
      kind === "connection" ? await readHermesConnection(scope) : await readHermesInventory(scope);
    return json({ data: result });
  } catch {
    return failure(503);
  }
}
