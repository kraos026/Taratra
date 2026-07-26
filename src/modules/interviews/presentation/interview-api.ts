import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { InterviewService } from "../application/interview-service";
import { InterviewError } from "../domain/interview-errors";
import { PrismaInterviewRepository } from "../infrastructure/prisma-interview-repository";

export async function withInterviewService<T>(
  operation: (service: InterviewService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (database) =>
      operation(new InterviewService(new PrismaInterviewRepository(database), userId)),
    );
  } catch (caught) {
    if (caught instanceof InterviewError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
