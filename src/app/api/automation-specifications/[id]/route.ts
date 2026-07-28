import { NextResponse } from "next/server";
import { automationSpecificationIdSchema } from "@/modules/automation-specifications/application/automation-specification-schemas";
import { withAutomationSpecificationService } from "@/modules/automation-specifications/presentation/automation-specification-api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationSpecificationIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const result = await withAutomationSpecificationService((service) => service.get(id.data));
  return result instanceof Response ? result : NextResponse.json({ data: result });
}
