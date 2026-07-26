import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { apiError } from "@/shared/presentation/api-response";
import { DiscoveryService } from "../application/discovery-service";
import { DiscoveryError } from "../domain/discovery-errors";
import { PrismaDiscoveryRepository } from "../infrastructure/prisma-discovery-repository";
export async function withDiscoveryService<T>(
  operation: (service: DiscoveryService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new DiscoveryService(new PrismaDiscoveryRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof DiscoveryError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
