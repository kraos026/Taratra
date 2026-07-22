import { auditUpdateSchema } from "@/modules/audits/application/audit-schemas";
import { auditValidationError, withAuditService } from "@/modules/audits/presentation/audit-api";
import { idSchema } from "@/modules/questionnaires/application/questionnaire-schemas";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string }> };
export async function GET(_: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id);
  if (!id.success) return auditValidationError();
  return withAuditService("audits.get", (s) => s.get(id.data).then(apiSuccess));
}
export async function PATCH(r: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id),
    input = auditUpdateSchema.safeParse(await r.json().catch(() => null));
  if (!id.success || !input.success) return auditValidationError();
  return withAuditService("audits.update", (s) => s.update(id.data, input.data).then(apiSuccess));
}
