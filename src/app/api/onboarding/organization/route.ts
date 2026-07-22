import { createOrganizationSchema } from "@/modules/onboarding/application/create-organization-schema";
import { createClient } from "@/infrastructure/supabase/server";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return apiError("UNAUTHENTICATED", "Authentication required", 401);
  }

  const payload: unknown = await request.json().catch(() => null);
  const validation = createOrganizationSchema.safeParse(payload);

  if (!validation.success) {
    return apiError("VALIDATION_ERROR", "Organization name is invalid", 400);
  }

  const { data: organizationId, error } = await supabase.rpc("create_first_organization", {
    organization_name: validation.data.name,
  });

  if (error) {
    logError({ action: "onboarding.organization.create", userId, error: error.code });

    if (error.code === "23505") {
      return apiError("ORGANIZATION_ALREADY_EXISTS", "The account is already onboarded", 409);
    }

    return apiError("ORGANIZATION_CREATION_FAILED", "Unable to create the organization", 500);
  }

  logInfo({ action: "onboarding.organization.created", userId, organizationId });
  return apiSuccess({ organizationId }, 201);
}
