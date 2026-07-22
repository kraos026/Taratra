import { companyIdSchema } from "@/modules/companies/application/company-schemas";
import { validationError, withCompanyService } from "@/modules/companies/presentation/company-api";
import { apiSuccess } from "@/shared/presentation/api-response";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = companyIdSchema.safeParse((await context.params).id);
  if (!id.success) return validationError("Invalid company identifier");
  return withCompanyService("companies.archive", async (service) =>
    apiSuccess(await service.archive(id.data)),
  );
}
