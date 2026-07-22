import { answerSchema } from "@/modules/audits/application/audit-schemas";
import { auditValidationError, withAuditService } from "@/modules/audits/presentation/audit-api";
import { idSchema } from "@/modules/questionnaires/application/questionnaire-schemas";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string; questionId: string }> };
export async function PUT(r: Request, c: C) {
  const p = await c.params,
    id = idSchema.safeParse(p.id),
    question = idSchema.safeParse(p.questionId),
    input = answerSchema.safeParse(await r.json().catch(() => null));
  if (!id.success || !question.success || !input.success) return auditValidationError();
  return withAuditService("audits.answers.upsert", (s) =>
    s.answer(id.data, question.data, input.data.value).then(apiSuccess),
  );
}
