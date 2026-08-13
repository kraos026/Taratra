import type { CompanyService } from "../application/company-service";
import { CompanyError } from "../domain/company-errors";
import { PrismaCompanyRepository } from "../infrastructure/prisma-company-repository";
import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { apiError } from "@/shared/presentation/api-response";
import { CompanyService as Service } from "../application/company-service";

const DATA_LAYER_DIAGNOSTIC_MARKER = "AUTOMATEX_DIAG_39709BD";

export async function withCompanyService<Result>(
  action: string,
  operation: (service: CompanyService, userId: string) => Promise<Result>,
): Promise<Result | Response> {
  const supabase = await createClient();
  logInfo({
    action,
    diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER,
    stage: "companies.auth.start",
  });
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    logError({
      action,
      diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER,
      stage: "companies.auth.failed",
      exceptionName: error?.name ?? "AuthError",
      sanitizedMessage: sanitizeDiagnosticMessage(error?.message ?? "missing user claims"),
    });
    return apiError("UNAUTHENTICATED", "Authentication required", 401);
  }

  try {
    const result = await withAuthenticatedDatabase(userId, async (database) => {
      logInfo({
        action,
        userId,
        diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER,
        stage: "companies.repository.create",
      });
      const repository = new PrismaCompanyRepository(database);
      return operation(new Service(repository, userId), userId);
    });
    logInfo({ action, userId });
    return result;
  } catch (caught) {
    if (caught instanceof CompanyError) {
      logError({ action, userId, error: caught.code });
      return apiError(caught.code, caught.message, caught.status);
    }

    logError({
      action,
      userId,
      error: "UNEXPECTED_ERROR",
      diagnosticMarker: DATA_LAYER_DIAGNOSTIC_MARKER,
      stage: "companies.unexpected.catch",
      ...describeDiagnosticException(caught),
    });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

export function validationError(message = "Invalid request"): Response {
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
