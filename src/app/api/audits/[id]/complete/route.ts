import { auditValidationError, withAuditService } from "@/modules/audits/presentation/audit-api";
import { idSchema } from "@/modules/questionnaires/application/questionnaire-schemas";
import { apiSuccess } from "@/shared/presentation/api-response";
type C = { params: Promise<{ id: string }> };
export async function POST(_: Request, c: C) {
  const id = idSchema.safeParse((await c.params).id);
  if (!id.success) return auditValidationError();
  return withAuditService("audits.complete", (s) => s.complete(id.data).then(apiSuccess));
}
