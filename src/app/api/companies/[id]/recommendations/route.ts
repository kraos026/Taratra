import {
  recommendationPortfolioIdSchema,
  recommendationPortfolioListSchema,
} from "@/modules/recommendation-portfolios/application/recommendation-schemas";
import { withRecommendationPortfolioService } from "@/modules/recommendation-portfolios/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = recommendationPortfolioIdSchema.safeParse((await params).id),
    query = recommendationPortfolioListSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
  if (!id.success || !query.success) return apiError("VALIDATION_ERROR", "Invalid list", 400);
  return withRecommendationPortfolioService((service) =>
    service.list(id.data, query.data).then(apiSuccess),
  );
}
