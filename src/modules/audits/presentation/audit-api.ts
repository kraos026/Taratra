import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { apiError } from "@/shared/presentation/api-response";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { AuditError } from "../domain/audit-errors";
import { PrismaAuditRepository } from "../infrastructure/prisma-audit-repository";
import { AuditService } from "../application/audit-service";
import { QuestionnaireError } from "@/modules/questionnaires/domain/questionnaire-errors";
export async function withAuditService<Result>(
  action: string,
  operation: (service: AuditService, userId: string) => Promise<Result>,
): Promise<Result | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    const result = await withAuthenticatedDatabase(userId, (db) =>
      operation(new AuditService(new PrismaAuditRepository(db), userId), userId),
    );
    logInfo({ action, userId });
    return result;
  } catch (caught) {
    if (caught instanceof AuditError || caught instanceof QuestionnaireError) {
      logError({ action, userId, error: caught.code });
      return apiError(caught.code, caught.message, caught.status);
    }
    const diagnostic =
      caught instanceof Error ? `${caught.name}: ${caught.message}` : "UNEXPECTED_ERROR";
    logError({ action, userId, error: diagnostic });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
export function auditValidationError(message = "Invalid request") {
  return apiError("VALIDATION_ERROR", message, 400);
}
