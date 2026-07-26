import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { RecommendationPortfolioError } from "../application/recommendation-errors";
import { RecommendationPortfolioService } from "../application/recommendation-service";
import { PrismaRecommendationPortfolioRepository } from "../infrastructure/prisma-recommendation-portfolio-repository";
export async function withRecommendationPortfolioService<T>(
  operation: (service: RecommendationPortfolioService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient(),
    { data, error } = await supabase.auth.getClaims(),
    userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(
        new RecommendationPortfolioService(new PrismaRecommendationPortfolioRepository(db), userId),
      ),
    );
  } catch (caught) {
    if (caught instanceof RecommendationPortfolioError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
