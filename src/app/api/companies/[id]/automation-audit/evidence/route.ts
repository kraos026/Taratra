import { z } from "zod";
import {
  type TransactionClient,
  withAuthenticatedDatabase,
} from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { DurableAuditWorkflowService } from "@/modules/company-intake/application/durable-audit-workflow";
import { ProductionEvidenceIngestionService } from "@/modules/company-intake/application/production-evidence-ingestion";
import { PrismaDurableAuditWorkflowRepository } from "@/modules/company-intake/infrastructure/prisma-durable-audit-workflow-repository";
import { PrismaProductionEvidenceIngestionRepository } from "@/modules/company-intake/infrastructure/prisma-production-evidence-ingestion-repository";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

const structuredSchema = z.object({
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  units: z.record(z.string(), z.string()).optional(),
  timestamps: z.array(z.string()).optional(),
});

const provideEvidenceSchema = z
  .object({
    requestId: z.string().min(1),
    sourceId: z.string().min(1).max(160),
    sourceVersion: z.number().int().positive(),
    sourceType: z.enum([
      "DOCUMENT",
      "SOP",
      "SPREADSHEET",
      "CSV_EXPORT",
      "SYSTEM_EXPORT",
      "EMAIL",
      "REPORT",
      "SCREENSHOT",
      "PROCESS_EVIDENCE",
      "OTHER",
    ]),
    rawContent: z.string().max(250_000).optional(),
    structured: structuredSchema.optional(),
    origin: z.string().min(1).max(500),
    authorOrSystem: z.string().max(160).optional(),
    receivedAt: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .refine((value) => value.rawContent?.trim() || value.structured, {
    message: "Raw content or structured evidence is required",
  });

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

    const body = provideEvidenceSchema.safeParse(await request.json());
    if (!body.success) return apiError("VALIDATION_ERROR", "Invalid evidence payload", 400);

    const workflowRepository = new PrismaDurableAuditWorkflowRepository(db);
    const ingestionRepository = new PrismaProductionEvidenceIngestionRepository(db);
    const result = await new DurableAuditWorkflowService(workflowRepository).provideEvidence({
      tenantId,
      companyId: id,
      requestId: body.data.requestId,
      ingestion: new ProductionEvidenceIngestionService(ingestionRepository),
      command: {
        tenantId,
        companyId: id,
        sourceId: body.data.sourceId,
        sourceVersion: body.data.sourceVersion,
        sourceType: body.data.sourceType,
        rawContent: body.data.rawContent,
        structured: body.data.structured,
        origin: body.data.origin,
        authorOrSystem: body.data.authorOrSystem,
        receivedAt: body.data.receivedAt ? new Date(body.data.receivedAt) : new Date(),
        metadata: body.data.metadata,
      },
    });
    return apiSuccess(result, result.duplicate ? 200 : 201);
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
    where: { id: companyId, organizationId: membership.organizationId, deletedAt: null },
    select: { id: true },
  });
  return company ? membership.organizationId : null;
}
