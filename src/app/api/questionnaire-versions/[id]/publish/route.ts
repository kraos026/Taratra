import { idSchema } from "@/modules/questionnaires/application/questionnaire-schemas";
import {
  questionnaireValidationError,
  withQuestionnaireService,
} from "@/modules/questionnaires/presentation/questionnaire-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string }> };
export async function POST(_: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id);
  if (!id.success) return questionnaireValidationError();
  return withQuestionnaireService("questionnaireVersions.publish", (s) =>
    s.publishVersion(id.data).then(apiSuccess),
  );
}
