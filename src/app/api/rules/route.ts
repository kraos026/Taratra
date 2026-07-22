import { ruleInputSchema, ruleListSchema } from "@/modules/rules/application/rule-schemas";
import { ruleValidationError, withRuleService } from "@/modules/rules/presentation/rule-api";
import { apiSuccess } from "@/shared/presentation/api-response";
export async function GET(request: Request) {
  const query = ruleListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return ruleValidationError();
  return withRuleService("rules.list", (service) =>
    service.list(query.data.active).then(apiSuccess),
  );
}
export async function POST(request: Request) {
  const input = ruleInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return ruleValidationError(input.error.issues[0]?.message);
  return withRuleService("rules.create", (service) =>
    service.create(input.data).then((value) => apiSuccess(value, 201)),
  );
}
