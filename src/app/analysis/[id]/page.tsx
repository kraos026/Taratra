import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PrismaBusinessAnalysisRepository } from "@/modules/business-analysis/infrastructure/prisma-business-analysis-repository";
import { BusinessFindingsExplorer } from "@/modules/business-analysis/presentation/business-findings-explorer";

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();
  const detail = await withAuthenticatedDatabase(userId, async (db) => {
    const repository = new PrismaBusinessAnalysisRepository(db);
    const context = await repository.context(userId);
    return context ? repository.detail(context.organizationId, id) : null;
  });
  if (!detail) notFound();
  return (
    <BusinessFindingsExplorer
      findings={detail.findings.map((finding) => ({
        ...finding,
        confidencePercentage: Number(finding.confidencePercentage),
      }))}
      scores={detail.scores.map((score) => ({ ...score, score: Number(score.score) }))}
      health={detail.health.map((item) => ({ ...item, score: Number(item.score) }))}
    />
  );
}
