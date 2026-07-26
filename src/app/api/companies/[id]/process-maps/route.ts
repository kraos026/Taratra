import {
  processMapIdSchema,
  processMapListSchema,
} from "@/modules/process-mapping/application/process-map-schemas";
import { withProcessMapService } from "@/modules/process-mapping/presentation/process-map-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = processMapIdSchema.safeParse((await params).id);
  const url = new URL(r.url);
  const q = processMapListSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!id.success || !q.success)
    return apiError("VALIDATION_ERROR", "Invalid process map query", 400);
  return withProcessMapService((s) => s.list(id.data, q.data).then(apiSuccess));
}
