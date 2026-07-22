import { roiProfilePatchSchema } from "@/modules/recommendations/application/recommendation-schemas";
import { withRecommendationService } from "@/modules/recommendations/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = roiProfilePatchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid ROI profile", 400);
  const { id } = await params;
  return withRecommendationService((s) => s.updateProfile(id, input.data).then(apiSuccess));
}
