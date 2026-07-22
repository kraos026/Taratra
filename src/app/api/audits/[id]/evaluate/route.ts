import { idSchema } from "@/modules/rules/application/rule-schemas";
import { ruleValidationError, withRuleService } from "@/modules/rules/presentation/rule-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type Context = { params: Promise<{ id: string }> };
export async function POST(_: Request, context: Context) {
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return ruleValidationError();
  return withRuleService("audits.evaluate", (service) =>
    service.evaluate(id.data).then(apiSuccess),
  );
}
