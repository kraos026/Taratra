import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { apiError } from "@/shared/presentation/api-response";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { AuditError } from "../domain/audit-errors";
import { PrismaAuditRepository } from "../infrastructure/prisma-audit-repository";
import { AuditService } from "../application/audit-service";
import { QuestionnaireError } from "@/modules/questionnaires/domain/questionnaire-errors";
const DATA_LAYER_DIAGNOSTIC_MARKER = "AUTOMATEX_DIAG_39709BD";
export async function withAuditService<Result>(
  action: string,
  operation: (service: AuditService, userId: string) => Promise<Result>,
): Promise<Result | Response> {
  const supabase = await createClient();
  logInfo({ action, diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER, stage: "audits.auth.start" });
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) {
    logError({
      action,
      diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER,
      stage: "audits.auth.failed",
      exceptionName: error?.name ?? "AuthError",
      sanitizedMessage: sanitizeDiagnosticMessage(error?.message ?? "missing user claims"),
    });
    return apiError("UNAUTHENTICATED", "Authentication required", 401);
  }
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
    logError({
      action,
      userId,
      error: "UNEXPECTED_ERROR",
      diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER,
      stage: "audits.unexpected.catch",
      ...describeDiagnosticException(caught),
    });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
export function auditValidationError(message = "Invalid request") {
  return apiError("VALIDATION_ERROR", message, 400);
}
function describeDiagnosticException(caught: unknown): Record<string, string> {
  const error = caught as {
    name?: string;
    code?: string;
    message?: string;
    meta?: { code?: string; cause?: string };
  };

  return {
    exceptionName: error.name ?? "UnknownError",
    prismaCode: error.code ?? "unknown",
    postgresCode: error.meta?.code ?? "unknown",
    sanitizedMessage: sanitizeDiagnosticMessage(error.message ?? error.meta?.cause ?? "unknown"),
  };
}

function sanitizeDiagnosticMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^ \n\r\t]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password[^,\n\r]*/gi, "password [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .slice(0, 500);
}
