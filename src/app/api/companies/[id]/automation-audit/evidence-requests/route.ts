import { z } from "zod";
import {
  type TransactionClient,
  withAuthenticatedDatabase,
} from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { DurableAuditWorkflowService } from "@/modules/company-intake/application/durable-audit-workflow";
import { PrismaDurableAuditWorkflowRepository } from "@/modules/company-intake/infrastructure/prisma-durable-audit-workflow-repository";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

const createRequestSchema = z.object({
  target: z.enum(["SYSTEM_EVIDENCE", "KNOWLEDGE_DOCUMENT", "PROCESS_EVIDENCE"]),
  requestedEvidenceType: z.string().min(1).max(120),
  reason: z.string().min(1).max(500),
  gapId: z.string().min(1).max(160),
  actionId: z.string().min(1).max(160),
  authoritativeContext: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(_: Request, { params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticatedUserId();
  if (!auth) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  const result = await withAuthenticatedDatabase(auth, async (db) => {
    const tenantId = await tenantForCompany(db, auth, id);
    if (!tenantId) return null;
    const repository = new PrismaDurableAuditWorkflowRepository(db);
    return repository.listEvidenceRequests({ tenantId, companyId: id });
  });

  return result ? apiSuccess(result) : apiError("COMPANY_NOT_FOUND", "Company not found", 404);
}

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authenticatedUserId();
  if (!auth) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  return withAuthenticatedDatabase(auth, async (db) => {
    const tenantId = await tenantForCompany(db, auth, id);
    if (!tenantId) return apiError("COMPANY_NOT_FOUND", "Company not found", 404);

    const body = createRequestSchema.safeParse(await request.json());
    if (!body.success) return apiError("VALIDATION_ERROR", "Invalid evidence request", 400);

    const repository = new PrismaDurableAuditWorkflowRepository(db);
    const service = new DurableAuditWorkflowService(repository);
    const created = await service.requestEvidence({
      tenantId,
      companyId: id,
      target: body.data.target,
      requestedEvidenceType: body.data.requestedEvidenceType,
      reason: body.data.reason,
      gapId: body.data.gapId,
      actionId: body.data.actionId,
      requestedBy: auth,
      authoritativeContext: body.data.authoritativeContext ?? {},
    });
    return apiSuccess(created, 201);
  });
}

async function authenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}

async function tenantForCompany(
  db: TransactionClient,
  userId: string,
  companyId: string,
): Promise<string | null> {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  if (!membership) return null;
  const company = await db.company.findFirst({
    where: {
      id: companyId,
      organizationId: membership.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });
  return company ? membership.organizationId : null;
}
