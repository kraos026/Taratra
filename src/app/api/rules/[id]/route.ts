import { idSchema, ruleUpdateSchema } from "@/modules/rules/application/rule-schemas";
import { ruleValidationError, withRuleService } from "@/modules/rules/presentation/rule-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  const id = idSchema.safeParse((await context.params).id);
  const input = ruleUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success)
    return ruleValidationError(input.success ? undefined : input.error.issues[0]?.message);
  return withRuleService("rules.update", (service) =>
    service.update(id.data, input.data).then(apiSuccess),
  );
}
