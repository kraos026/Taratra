import {
  automationOpportunityIdSchema,
  automationOpportunityMutationSchema,
} from "@/modules/automation-opportunities/application/automation-opportunity-schemas";
import { withAutomationOpportunityService } from "@/modules/automation-opportunities/presentation/automation-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationOpportunityIdSchema.safeParse((await params).id);
  const body = automationOpportunityMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid validation request", 400);
  return withAutomationOpportunityService((service) =>
    service.validate(id.data, body.data.lockVersion).then(apiSuccess),
  );
}
