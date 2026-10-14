import { z } from "zod";
import {
  agentCompanyInputSchema,
  agentCompanySchema,
  agentCompanyListSchema,
} from "../domain/agent-company";
import { agentCompanyContext } from "../infrastructure/agent-company-context";

const fields =
  "id,name,objective,mode,autonomy,agents,company_id,status,api_budget_euro,concurrency_limit,created_at";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const failure = (status: number, message: string) => json({ error: { message } }, status);
const contextFailure = (status: number) =>
  failure(
    status,
    status === 401
      ? "Connectez-vous à Optivos."
      : status === 403
        ? "Accès à cette organisation refusé."
        : "Cet espace est temporairement indisponible.",
  );
async function readBody(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw failure(403, "Origine de la demande refusée.");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    throw failure(415, "Une demande JSON est nécessaire.");
  if (!request.body) throw failure(400, "Demande incomplète.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw failure(413, "Demande trop volumineuse.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw failure(400, "Demande JSON invalide.");
  }
}
export async function listAgentCompanies() {
  const context = await agentCompanyContext();
  if (context instanceof Response) return contextFailure(context.status);
  try {
    const { data, error } = await context.client
      .from("agent_company_workspaces")
      .select(fields)
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(21);
    if (error) throw error;
    const list = agentCompanyListSchema.parse({
      items: (data || []).slice(0, 20),
      hasMore: (data || []).length > 20,
    });
    return json({ data: { ...list, canWrite: context.canWrite } });
  } catch {
    return failure(503, "Les entreprises IA sont temporairement indisponibles.");
  }
}
export async function createAgentCompany(request: Request) {
  const context = await agentCompanyContext();
  if (context instanceof Response) return contextFailure(context.status);
  if (!context.canWrite) return failure(403, "Votre rôle permet uniquement la consultation.");
  try {
    const parsed = agentCompanyInputSchema.safeParse(await readBody(request));
    if (!parsed.success)
      return failure(400, "Vérifiez le nom, l’objectif et les profils d’agents.");
    const input = parsed.data;
    if (input.companyId) {
      const { data, error } = await context.client
        .from("companies")
        .select("id")
        .eq("id", input.companyId)
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .neq("status", "archived")
        .maybeSingle();
      if (error) throw error;
      if (!data) return failure(404, "Dossier entreprise introuvable.");
    }
    const row = {
      id: input.id,
      organization_id: context.organizationId,
      created_by: context.userId,
      name: input.name,
      objective: input.objective,
      mode: input.mode,
      autonomy: input.autonomy,
      agents: input.agents,
      company_id: input.companyId,
    };
    const { data, error } = await context.client
      .from("agent_company_workspaces")
      .insert(row)
      .select(fields)
      .single();
    if (error?.code === "23505") {
      const existing = await context.client
        .from("agent_company_workspaces")
        .select(fields + ",created_by")
        .eq("organization_id", context.organizationId)
        .eq("id", input.id)
        .maybeSingle();
      if (existing.error) throw existing.error;
      const existingRow = agentCompanySchema
        .extend({ created_by: z.string() })
        .safeParse(existing.data);
      if (!existingRow.success || existingRow.data.created_by !== context.userId)
        return failure(409, "Identifiant déjà utilisé. Actualisez avant une nouvelle création.");
      const keys = ["name", "objective", "mode", "autonomy", "agents", "company_id"] as const;
      const match = keys.every(
        (key) => JSON.stringify(existingRow.data[key]) === JSON.stringify(row[key]),
      );
      return match
        ? json({ data: agentCompanySchema.parse(existing.data) })
        : failure(409, "Cette création a déjà été enregistrée avec une autre configuration.");
    }
    if (error) throw error;
    return json({ data: agentCompanySchema.parse(data) }, 201);
  } catch (error) {
    return error instanceof Response
      ? error
      : failure(
          503,
          "Enregistrement non confirmé. Réessayez la même demande ; ne créez pas un doublon.",
        );
  }
}
export async function linkAgentCompany(id: string, request: Request) {
  if (!z.string().uuid().safeParse(id).success) return failure(404, "Entreprise IA introuvable.");
  const context = await agentCompanyContext();
  if (context instanceof Response) return contextFailure(context.status);
  if (!context.canWrite) return failure(403, "Votre rôle permet uniquement la consultation.");
  try {
    const parsed = z
      .object({ companyId: z.string().uuid().nullable() })
      .strict()
      .safeParse(await readBody(request));
    if (!parsed.success) return failure(400, "Dossier entreprise invalide.");
    if (parsed.data.companyId) {
      const { data, error } = await context.client
        .from("companies")
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("id", parsed.data.companyId)
        .is("deleted_at", null)
        .neq("status", "archived")
        .maybeSingle();
      if (error) throw error;
      if (!data) return failure(404, "Dossier entreprise introuvable.");
    }
    const { data, error } = await context.client
      .from("agent_company_workspaces")
      .update({ company_id: parsed.data.companyId })
      .eq("id", id)
      .eq("organization_id", context.organizationId)
      .select(fields)
      .maybeSingle();
    if (error) throw error;
    return data
      ? json({ data: agentCompanySchema.parse(data) })
      : failure(404, "Entreprise IA introuvable.");
  } catch (error) {
    return error instanceof Response
      ? error
      : failure(503, "Liaison non confirmée. Actualisez pour vérifier son état.");
  }
}
