import {
  idSchema,
  moveInputSchema,
  sectionInputSchema,
} from "@/modules/questionnaires/application/questionnaire-schemas";
import { z } from "zod";
import {
  questionnaireValidationError,
  withQuestionnaireService,
} from "@/modules/questionnaires/presentation/questionnaire-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string }> };
export async function PATCH(r: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id),
    input = z
      .union([moveInputSchema, sectionInputSchema.partial()])
      .safeParse(await r.json().catch(() => null));
  if (!id.success || !input.success) return questionnaireValidationError();
  return withQuestionnaireService("questionnaireSections.update", (s) =>
    ("operation" in input.data
      ? s.moveSection(id.data, input.data.position)
      : s.updateSection(id.data, input.data)
    ).then(apiSuccess),
  );
}
export async function DELETE(_: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id);
  if (!id.success) return questionnaireValidationError();
  return withQuestionnaireService("questionnaireSections.delete", (s) =>
    s.deleteSection(id.data).then(apiSuccess),
  );
}
