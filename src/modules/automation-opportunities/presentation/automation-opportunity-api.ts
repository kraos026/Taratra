import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { AutomationOpportunityError } from "../application/automation-opportunity-errors";
import { AutomationOpportunityService } from "../application/automation-opportunity-service";
import { PrismaAutomationOpportunityRepository } from "../infrastructure/prisma-automation-opportunity-repository";
export async function withAutomationOpportunityService<T>(
  operation: (service: AutomationOpportunityService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(
        new AutomationOpportunityService(new PrismaAutomationOpportunityRepository(db), userId),
      ),
    );
  } catch (caught) {
    if (caught instanceof AutomationOpportunityError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
