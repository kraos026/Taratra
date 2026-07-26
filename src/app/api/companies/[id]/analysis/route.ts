import {
  analysisIdSchema,
  analysisListSchema,
} from "@/modules/business-analysis/application/business-analysis-schemas";
import { withBusinessAnalysisService } from "@/modules/business-analysis/presentation/business-analysis-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = analysisIdSchema.safeParse((await params).id);
  const query = analysisListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!id.success || !query.success)
    return apiError("VALIDATION_ERROR", "Invalid analysis list request", 400);
  return withBusinessAnalysisService((service) =>
    service.list(id.data, query.data).then(apiSuccess),
  );
}
