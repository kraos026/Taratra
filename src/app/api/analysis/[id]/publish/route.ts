import {
  analysisIdSchema,
  analysisMutationSchema,
} from "@/modules/business-analysis/application/business-analysis-schemas";
import { withBusinessAnalysisService } from "@/modules/business-analysis/presentation/business-analysis-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = analysisIdSchema.safeParse((await params).id);
  const body = analysisMutationSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success)
    return apiError("VALIDATION_ERROR", "Invalid publication request", 400);
  return withBusinessAnalysisService((service) =>
    service.publish(id.data, body.data.lockVersion).then(apiSuccess),
  );
}
