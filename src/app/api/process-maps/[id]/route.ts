import { processMapIdSchema } from "@/modules/process-mapping/application/process-map-schemas";
import { withProcessMapService } from "@/modules/process-mapping/presentation/process-map-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = processMapIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid process map id", 400);
  return withProcessMapService((s) => s.get(id.data).then(apiSuccess));
}
