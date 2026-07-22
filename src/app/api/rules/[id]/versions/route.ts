import { idSchema, ruleVersionInputSchema } from "@/modules/rules/application/rule-schemas";
import { ruleValidationError, withRuleService } from "@/modules/rules/presentation/rule-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const id = idSchema.safeParse((await context.params).id);
  const input = ruleVersionInputSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return ruleValidationError();
  return withRuleService("rules.createVersion", (service) =>
    service.createVersion(id.data, input.data).then((value) => apiSuccess(value, 201)),
  );
}
