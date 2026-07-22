import { auditCreateSchema, auditListSchema } from "@/modules/audits/application/audit-schemas";
import { auditValidationError, withAuditService } from "@/modules/audits/presentation/audit-api";
import { apiSuccess } from "@/shared/presentation/api-response";
export async function GET(r: Request) {
  const q = auditListSchema.safeParse(Object.fromEntries(new URL(r.url).searchParams));
  if (!q.success) return auditValidationError("Invalid audit filters");
  return withAuditService("audits.list", (s) => s.list(q.data).then(apiSuccess));
}
export async function POST(r: Request) {
  const input = auditCreateSchema.safeParse(await r.json().catch(() => null));
  if (!input.success) return auditValidationError("Invalid audit data");
  return withAuditService("audits.create", (s) =>
    s.create(input.data).then((v) => apiSuccess(v, 201)),
  );
}
