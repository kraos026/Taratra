import {
  automationOpportunityIdSchema,
  automationOpportunityListSchema,
} from "@/modules/automation-opportunities/application/automation-opportunity-schemas";
import { withAutomationOpportunityService } from "@/modules/automation-opportunities/presentation/automation-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationOpportunityIdSchema.safeParse((await params).id);
  const url = new URL(request.url);
  const query = automationOpportunityListSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!id.success || !query.success)
    return apiError("VALIDATION_ERROR", "Invalid list request", 400);
  return withAutomationOpportunityService((service) =>
    service.list(id.data, query.data).then(apiSuccess),
  );
}
