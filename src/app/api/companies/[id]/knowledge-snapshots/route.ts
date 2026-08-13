import { companyKnowledgeIdSchema } from "@/modules/knowledge/application/knowledge-schemas";
import { withEnterpriseKnowledgeService } from "@/modules/knowledge/presentation/knowledge-api";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = companyKnowledgeIdSchema.safeParse((await params).id);
  if (!companyId.success) return apiError("VALIDATION_ERROR", "Invalid company id", 400);

  return withEnterpriseKnowledgeService(async (service) => {
    const result = await service.build(companyId.data);
    return apiSuccess(
      {
        id: result.snapshot.id,
        companyId: result.snapshot.companyId,
        status: result.snapshot.status,
        version: result.snapshot.version,
        created: result.created,
      },
      result.created ? 201 : 200,
    );
  });
}
