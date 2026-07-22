import {
  companyInputSchema,
  companyListQuerySchema,
} from "@/modules/companies/application/company-schemas";
import { validationError, withCompanyService } from "@/modules/companies/presentation/company-api";
import { apiSuccess } from "@/shared/presentation/api-response";

export async function GET(request: Request) {
  const query = companyListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return validationError("Invalid company filters");

  return withCompanyService("companies.list", async (service) =>
    apiSuccess(await service.list(query.data)),
  );
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const input = companyInputSchema.safeParse(payload);
  if (!input.success) return validationError("Invalid company data");

  return withCompanyService("companies.create", async (service) =>
    apiSuccess(await service.create(input.data), 201),
  );
}
