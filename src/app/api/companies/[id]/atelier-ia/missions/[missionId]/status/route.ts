import { observeCompanyMission } from "@/modules/agent-workspace/application/mission-monitoring";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; missionId: string }> },
) {
  const { id, missionId } = await params;
  return observeCompanyMission(id, missionId);
}
