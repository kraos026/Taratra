import { loadAgentCompany } from "./agent-workspace-access";
import { readHermesInventory } from "../infrastructure/hermes-inventory-client";

export async function loadCompanyInventory(companyId: string) {
  const company = await loadAgentCompany(companyId);
  if (company instanceof Response) {
    company.headers.set("Cache-Control", "private, no-store");
    return company;
  }
  try {
    return Response.json(
      { data: await readHermesInventory(company.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: { message: "L’inventaire est indisponible." } },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
