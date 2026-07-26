import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PrismaAiOpportunityRepository } from "@/modules/ai-opportunities/infrastructure/prisma-ai-opportunity-repository";
import { AiOpportunitiesExplorer } from "@/modules/ai-opportunities/presentation/ai-opportunities-explorer";
export default async function AiOpportunitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();
  const detail = await withAuthenticatedDatabase(userId, async (db) => {
    const repo = new PrismaAiOpportunityRepository(db);
    const context = await repo.context(userId);
    return context ? repo.detail(context.organizationId, id) : null;
  });
  if (!detail) notFound();
  return (
    <AiOpportunitiesExplorer
      opportunities={detail.opportunities.map((item) => ({
        ...item,
        confidence: Number(item.confidence),
        feasibility: Number(item.feasibility),
        businessImpact: Number(item.businessImpact),
        technicalComplexity: Number(item.technicalComplexity),
        dataReadiness: Number(item.dataReadiness),
        aiReadiness: Number(item.aiReadiness),
      }))}
      links={detail.capabilities}
      capabilities={detail.capabilityCatalog}
    />
  );
}
