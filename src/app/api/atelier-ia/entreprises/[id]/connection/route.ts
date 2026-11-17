import { readAgentCompanyRuntime } from "@/modules/agent-workspace/application/agent-company-runtime";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return readAgentCompanyRuntime((await context.params).id, "connection");
}
