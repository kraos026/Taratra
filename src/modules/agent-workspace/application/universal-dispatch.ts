import { agentCompanyRuntimeAccess } from "./agent-company-runtime";
import { freePilotCreate, readInput } from "./free-pilot";
import {
  dispatchInputSchema,
  engineRegistry,
  resolveEngineCapability,
} from "../domain/engine-registry";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const failure = (status: number, message: string) => json({ error: { message } }, status);

export async function readWorkspaceEngines(id: string) {
  const access = await agentCompanyRuntimeAccess(id);
  if (access instanceof Response) return access;
  return json({
    data: {
      version: 1,
      engines: engineRegistry,
      canWrite: access.canWrite,
      health: "not-checked",
      apiBudgetEuro: 0,
    },
  });
}

/** Explicit routing only. New manifests cannot create an executable binding. */
export async function dispatchWorkspaceMission(id: string, request: Request) {
  const access = await agentCompanyRuntimeAccess(id);
  if (access instanceof Response) return access;
  if (!access.canWrite) return failure(403, "Votre rôle permet uniquement la consultation.");
  try {
    const parsed = dispatchInputSchema.safeParse(await readInput(request));
    if (!parsed.success) return failure(400, "Contrat de mission invalide.");
    const { engineId, capability, mission } = parsed.data;
    const match = resolveEngineCapability(engineId, capability);
    if (!match) return failure(404, "Moteur ou capacité inconnu.");
    if (
      match.engine.wiring !== "adapter" ||
      match.capability.mode !== "dispatch" ||
      engineId !== "hermes" ||
      capability !== "text.generate"
    )
      return failure(
        409,
        "Cette capacité n’est pas raccordée au dispatch. Aucun lancement effectué.",
      );
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: { origin: new URL(request.url).origin, "Content-Type": "application/json" },
      body: JSON.stringify(mission),
    });
    // Reuses tenant/author checks, durable UUID, zero-fee gate and queue unchanged.
    return await freePilotCreate(id, forwarded);
  } catch (error) {
    return error instanceof Response
      ? error
      : failure(
          503,
          "Dispatch indisponible ou état incertain. Reprenez le même identifiant ; aucun repli automatique.",
        );
  }
}
