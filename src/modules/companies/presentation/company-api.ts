import type { CompanyService } from "../application/company-service";
import { CompanyError } from "../domain/company-errors";
import { PrismaCompanyRepository } from "../infrastructure/prisma-company-repository";
import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { apiError } from "@/shared/presentation/api-response";
import { CompanyService as Service } from "../application/company-service";

export async function withCompanyService<Result>(
  action: string,
  operation: (service: CompanyService, userId: string) => Promise<Result>,
): Promise<Result | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return apiError("UNAUTHENTICATED", "Authentication required", 401);
  }

  try {
    const result = await withAuthenticatedDatabase(userId, async (database) => {
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

    logError({ action, userId, error: "UNEXPECTED_ERROR" });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

export function validationError(message = "Invalid request"): Response {
  return apiError("VALIDATION_ERROR", message, 400);
}
