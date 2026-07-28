import { NextResponse } from "next/server";
import {
  automationSpecificationIdSchema,
  specificationListSchema,
} from "@/modules/automation-specifications/application/automation-specification-schemas";
import { withAutomationSpecificationService } from "@/modules/automation-specifications/presentation/automation-specification-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationSpecificationIdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const result = await withAutomationSpecificationService((service) => service.generate(id.data));
  return result instanceof Response ? result : NextResponse.json({ data: result }, { status: 201 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = automationSpecificationIdSchema.safeParse((await params).id);
  const query = specificationListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!id.success || !query.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const result = await withAutomationSpecificationService((service) =>
    service.list(id.data, query.data),
  );
  return result instanceof Response ? result : NextResponse.json({ data: result });
}
