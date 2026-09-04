import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
import {
  PilotFeedbackNotFoundError,
  PilotFeedbackService,
} from "../application/pilot-feedback-service";
import { PrismaPilotFeedbackRepository } from "../infrastructure/prisma-pilot-feedback-repository";

export async function withPilotFeedbackService<T>(
  operation: (service: PilotFeedbackService) => Promise<T>,
): Promise<Response> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  try {
    const result = await withAuthenticatedDatabase(userId, (database) =>
      operation(new PilotFeedbackService(new PrismaPilotFeedbackRepository(database), userId)),
    );
    return apiSuccess(result);
  } catch (caught) {
    if (caught instanceof PilotFeedbackNotFoundError) {
      return apiError("NOT_FOUND", "Entreprise introuvable", 404);
    }
    return apiError("INTERNAL_ERROR", "Une erreur inattendue est survenue", 500);
  }
}
