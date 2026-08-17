import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { ExecutiveResultService } from "@/modules/executive-results/application/executive-result-service";
import { PrismaExecutiveResultRepository } from "@/modules/executive-results/infrastructure/prisma-executive-result-repository";
import { unavailablePatronDecisionCenter } from "@/modules/company-intake/application/patron-decision-center";
import { PatronDecisionCenterView } from "@/modules/company-intake/presentation/patron-decision-center-view";

export default async function DecisionCenterPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();

  const result = await withAuthenticatedDatabase(userId, (db) =>
    new ExecutiveResultService(new PrismaExecutiveResultRepository(db), userId).get(id),
  );
  if (!result) notFound();

  return (
    <PatronDecisionCenterView
      center={unavailablePatronDecisionCenter(result.company.id, result.company.name)}
    />
  );
}
