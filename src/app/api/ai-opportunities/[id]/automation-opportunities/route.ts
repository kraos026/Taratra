import { automationOpportunityIdSchema } from "@/modules/automation-opportunities/application/automation-opportunity-schemas";
import { withAutomationOpportunityService } from "@/modules/automation-opportunities/presentation/automation-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationOpportunityIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid AI opportunity snapshot id", 400);
  return withAutomationOpportunityService((service) =>
    service.detect(id.data).then((result) => apiSuccess(result, 201)),
  );
}
