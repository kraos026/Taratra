import { dispatchWorkspaceMission } from "@/modules/agent-workspace/application/universal-dispatch";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return dispatchWorkspaceMission((await context.params).id, request);
}
