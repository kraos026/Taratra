import { NextResponse } from "next/server";
import {
  solutionBlueprintIdSchema,
  solutionBlueprintMutationSchema,
} from "@/modules/solution-designer/application/solution-blueprint-schemas";
import { withSolutionBlueprintService } from "@/modules/solution-designer/presentation/solution-blueprint-api";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = solutionBlueprintIdSchema.safeParse((await params).id);
  const body = solutionBlueprintMutationSchema.safeParse(await request.json());
  if (!id.success || !body.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await withSolutionBlueprintService((service) =>
    service.validate(id.data, body.data.lockVersion),
  );
  return result instanceof Response ? result : NextResponse.json({ data: result });
}
