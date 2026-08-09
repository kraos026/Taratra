import { assistedAuditCompanyIdSchema } from "@/modules/assisted-audit/application/assisted-audit-schemas";
import { withAssistedAuditService } from "@/modules/assisted-audit/presentation/assisted-audit-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = assistedAuditCompanyIdSchema.safeParse((await params).id);
  if (!companyId.success) return apiError("VALIDATION_ERROR", "Invalid company id", 400);
  return withAssistedAuditService((service) => service.get(companyId.data).then(apiSuccess));
}
