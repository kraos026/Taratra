import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { ExecutiveResultService } from "@/modules/executive-results/application/executive-result-service";
import { PrismaExecutiveResultRepository } from "@/modules/executive-results/infrastructure/prisma-executive-result-repository";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);
  const result = await withAuthenticatedDatabase(userId, (db) =>
    new ExecutiveResultService(new PrismaExecutiveResultRepository(db), userId).get(id),
  );
  return result ? apiSuccess(result) : apiError("COMPANY_NOT_FOUND", "Company not found", 404);
}
