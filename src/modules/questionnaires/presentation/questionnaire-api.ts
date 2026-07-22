import { createClient } from "@/infrastructure/supabase/server";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { apiError } from "@/shared/presentation/api-response";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { QuestionnaireError } from "../domain/questionnaire-errors";
import { PrismaQuestionnaireRepository } from "../infrastructure/prisma-questionnaire-repository";
import { QuestionnaireService } from "../application/questionnaire-service";
export async function withQuestionnaireService<Result>(
  action: string,
  operation: (service: QuestionnaireService, userId: string) => Promise<Result>,
): Promise<Result | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    const result = await withAuthenticatedDatabase(userId, (db) =>
      operation(new QuestionnaireService(new PrismaQuestionnaireRepository(db), userId), userId),
    );
    logInfo({ action, userId });
    return result;
  } catch (caught) {
    if (caught instanceof QuestionnaireError) {
      logError({ action, userId, error: caught.code });
      return apiError(caught.code, caught.message, caught.status);
    }
    logError({ action, userId, error: "UNEXPECTED_ERROR" });
    return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
export function questionnaireValidationError(message = "Invalid request") {
  return apiError("VALIDATION_ERROR", message, 400);
}
