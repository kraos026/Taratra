import {
  normalizeRoiAssumptions,
  roiIdSchema,
  roiReviseSchema,
} from "@/modules/roi-evaluations/application/roi-schemas";
import { withRoiEvaluationService } from "@/modules/roi-evaluations/presentation/roi-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = roiIdSchema.safeParse((await params).id);
  const body = roiReviseSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid ROI revision request", 400);
  return withRoiEvaluationService((service) =>
    service
      .revise(id.data, {
        lockVersion: body.data.lockVersion,
        currency: body.data.currency,
        ...normalizeRoiAssumptions(body.data.assumptions),
      })
      .then((result) => apiSuccess(result, 201)),
  );
}
