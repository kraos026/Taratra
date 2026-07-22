import {
  questionnaireInputSchema,
  questionnaireListSchema,
} from "@/modules/questionnaires/application/questionnaire-schemas";
import {
  questionnaireValidationError,
  withQuestionnaireService,
} from "@/modules/questionnaires/presentation/questionnaire-api";
import { apiSuccess } from "@/shared/presentation/api-response";
export async function GET(request: Request) {
  const query = questionnaireListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return questionnaireValidationError("Invalid questionnaire filters");
  return withQuestionnaireService("questionnaires.list", (s) =>
    s.list(query.data).then(apiSuccess),
  );
}
export async function POST(request: Request) {
  const input = questionnaireInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return questionnaireValidationError("Invalid questionnaire data");
  return withQuestionnaireService("questionnaires.create", (s) =>
    s.create(input.data).then((v) => apiSuccess(v, 201)),
  );
}
