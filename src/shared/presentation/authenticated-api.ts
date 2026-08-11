import { createClient } from "@/infrastructure/supabase/server";
import { logError } from "@/shared/infrastructure/logger";
import { apiError } from "./api-response";

export type AuthenticatedApiResult =
  { userId: string; response?: never } | { userId?: never; response: Response };

export async function authenticateApiRequest(action: string): Promise<AuthenticatedApiResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (error || !userId) {
      return { response: apiError("UNAUTHENTICATED", "Authentication required", 401) };
    }

    return { userId };
  } catch {
    logError({
      action,
      error: "AUTH_CONFIGURATION_ERROR",
    });
    return {
      response: apiError("AUTH_SERVICE_UNAVAILABLE", "Authentication service is unavailable", 503),
    };
  }
}
