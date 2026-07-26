import { interviewIdSchema } from "@/modules/interviews/application/interview-schemas";
import { withInterviewService } from "@/modules/interviews/presentation/interview-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = interviewIdSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "Invalid interview id", 400);
  return withInterviewService((service) => service.validate(id.data).then(apiSuccess));
}
