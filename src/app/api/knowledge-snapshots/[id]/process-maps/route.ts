import { processMapIdSchema } from "@/modules/process-mapping/application/process-map-schemas";
import { withProcessMapService } from "@/modules/process-mapping/presentation/process-map-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = processMapIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid knowledge snapshot id", 400);
  return withProcessMapService((s) => s.build(id.data).then(apiSuccess));
}
