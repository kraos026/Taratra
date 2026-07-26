import {
  aiOpportunityIdSchema,
  aiOpportunityListSchema,
} from "@/modules/ai-opportunities/application/ai-opportunity-schemas";
import { withAiOpportunityService } from "@/modules/ai-opportunities/presentation/ai-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = aiOpportunityIdSchema.safeParse((await params).id);
  const query = aiOpportunityListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!id.success || !query.success)
    return apiError("VALIDATION_ERROR", "Invalid list request", 400);
  return withAiOpportunityService((service) => service.list(id.data, query.data).then(apiSuccess));
}
