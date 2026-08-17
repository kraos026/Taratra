import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { PatronDecisionCenterService } from "@/modules/company-intake/application/patron-decision-center";
import { PrismaPatronDecisionCenterReadModel } from "@/modules/company-intake/infrastructure/prisma-patron-decision-center-read-model";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

export async function GET(_: Request, { params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  const decisionCenter = await withAuthenticatedDatabase(userId, (db) =>
    new PatronDecisionCenterService(new PrismaPatronDecisionCenterReadModel(db)).get({
      userId,
      companyId: id,
    }),
  );

  return apiSuccess({
    executiveDecisionView: decisionCenter.sourceView,
    explanations: decisionCenter.priorityCards
      .map((card) => card.explanation)
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    decisionCenter,
  });
}
