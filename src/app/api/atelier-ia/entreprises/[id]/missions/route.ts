import { freePilotCreate, freePilotRead } from "@/modules/agent-workspace/application/free-pilot";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return freePilotRead((await context.params).id, "missions");
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return freePilotCreate((await context.params).id, request);
}
