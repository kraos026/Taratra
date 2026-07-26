import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PrismaAutomationOpportunityRepository } from "@/modules/automation-opportunities/infrastructure/prisma-automation-opportunity-repository";
import { AutomationOpportunitiesExplorer } from "@/modules/automation-opportunities/presentation/automation-opportunities-explorer";
export default async function AutomationOpportunitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();
  const detail = await withAuthenticatedDatabase(userId, async (db) => {
    const repo = new PrismaAutomationOpportunityRepository(db);
    const context = await repo.context(userId);
    return context ? repo.detail(context.organizationId, id) : null;
  });
  if (!detail) notFound();
  return (
    <AutomationOpportunitiesExplorer
      opportunities={detail.opportunities.map((item) => ({
        ...item,
        businessImpact: Number(item.businessImpact),
        automationCoverage: Number(item.automationCoverage),
        technicalFeasibility: Number(item.technicalFeasibility),
        connectorAvailability: Number(item.connectorAvailability),
        automationReadiness: Number(item.automationReadiness),
        complexityScore: Number(item.complexityScore),
        confidence: Number(item.confidence),
      }))}
      connectors={detail.connectors}
      patterns={detail.patterns}
    />
  );
}
