import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { EnterpriseKnowledgeService } from "../application/enterprise-knowledge-service";
import { KnowledgeProjectionError } from "../application/knowledge-errors";
import { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";

export async function withEnterpriseKnowledgeService<T>(
  operation: (service: EnterpriseKnowledgeService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  try {
    return await withAuthenticatedDatabase(userId, (database) =>
      operation(new EnterpriseKnowledgeService(new PrismaKnowledgeRepository(database), userId)),
    );
  } catch (caught) {
    if (caught instanceof KnowledgeProjectionError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
