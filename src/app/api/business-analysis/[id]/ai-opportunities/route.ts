import { aiOpportunityIdSchema } from "@/modules/ai-opportunities/application/ai-opportunity-schemas";
import { withAiOpportunityService } from "@/modules/ai-opportunities/presentation/ai-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = aiOpportunityIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid analysis id", 400);
  return withAiOpportunityService((service) =>
    service.detect(id.data).then((result) => apiSuccess(result, 201)),
  );
}
