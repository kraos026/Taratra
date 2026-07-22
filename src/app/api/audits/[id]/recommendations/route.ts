import { recommendationRunSchema } from "@/modules/recommendations/application/recommendation-schemas";
import { withRecommendationService } from "@/modules/recommendations/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = recommendationRunSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid ROI profile", 400);
  const { id } = await params;
  return withRecommendationService((s) => s.generate(id, input.data.roiProfileId).then(apiSuccess));
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withRecommendationService((s) => s.results(id).then(apiSuccess));
}
