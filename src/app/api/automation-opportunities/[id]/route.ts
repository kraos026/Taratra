import { automationOpportunityIdSchema } from "@/modules/automation-opportunities/application/automation-opportunity-schemas";
import { withAutomationOpportunityService } from "@/modules/automation-opportunities/presentation/automation-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationOpportunityIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid automation snapshot id", 400);
  return withAutomationOpportunityService((service) => service.get(id.data).then(apiSuccess));
}
