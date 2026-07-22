import {
  idSchema,
  questionInputSchema,
} from "@/modules/questionnaires/application/questionnaire-schemas";
import {
  questionnaireValidationError,
  withQuestionnaireService,
} from "@/modules/questionnaires/presentation/questionnaire-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string }> };
export async function POST(r: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id),
    input = questionInputSchema.safeParse(await r.json().catch(() => null));
  if (!id.success || !input.success) return questionnaireValidationError();
  return withQuestionnaireService("questionnaireQuestions.create", (s) =>
    s.addQuestion(id.data, input.data).then((v) => apiSuccess(v, 201)),
  );
}
