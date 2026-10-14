import {
  companyIdSchema,
  companyListQuerySchema,
} from "@/modules/companies/application/company-schemas";
import { withCompanyService } from "@/modules/companies/presentation/company-api";
import { agentLabEnabled } from "./agent-workspace-policy";

export async function loadAgentCompany(id: string) {
  if (!agentLabEnabled() || !companyIdSchema.safeParse(id).success)
    return new Response(null, { status: 404 });
  return withCompanyService("agent-workspace.company.read", async (service) => {
    const company = await service.get(id);
    if (company.id !== id || company.deletedAt || company.status === "archived")
      return new Response(null, { status: 404 });
    const permissions = await service.permissions();
    return { id: company.id, name: company.name, canWrite: permissions.canWrite };
  });
}

export async function loadAgentCompanies(page: number) {
  if (!agentLabEnabled()) return new Response(null, { status: 404 });
  const query = companyListQuerySchema.parse({
    page,
    pageSize: 20,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });
  return withCompanyService("agent-workspace.company.list", async (service) => {
    const result = await service.list(query);
    return {
      page: result.page,
      totalPages: result.totalPages,
      companies: result.items.map((company) => ({ id: company.id, name: company.name })),
    };
  });
}
