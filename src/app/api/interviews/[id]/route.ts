import { interviewIdSchema } from "@/modules/interviews/application/interview-schemas";
import { withInterviewService } from "@/modules/interviews/presentation/interview-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = interviewIdSchema.safeParse((await params).id);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid interview id", 400);
  return withInterviewService((service) => service.view(parsed.data).then(apiSuccess));
}
