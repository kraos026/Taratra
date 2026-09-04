import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  PilotFeedbackContext,
  PilotFeedbackRepository,
} from "../application/pilot-feedback-repository";
import type { PilotFeedbackInput, PilotFeedbackView } from "../application/pilot-feedback-schema";

export class PrismaPilotFeedbackRepository implements PilotFeedbackRepository {
  constructor(private readonly db: TransactionClient) {}

  async resolveContext(userId: string, companyId: string): Promise<PilotFeedbackContext | null> {
    const membership = await this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    if (!membership) return null;

    const company = await this.db.company.findFirst({
      where: { id: companyId, organizationId: membership.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!company) return null;

    const audit = await this.db.audit.findFirst({
      where: { companyId, organizationId: membership.organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true },
    });

    return {
      organizationId: membership.organizationId,
      companyId,
      auditId: audit?.id ?? null,
      executiveResultId: null,
      contextStatus: audit?.status === "completed" ? "AUDIT_COMPLETE" : "AUDIT_IN_PROGRESS",
    };
  }

  async find(userId: string, context: PilotFeedbackContext): Promise<PilotFeedbackView | null> {
    const row = context.auditId
      ? ((await this.db.pilotFeedback.findFirst({
          where: { userId, auditId: context.auditId, organizationId: context.organizationId },
        })) ?? (await this.findPreAuditFeedback(userId, context)))
      : await this.findPreAuditFeedback(userId, context);
    return row ? view(row) : null;
  }

  async save(
    userId: string,
    context: PilotFeedbackContext,
    input: PilotFeedbackInput,
  ): Promise<PilotFeedbackView> {
    const existing = context.auditId
      ? ((await this.db.pilotFeedback.findFirst({
          where: { userId, auditId: context.auditId, organizationId: context.organizationId },
          select: { id: true },
        })) ?? (await this.findPreAuditFeedback(userId, context, { id: true })))
      : await this.findPreAuditFeedback(userId, context, { id: true });
    const data = {
      organizationId: context.organizationId,
      companyId: context.companyId,
      auditId: context.auditId,
      executiveResultId: context.executiveResultId,
      userId,
      contextStatus: context.contextStatus,
      understandingScore: input.understandingScore,
      recommendationRelevanceScore: input.recommendationRelevanceScore,
      roiCredibilityScore: input.roiCredibilityScore,
      nextStepClarityScore: input.nextStepClarityScore,
      experienceScore: input.experienceScore,
      willingToPay: input.willingToPay,
      acceptablePrice: input.acceptablePrice,
      priceCurrency: input.priceCurrency,
      comment: input.comment || null,
    };
    const row = existing
      ? await this.db.pilotFeedback.update({ where: { id: existing.id }, data })
      : await this.db.pilotFeedback.create({ data });
    return view(row);
  }

  private findPreAuditFeedback(
    userId: string,
    context: PilotFeedbackContext,
    select?: { id: true },
  ) {
    return this.db.pilotFeedback.findFirst({
      where: {
        userId,
        companyId: context.companyId,
        auditId: null,
        organizationId: context.organizationId,
      },
      ...(select ? { select } : {}),
    });
  }
}

function view(row: {
  id: string;
  companyId: string;
  auditId: string | null;
  executiveResultId: string | null;
  contextStatus: string;
  understandingScore: number;
  recommendationRelevanceScore: number;
  roiCredibilityScore: number;
  nextStepClarityScore: number;
  experienceScore: number;
  willingToPay: string;
  acceptablePrice: { toNumber(): number } | null;
  priceCurrency: string | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PilotFeedbackView {
  return {
    id: row.id,
    companyId: row.companyId,
    auditId: row.auditId,
    executiveResultId: row.executiveResultId,
    contextStatus: row.contextStatus as PilotFeedbackView["contextStatus"],
    understandingScore: row.understandingScore,
    recommendationRelevanceScore: row.recommendationRelevanceScore,
    roiCredibilityScore: row.roiCredibilityScore,
    nextStepClarityScore: row.nextStepClarityScore,
    experienceScore: row.experienceScore,
    willingToPay: row.willingToPay as PilotFeedbackView["willingToPay"],
    acceptablePrice: row.acceptablePrice?.toNumber(),
    priceCurrency: row.priceCurrency ?? undefined,
    comment: row.comment ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
