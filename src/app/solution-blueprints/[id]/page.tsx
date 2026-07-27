import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { SolutionBlueprintView } from "@/modules/solution-designer/presentation/solution-blueprint-view";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();
  const blueprint = await withAuthenticatedDatabase(userId, async (db) => {
    const membership = await db.organizationMember.findFirst({ where: { userId } });
    return membership
      ? db.solutionBlueprint.findFirst({ where: { id, organizationId: membership.organizationId } })
      : null;
  });
  if (!blueprint) notFound();
  return <SolutionBlueprintView blueprint={blueprint} />;
}
