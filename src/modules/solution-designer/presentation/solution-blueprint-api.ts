import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError } from "@/shared/presentation/api-response";
import { SolutionBlueprintError } from "../application/solution-blueprint-errors";
import { SolutionBlueprintService } from "../application/solution-blueprint-service";
import { PrismaSolutionBlueprintRepository } from "../infrastructure/prisma-solution-blueprint-repository";

export async function withSolutionBlueprintService<T>(
  operation: (service: SolutionBlueprintService) => Promise<T>,
): Promise<T | Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  try {
    return await withAuthenticatedDatabase(userId, (db) =>
      operation(new SolutionBlueprintService(new PrismaSolutionBlueprintRepository(db), userId)),
    );
  } catch (caught) {
    if (caught instanceof SolutionBlueprintError)
      return apiError(caught.code, caught.message, caught.status);
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}
