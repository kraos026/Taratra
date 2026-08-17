import { z } from "zod";
import { withAuthenticatedDatabase } from "@/infrastructure/database/with-authenticated-database";
import { createClient } from "@/infrastructure/supabase/server";
import { AskAutomateXService } from "@/modules/company-intake/application/ask-automatex";
import { PrismaAskAutomateXReadModel } from "@/modules/company-intake/infrastructure/prisma-ask-automatex-read-model";
import { logError, logInfo } from "@/shared/infrastructure/logger";
import { apiError, apiSuccess } from "@/shared/presentation/api-response";

const intentTypes = [
  "WHY_DECISION",
  "WHY_NOT_AUTOMATE",
  "WHY_AUTOMATE",
  "WHAT_IS_WRONG",
  "WHAT_DO_WE_KNOW",
  "WHAT_DO_WE_BELIEVE",
  "WHAT_IS_UNKNOWN",
  "SHOW_EVIDENCE",
  "SHOW_CONTRADICTIONS",
  "WHAT_IS_MISSING",
  "WHAT_SHOULD_WE_FIX_FIRST",
  "WHAT_SHOULD_WE_DO_NEXT",
  "WHY_THIS_PRIORITY",
  "WHAT_ARE_THE_ALTERNATIVES",
  "COMPARE_STRATEGIES",
  "WHAT_WOULD_CHANGE_THE_DECISION",
  "IS_IT_ECONOMICALLY_JUSTIFIED",
  "WHAT_IF_EVIDENCE_CHANGES",
  "EXPLAIN_TERM",
  "OTHER_BOUNDED_AUDIT_QUESTION",
] as const;

const targetEntityTypes = [
  "DECISION_CARD",
  "OPPORTUNITY",
  "STRATEGY",
  "ECONOMICS",
  "PROCESS_NODE",
  "TERM",
  "COMPANY_AUDIT",
  "UNKNOWN",
] as const;

const askSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  context: z
    .object({
      decisionCardId: z.string().min(1).max(200).optional(),
      opportunityId: z.string().min(1).max(200).optional(),
      strategyCandidateId: z.string().min(1).max(200).optional(),
      economicResultId: z.string().min(1).max(200).optional(),
      processNodeId: z.string().min(1).max(200).optional(),
      previousIntent: z
        .object({
          intentType: z.enum(intentTypes),
          targetEntityType: z.enum(targetEntityTypes),
          targetEntityId: z.string().max(200).nullable(),
          requestedPerspective: z.enum([
            "EXECUTIVE",
            "EVIDENCE",
            "ECONOMIC",
            "STRATEGY",
            "PROCESS",
          ]),
          requestedEvidenceDepth: z.enum(["SUMMARY", "DETAILED"]),
          language: z.enum(["en", "fr"]),
          ambiguity: z.enum(["NONE", "RESOLVED_FROM_CONTEXT", "CLARIFICATION_REQUIRED"]),
        })
        .optional(),
      previousBrainRunId: z.string().min(1).max(300).optional(),
    })
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await parseJson(request);
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid Ask AutomateX request", 400);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return apiError("UNAUTHENTICATED", "Authentication required", 401);

  try {
    const response = await withAuthenticatedDatabase(userId, async (db) => {
      const membership = await db.organizationMember.findFirst({
        where: { userId },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" },
      });
      if (!membership) return { kind: "forbidden" as const };

      const company = await db.company.findFirst({
        where: { id, organizationId: membership.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!company) return { kind: "not-found" as const };

      logInfo({
        action: "ask_automatex_question",
        userId,
        organizationId: membership.organizationId,
        companyId: id,
      });

      const answer = await new AskAutomateXService(new PrismaAskAutomateXReadModel(db)).ask({
        tenantId: membership.organizationId,
        companyId: id,
        userId,
        question: parsed.data.question,
        context: parsed.data.context,
      });

      logInfo({
        action:
          answer.answerStatus === "OUT_OF_SCOPE"
            ? "ask_automatex_out_of_scope"
            : answer.answerStatus === "PROVIDER_FALLBACK"
              ? "ask_automatex_fallback"
              : "ask_automatex_answered",
        userId,
        organizationId: membership.organizationId,
        companyId: id,
        answerStatus: answer.answerStatus,
      });

      return { kind: "ok" as const, answer };
    });

    if (response.kind === "forbidden") return apiError("FORBIDDEN", "Tenant context required", 403);
    if (response.kind === "not-found")
      return apiError("COMPANY_NOT_FOUND", "Company not found", 404);
    return apiSuccess(response.answer);
  } catch (caught) {
    logError({
      action: "ask_automatex_failed",
      userId,
      companyId: id,
      error: caught instanceof Error ? caught.message : "unknown",
    });
    return apiError("INTERNAL_ERROR", "Unexpected error", 500);
  }
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
