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
  const evidenceCounts = new Map<string, number>();
  for (const evidence of detail.evidence) {
    evidenceCounts.set(evidence.findingId, (evidenceCounts.get(evidence.findingId) ?? 0) + 1);
  }
  return (
    <BusinessFindingsExplorer
      findings={detail.findings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: finding.category,
        businessImpact: finding.businessImpact,
        confidencePercentage: Number(finding.confidencePercentage),
        evidenceCount: evidenceCounts.get(finding.id) ?? 0,
      }))}
      scores={detail.scores.map((score) => ({
        id: score.id,
        label: score.label,
        score: Number(score.score),
      }))}
      health={detail.health.map((item) => ({
        id: item.id,
        dimension: item.dimension,
        score: Number(item.score),
      }))}
      companyId={detail.analysis.companyId}
      validations={detail.validations.map(({ id, code, severity }) => ({ id, code, severity }))}
    />
  );
}
