import { recommendationPortfolioIdSchema } from "@/modules/recommendation-portfolios/application/recommendation-schemas";
import { withRecommendationPortfolioService } from "@/modules/recommendation-portfolios/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = recommendationPortfolioIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid portfolio id", 400);
  return withRecommendationPortfolioService((service) => service.get(id.data).then(apiSuccess));
}
