import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { AiOpportunityError } from "../application/ai-opportunity-errors";
import { AiOpportunityService } from "../application/ai-opportunity-service";
import { PrismaAiOpportunityRepository } from "../infrastructure/prisma-ai-opportunity-repository";

export async function withAiOpportunityService<T>(
  operation: (service: AiOpportunityService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new AiOpportunityService(new PrismaAiOpportunityRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof AiOpportunityError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
