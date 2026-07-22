import {
  companyIdSchema,
  companyUpdateSchema,
} from "@/modules/companies/application/company-schemas";
import { validationError, withCompanyService } from "@/modules/companies/presentation/company-api";
import { apiSuccess } from "@/shared/presentation/api-response";

type RouteContext = { params: Promise<{ id: string }> };

async function validId(context: RouteContext): Promise<string | null> {
  const result = companyIdSchema.safeParse((await context.params).id);
  return result.success ? result.data : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await validId(context);
  if (!id) return validationError("Invalid company identifier");
  return withCompanyService("companies.get", async (service) => apiSuccess(await service.get(id)));
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await validId(context);
  if (!id) return validationError("Invalid company identifier");
  const payload: unknown = await request.json().catch(() => null);
  const input = companyUpdateSchema.safeParse(payload);
  if (!input.success) return validationError("Invalid company data");
  return withCompanyService("companies.update", async (service) =>
    apiSuccess(await service.update(id, input.data)),
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await validId(context);
  if (!id) return validationError("Invalid company identifier");
  return withCompanyService("companies.delete", async (service) => {
    await service.permanentlyDelete(id);
    return apiSuccess({ id });
  });
}
