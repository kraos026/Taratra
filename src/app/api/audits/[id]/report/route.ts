import { withReportService } from "@/modules/reports/presentation/report-api";
import { reportIdSchema } from "@/modules/reports/application/report-schema";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!reportIdSchema.safeParse(id).success)
    return apiError("VALIDATION_ERROR", "Invalid audit id", 400);
  return withReportService((service) => service.get(id).then(apiSuccess));
}
