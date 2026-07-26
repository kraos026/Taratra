import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PrismaRoiEvaluationRepository } from "@/modules/roi-evaluations/infrastructure/prisma-roi-evaluation-repository";
import { RoiExplorer } from "@/modules/roi-evaluations/presentation/roi-explorer";
export default async function RoiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();
  const detail = await withAuthenticatedDatabase(userId, async (db) => {
    const repo = new PrismaRoiEvaluationRepository(db),
      context = await repo.context(userId);
    return context ? repo.detail(context.organizationId, id) : null;
  });
  if (!detail) notFound();
  return (
    <RoiExplorer
      currency={detail.snapshot.currency}
      scenarios={detail.scenarios}
      evaluations={detail.evaluations.map((item) => ({
        ...item,
        confidence: Number(item.confidence),
      }))}
      metrics={detail.metrics.map((item) => ({
        ...item,
        value: item.value === null ? null : Number(item.value),
      }))}
    />
  );
}
