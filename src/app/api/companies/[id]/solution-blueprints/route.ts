import { NextResponse } from "next/server";
import {
  solutionBlueprintIdSchema,
  solutionBlueprintListSchema,
} from "@/modules/solution-designer/application/solution-blueprint-schemas";
import { withSolutionBlueprintService } from "@/modules/solution-designer/presentation/solution-blueprint-api";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = solutionBlueprintIdSchema.safeParse((await params).id);
  const url = new URL(request.url);
  const query = solutionBlueprintListSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!id.success || !query.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await withSolutionBlueprintService((service) => service.list(id.data, query.data));
  return result instanceof Response ? result : NextResponse.json({ data: result });
}
