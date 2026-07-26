import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { RoiEvaluationError } from "../application/roi-errors";
import { RoiEvaluationService } from "../application/roi-service";
import { PrismaRoiEvaluationRepository } from "../infrastructure/prisma-roi-evaluation-repository";
export async function withRoiEvaluationService<T>(
  operation: (service: RoiEvaluationService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new RoiEvaluationService(new PrismaRoiEvaluationRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof RoiEvaluationError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
