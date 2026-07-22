import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { PrismaRecommendationRepository } from "../infrastructure/prisma-recommendation-repository";
import { RecommendationService } from "../application/recommendation-service";
import { apiError } from "@/shared/presentation/api-response";
export async function withRecommendationService<T>(
  operation: (service: RecommendationService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new RecommendationService(new PrismaRecommendationRepository(db), userId)),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return apiError(
      code,
      code === "NOT_FOUND"
        ? "Resource not found"
        : code === "FORBIDDEN"
          ? "Forbidden"
          : "Unexpected error",
      code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 500,
    );
  }
}
