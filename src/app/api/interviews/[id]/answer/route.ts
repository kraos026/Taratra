import {
  interviewAnswerSchema,
  interviewIdSchema,
} from "@/modules/interviews/application/interview-schemas";
import { withInterviewService } from "@/modules/interviews/presentation/interview-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = interviewIdSchema.safeParse((await params).id);
  const input = interviewAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success)
    return apiError("VALIDATION_ERROR", "Invalid interview answer", 400);
  const write = await withInterviewService((service) =>
    service.persistAnswer(
      id.data,
      input.data.lockVersion,
      input.data.questionId,
      input.data.value,
      input.data.confidence,
    ),
  );
  if (write instanceof Response) return write;
  return withInterviewService((service) => service.refreshAnswerProgress(id.data).then(apiSuccess));
}
