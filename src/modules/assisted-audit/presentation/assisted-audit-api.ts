import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { AssistedAuditError } from "../application/assisted-audit-errors";
import { AssistedAuditService } from "../application/assisted-audit-service";
import { PrismaAssistedAuditRepository } from "../infrastructure/prisma-assisted-audit-repository";

export async function withAssistedAuditService<T>(
  operation: (service: AssistedAuditService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (database) =>
      operation(new AssistedAuditService(new PrismaAssistedAuditRepository(database), userId)),
    );
  } catch (caught) {
    if (caught instanceof AssistedAuditError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
