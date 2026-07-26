import { roiIdSchema } from "@/modules/roi-evaluations/application/roi-schemas";
import { withRoiEvaluationService } from "@/modules/roi-evaluations/presentation/roi-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = roiIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid ROI id", 400);
  return withRoiEvaluationService((service) => service.get(id.data).then(apiSuccess));
}
