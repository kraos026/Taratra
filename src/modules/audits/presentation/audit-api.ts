import { authenticateApiRequest } from "@/shared/presentation/authenticated-api";
import { apiError } from "@/shared/presentation/api-response";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { AuditError } from "../domain/audit-errors";
import { PrismaAuditRepository } from "../infrastructure/prisma-audit-repository";
import { AuditService } from "../application/audit-service";
import { QuestionnaireError } from "@/modules/questionnaires/domain/questionnaire-errors";
export async function withAuditService<Result>(
  action: string,
  operation: (service: AuditService, userId: string) => Promise<Result>,
): Promise<Result | Response> {
  const authentication = await authenticateApiRequest(action);
  if (authentication.response) return authentication.response;
  const { userId } = authentication;
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
    logError({ action, userId, error: "UNEXPECTED_ERROR" });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
export function auditValidationError(message = "Invalid request") {
  return apiError("VALIDATION_ERROR", message, 400);
}
