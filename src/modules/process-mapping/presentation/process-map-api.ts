import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { ProcessMapService } from "../application/process-map-service";
import { ProcessMapError } from "../application/process-map-errors";
import { PrismaProcessMapRepository } from "../infrastructure/prisma-process-map-repository";
export async function withProcessMapService<T>(
  operation: (service: ProcessMapService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new ProcessMapService(new PrismaProcessMapRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof ProcessMapError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
