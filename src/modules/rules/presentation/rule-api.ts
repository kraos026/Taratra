import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { apiError } from "@/shared/presentation/api-response";
import { RuleService } from "../application/rule-service";
import { RuleError } from "../domain/rule-errors";
import { PrismaRuleRepository } from "../infrastructure/prisma-rule-repository";

export async function withRuleService<Result>(
  action: string,
  operation: (service: RuleService) => Promise<Result>,
): Promise<Result | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    const result = await withAuthenticatedDatabase(userId, (db) =>
      operation(new RuleService(new PrismaRuleRepository(db), userId)),
    );
    logInfo({ action, userId });
    return result;
  } catch (caught) {
    if (caught instanceof RuleError) {
      logError({ action, userId, error: caught.code });
      return apiError(caught.code, caught.message, caught.status);
    }
    logError({ action, userId, error: "UNEXPECTED_ERROR" });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
export function ruleValidationError(message = "Invalid rule request") {
  return apiError("VALIDATION_ERROR", message, 400);
}
