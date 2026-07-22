import {
  idSchema,
  questionnaireUpdateSchema,
} from "@/modules/questionnaires/application/questionnaire-schemas";
import {
  questionnaireValidationError,
  withQuestionnaireService,
} from "@/modules/questionnaires/presentation/questionnaire-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string }> };
export async function GET(_: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id);
  if (!id.success) return questionnaireValidationError();
  return withQuestionnaireService("questionnaires.get", (s) => s.get(id.data).then(apiSuccess));
}
export async function PATCH(r: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id),
    input = questionnaireUpdateSchema.safeParse(await r.json().catch(() => null));
  if (!id.success || !input.success) return questionnaireValidationError();
  return withQuestionnaireService("questionnaires.update", (s) =>
    s.update(id.data, input.data).then(apiSuccess),
  );
}
