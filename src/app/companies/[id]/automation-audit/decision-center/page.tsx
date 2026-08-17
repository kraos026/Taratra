import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PatronDecisionCenterService } from "@/modules/company-intake/application/patron-decision-center";
import { PrismaPatronDecisionCenterReadModel } from "@/modules/company-intake/infrastructure/prisma-patron-decision-center-read-model";
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

  const center = await withAuthenticatedDatabase(userId, (db) =>
    new PatronDecisionCenterService(new PrismaPatronDecisionCenterReadModel(db)).get({
      userId,
      companyId: id,
    }),
  );

  return <PatronDecisionCenterView center={center} />;
}
