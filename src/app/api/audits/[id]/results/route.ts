import { idSchema } from "@/modules/rules/application/rule-schemas";
import { ruleValidationError, withRuleService } from "@/modules/rules/presentation/rule-api";
import { apiSuccess } from "@/shared/presentation/api-response";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return ruleValidationError();
  return withRuleService("audits.results", (service) => service.results(id.data).then(apiSuccess));
}
