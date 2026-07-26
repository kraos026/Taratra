import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PrismaRecommendationPortfolioRepository } from "@/modules/recommendation-portfolios/infrastructure/prisma-recommendation-portfolio-repository";
import { ExecutiveRoadmap } from "@/modules/recommendation-portfolios/presentation/executive-roadmap";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    supabase = await createClient(),
    { data } = await supabase.auth.getClaims(),
    userId = data?.claims?.sub;
  if (!userId) notFound();
  const detail = await withAuthenticatedDatabase(userId, async (db) => {
    const repo = new PrismaRecommendationPortfolioRepository(db),
      context = await repo.context(userId);
    return context ? repo.detail(context.organizationId, id) : null;
  });
  if (!detail) notFound();
  return (
    <ExecutiveRoadmap
      recommendations={detail.recommendations.map((item) => ({
        ...item,
        priorityScore: Number(item.priorityScore),
        expectedRoi: item.expectedRoi === null ? null : Number(item.expectedRoi),
        confidence: Number(item.confidence),
        implementationCost: Number(item.implementationCost),
      }))}
    />
  );
}
