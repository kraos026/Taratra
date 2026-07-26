import { recommendationPortfolioIdSchema } from "@/modules/recommendation-portfolios/application/recommendation-schemas";
import { withRecommendationPortfolioService } from "@/modules/recommendation-portfolios/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = recommendationPortfolioIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid ROI id", 400);
  return withRecommendationPortfolioService((service) =>
    service.generate(id.data).then((value) => apiSuccess(value, 201)),
  );
}
