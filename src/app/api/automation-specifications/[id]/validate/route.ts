import { NextResponse } from "next/server";
import {
  automationSpecificationIdSchema,
  specificationTransitionSchema,
} from "@/modules/automation-specifications/application/automation-specification-schemas";
import { withAutomationSpecificationService } from "@/modules/automation-specifications/presentation/automation-specification-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationSpecificationIdSchema.safeParse((await params).id);
  const body = specificationTransitionSchema.safeParse(await request.json());
  if (!id.success || !body.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await withAutomationSpecificationService((service) =>
    service.validate(id.data, body.data.lockVersion),
  );
  return result instanceof Response ? result : NextResponse.json({ data: result });
}
