import { readWorkspaceEngines } from "@/modules/agent-workspace/application/universal-dispatch";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return readWorkspaceEngines((await context.params).id);
}
