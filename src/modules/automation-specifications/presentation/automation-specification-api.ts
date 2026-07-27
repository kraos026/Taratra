import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { AutomationSpecificationError } from "../application/automation-specification-errors";
import { AutomationSpecificationService } from "../application/automation-specification-service";
import { PrismaAutomationSpecificationRepository } from "../infrastructure/prisma-automation-specification-repository";

export async function withAutomationSpecificationService<T>(
  operation: (service: AutomationSpecificationService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (database) =>
      operation(
        new AutomationSpecificationService(
          new PrismaAutomationSpecificationRepository(database),
          userId,
        ),
      ),
    );
  } catch (caught) {
    if (caught instanceof AutomationSpecificationError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
