import { notFound } from "next/navigation";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { ExecutiveResultService } from "@/modules/executive-results/application/executive-result-service";
import { PrismaExecutiveResultRepository } from "@/modules/executive-results/infrastructure/prisma-executive-result-repository";
import { ExecutiveResultView } from "@/modules/executive-results/presentation/executive-result-view";
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) notFound();
  const result = await withAuthenticatedDatabase(userId, (db) =>
    new ExecutiveResultService(new PrismaExecutiveResultRepository(db), userId).get(id),
  );
  if (!result) notFound();
  return <ExecutiveResultView result={result} />;
}
