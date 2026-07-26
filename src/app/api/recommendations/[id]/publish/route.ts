import {
  recommendationPortfolioIdSchema,
  recommendationPortfolioMutationSchema,
} from "@/modules/recommendation-portfolios/application/recommendation-schemas";
import { withRecommendationPortfolioService } from "@/modules/recommendation-portfolios/presentation/recommendation-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = recommendationPortfolioIdSchema.safeParse((await params).id),
    body = recommendationPortfolioMutationSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return apiError("VALIDATION_ERROR", "Invalid publication", 400);
  return withRecommendationPortfolioService((service) =>
    service.publish(id.data, body.data.lockVersion).then(apiSuccess),
  );
}
