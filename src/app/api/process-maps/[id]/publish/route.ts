import {
  processMapIdSchema,
  processMapMutationSchema,
} from "@/modules/process-mapping/application/process-map-schemas";
import { withProcessMapService } from "@/modules/process-mapping/presentation/process-map-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = processMapIdSchema.safeParse((await params).id);
  const body = processMapMutationSchema.safeParse(await r.json().catch(() => null));
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid publish request", 400);
  return withProcessMapService((s) => s.publish(id.data, body.data.lockVersion).then(apiSuccess));
}
