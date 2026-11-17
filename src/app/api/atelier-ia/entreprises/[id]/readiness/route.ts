import { freePilotRead } from "@/modules/agent-workspace/application/free-pilot";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return freePilotRead((await context.params).id, "readiness");
}
