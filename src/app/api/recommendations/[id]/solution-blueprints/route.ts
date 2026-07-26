import { NextResponse } from "next/server";
import { solutionBlueprintIdSchema } from "@/modules/solution-designer/application/solution-blueprint-schemas";
import { withSolutionBlueprintService } from "@/modules/solution-designer/presentation/solution-blueprint-api";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = solutionBlueprintIdSchema.safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const result = await withSolutionBlueprintService((service) => service.generate(parsed.data));
  return result instanceof Response ? result : NextResponse.json({ data: result }, { status: 201 });
}
