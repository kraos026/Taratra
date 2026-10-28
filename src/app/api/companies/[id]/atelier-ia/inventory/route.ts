import { loadCompanyInventory } from "@/modules/agent-workspace/application/agent-inventory";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return loadCompanyInventory((await context.params).id);
}
