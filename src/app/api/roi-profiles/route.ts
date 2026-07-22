import { roiProfileInputSchema } from "@/modules/recommendations/application/recommendation-schemas";
import { withRecommendationService } from "@/modules/recommendations/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET() {
  return withRecommendationService((s) => s.profiles().then(apiSuccess));
}
export async function POST(request: Request) {
  const input = roiProfileInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("VALIDATION_ERROR", "Invalid ROI profile", 400);
  return withRecommendationService((s) =>
    s.createProfile(input.data).then((v) => apiSuccess(v, 201)),
  );
}
