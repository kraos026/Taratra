import { analysisIdSchema } from "@/modules/business-analysis/application/business-analysis-schemas";
import { withBusinessAnalysisService } from "@/modules/business-analysis/presentation/business-analysis-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = analysisIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid analysis id", 400);
  return withBusinessAnalysisService((service) => service.get(id.data).then(apiSuccess));
}
