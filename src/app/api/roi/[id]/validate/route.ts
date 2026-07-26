import { roiIdSchema, roiMutationSchema } from "@/modules/roi-evaluations/application/roi-schemas";
import { withRoiEvaluationService } from "@/modules/roi-evaluations/presentation/roi-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = roiIdSchema.safeParse((await params).id),
    body = roiMutationSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid validation request", 400);
  return withRoiEvaluationService((service) =>
    service.validate(id.data, body.data.lockVersion).then(apiSuccess),
  );
}
