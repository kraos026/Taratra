import {
  aiOpportunityIdSchema,
  aiOpportunityMutationSchema,
} from "@/modules/ai-opportunities/application/ai-opportunity-schemas";
import { withAiOpportunityService } from "@/modules/ai-opportunities/presentation/ai-opportunity-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = aiOpportunityIdSchema.safeParse((await params).id);
  const body = aiOpportunityMutationSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid rebuild request", 400);
  return withAiOpportunityService((service) =>
    service.rebuild(id.data, body.data.lockVersion).then((result) => apiSuccess(result, 201)),
  );
}
