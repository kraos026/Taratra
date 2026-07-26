import {
  interviewBackSchema,
  interviewIdSchema,
} from "@/modules/interviews/application/interview-schemas";
import { withInterviewService } from "@/modules/interviews/presentation/interview-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = interviewIdSchema.safeParse((await params).id);
  const input = interviewBackSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success)
    return apiError("VALIDATION_ERROR", "Invalid go back request", 400);
  return withInterviewService((service) =>
    service.goBack(id.data, input.data.lockVersion, input.data.questionId).then(apiSuccess),
  );
}
