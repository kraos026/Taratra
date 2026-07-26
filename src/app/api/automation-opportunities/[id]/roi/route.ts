import { roiEvaluateSchema, roiIdSchema } from "@/modules/roi-evaluations/application/roi-schemas";
import { withRoiEvaluationService } from "@/modules/roi-evaluations/presentation/roi-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = roiIdSchema.safeParse((await params).id);
  const body = roiEvaluateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid ROI evaluation request", 400);
  return withRoiEvaluationService((service) =>
    service.evaluate(id.data, body.data).then((result) => apiSuccess(result, 201)),
  );
}
