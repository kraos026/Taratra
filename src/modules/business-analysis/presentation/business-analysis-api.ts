import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { BusinessAnalysisService } from "../application/business-analysis-service";
import { BusinessAnalysisError } from "../application/business-analysis-errors";
import { PrismaBusinessAnalysisRepository } from "../infrastructure/prisma-business-analysis-repository";

export async function withBusinessAnalysisService<T>(
  operation: (service: BusinessAnalysisService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new BusinessAnalysisService(new PrismaBusinessAnalysisRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof BusinessAnalysisError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
