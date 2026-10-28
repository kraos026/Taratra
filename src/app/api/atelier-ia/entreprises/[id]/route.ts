import { linkAgentCompany } from "@/modules/agent-workspace/application/agent-companies";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return linkAgentCompany((await params).id, request);
}
