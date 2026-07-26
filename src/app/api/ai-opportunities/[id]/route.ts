import { aiOpportunityIdSchema } from "@/modules/ai-opportunities/application/ai-opportunity-schemas";
import { withAiOpportunityService } from "@/modules/ai-opportunities/presentation/ai-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = aiOpportunityIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid snapshot id", 400);
  return withAiOpportunityService((service) => service.get(id.data).then(apiSuccess));
}
