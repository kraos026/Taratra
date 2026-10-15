import { freePilotStop } from "@/modules/agent-workspace/application/free-pilot";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; missionId: string }> },
) {
  const { id, missionId } = await context.params;
  return freePilotStop(id, missionId, request);
}
