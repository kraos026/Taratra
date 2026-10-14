import { listCompanyMissions } from "@/modules/agent-workspace/application/mission-monitoring";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return listCompanyMissions((await params).id);
}
