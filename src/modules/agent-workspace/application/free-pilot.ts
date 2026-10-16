import { z } from "zod";
import { agentCompanyRuntimeAccess } from "./agent-company-runtime";
import { callFreePilot } from "../infrastructure/free-pilot-client";
import {
  freeMissionInput,
  freeReviewInput,
  freeMissionListSchema,
  freeMissionSchema,
  freePilotReadinessSchema,
} from "../domain/free-pilot";

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
const failure = (
  status: number,
  message = "Le pilote gratuit est indisponible. Aucun repli payant n’est autorisé.",
) => json({ error: { message } }, status);

async function readInput(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw failure(403, "Origine refusée.");
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
      if (size > 8192) {
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
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw failure(400, "JSON invalide.");
  }
}

export async function freePilotRead(id: string, kind: "readiness" | "missions") {
  const access = await agentCompanyRuntimeAccess(id);
  if (access instanceof Response) return access;
  try {
    const response = await callFreePilot(id, `/pilot/${kind}`);
    if (response.status !== 200) return failure(503);
    const data =
      kind === "readiness"
        ? freePilotReadinessSchema.parse(response.data)
        : freeMissionListSchema.parse(response.data);
    return json({ data });
  } catch {
    return failure(503);
  }
}

export async function freePilotCreate(id: string, request: Request) {
  const access = await agentCompanyRuntimeAccess(id);
  if (access instanceof Response) return access;
  if (!access.canWrite) return failure(403, "Votre rôle permet uniquement la consultation.");
  try {
    const parsed = freeMissionInput.safeParse(await readInput(request));
    if (!parsed.success) return failure(400, "Décrivez une mission de 10 à 2 000 caractères.");
    const response = await callFreePilot(id, "/pilot/missions", {
      ...parsed.data,
      userId: access.userId,
    });
    if ([409, 429].includes(response.status))
      return failure(
        response.status,
        response.status === 409
          ? "Cet identifiant appartient déjà à une autre demande."
          : "La file du pilote est pleine.",
      );
    if (![200, 202].includes(response.status)) return failure(503);
    return json(
      { data: z.object({ data: freeMissionSchema }).parse(response.data).data },
      response.status,
    );
  } catch (error) {
    return error instanceof Response
      ? error
      : failure(
          503,
          "État du lancement incertain. Actualisez les missions ou reprenez la même demande ; aucun rejeu automatique.",
        );
  }
}

export async function freePilotStop(id: string, missionId: string, request: Request) {
  const access = await agentCompanyRuntimeAccess(id);
  if (access instanceof Response) return access;
  if (!access.canWrite) return failure(403, "Votre rôle permet uniquement la consultation.");
  try {
    if (!z.string().uuid().safeParse(missionId).success) return failure(404);
    if (
      !z
        .object({})
        .strict()
        .safeParse(await readInput(request)).success
    )
      return failure(400);
    const response = await callFreePilot(id, `/pilot/missions/${missionId}/stop`, {});
    if (
      response.status !== 200 ||
      !z.object({ stopping: z.literal(true) }).safeParse(response.data).success
    )
      return failure(503);
    return json({ data: { stopping: true } });
  } catch (error) {
    return error instanceof Response ? error : failure(503);
  }
}

export async function freePilotReview(id: string, missionId: string, request: Request) {
  const access = await agentCompanyRuntimeAccess(id);
  if (access instanceof Response) return access;
  if (!access.canWrite) return failure(403, "Votre rôle permet uniquement la consultation.");
  try {
    if (!z.string().uuid().safeParse(missionId).success) return failure(404);
    const parsed = freeReviewInput.safeParse(await readInput(request));
    if (!parsed.success) return failure(400, "Précisez la correction en 10 à 500 caractères.");
    const response = await callFreePilot(id, `/pilot/missions/${missionId}/review`, {
      ...parsed.data,
      userId: access.userId,
    });
    if ([404, 409, 429].includes(response.status))
      return failure(
        response.status,
        "Relecture refusée : actualisez les missions avant de réessayer. L’historique est limité à vingt décisions par résultat.",
      );
    if (response.status !== 200) return failure(503);
    return json({ data: z.object({ data: freeMissionSchema }).parse(response.data).data });
  } catch (error) {
    return error instanceof Response
      ? error
      : failure(
          503,
          "Enregistrement incertain. Reprenez la même relecture ou actualisez les missions.",
        );
  }
}
