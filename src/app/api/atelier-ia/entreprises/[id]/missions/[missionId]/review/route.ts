import { freePilotReview } from "@/modules/agent-workspace/application/free-pilot";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; missionId: string }> },
) {
  const { id, missionId } = await context.params;
  return freePilotReview(id, missionId, request);
}
