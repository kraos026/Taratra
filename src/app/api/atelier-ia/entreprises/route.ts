import {
  createAgentCompany,
  listAgentCompanies,
} from "@/modules/agent-workspace/application/agent-companies";
export const dynamic = "force-dynamic";
export async function GET() {
  return listAgentCompanies();
}
export async function POST(request: Request) {
  return createAgentCompany(request);
}
