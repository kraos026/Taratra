import { discoveryAutosaveSchema } from "@/modules/discovery/application/discovery-schemas";
import { withDiscoveryService } from "@/modules/discovery/presentation/discovery-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withDiscoveryService((s) => s.get(id).then(apiSuccess));
}
export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = discoveryAutosaveSchema.safeParse(await r.json().catch(() => null));
  if (!input.success)
    return apiError(
      "VALIDATION_ERROR",
      input.error.issues[0]?.message ?? "Invalid discovery payload",
      400,
    );
  const { id } = await params;
  return withDiscoveryService((s) =>
    s.autosave(id, input.data.lockVersion, input.data.payload).then(apiSuccess),
  );
}
