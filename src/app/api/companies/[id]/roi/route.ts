import { roiIdSchema, roiListSchema } from "@/modules/roi-evaluations/application/roi-schemas";
import { withRoiEvaluationService } from "@/modules/roi-evaluations/presentation/roi-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = roiIdSchema.safeParse((await params).id),
    query = roiListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!id.success || !query.success)
    return apiError("VALIDATION_ERROR", "Invalid ROI list request", 400);
  return withRoiEvaluationService((service) => service.list(id.data, query.data).then(apiSuccess));
}
