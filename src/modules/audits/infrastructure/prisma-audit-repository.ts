import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
export class PrismaAuditRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  list(
    organizationId: string,
    q: {
      page: number;
      pageSize: number;
      companyId?: string;
      status?: "draft" | "in_progress" | "completed" | "validated" | "archived";
      sortBy: "createdAt" | "updatedAt" | "progressPercentage" | "status";
      sortOrder: "asc" | "desc";
    },
  ) {
    const where: Prisma.AuditWhereInput = {
      organizationId,
      deletedAt: null,
      ...(q.companyId ? { companyId: q.companyId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    return Promise.all([
      this.db.audit.findMany({
        where,
        include: { company: true, questionnaireVersion: { include: { template: true } } },
        orderBy: { [q.sortBy]: q.sortOrder },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.audit.count({ where }),
    ]);
  }
  get(organizationId: string, id: string) {
    return this.db.audit.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        company: true,
        answers: true,
        questionnaireVersion: {
          include: {
            template: true,
            sections: {
              orderBy: { position: "asc" },
              include: { questions: { orderBy: { position: "asc" } } },
            },
          },
        },
      },
    });
  }
  create(organizationId: string, input: { companyId: string; questionnaireVersionId: string }) {
    return this.db.audit.create({ data: { organizationId, ...input, status: "draft" } });
  }
  update(organizationId: string, id: string, data: { currentSectionId?: string | null }) {
    return this.db.audit.update({ where: { id, organizationId }, data });
  }
  findQuestion(auditId: string, questionId: string) {
    return this.db.questionnaireQuestion.findFirst({
      where: { id: questionId, section: { version: { audits: { some: { id: auditId } } } } },
    });
  }
  async upsertAnswer(
    organizationId: string,
    auditId: string,
    questionId: string,
    userId: string,
    value: unknown,
  ) {
    return this.db.auditAnswer.upsert({
      where: { auditId_questionId: { auditId, questionId } },
      create: {
        organizationId,
        auditId,
        questionId,
        answeredBy: userId,
        valueJson: value as Prisma.InputJsonValue,
      },
      update: { answeredBy: userId, valueJson: value as Prisma.InputJsonValue },
    });
  }
  async recalculate(organizationId: string, id: string) {
    const audit = await this.get(organizationId, id);
    if (!audit) return null;
    const total =
      audit.questionnaireVersion?.sections.reduce((sum, s) => sum + s.questions.length, 0) ?? 0;
    const answered = new Set(audit.answers.map((a) => a.questionId)).size;
    const progress = total === 0 ? 0 : Math.round((Math.min(answered, total) / total) * 100);
    return this.db.audit.update({
      where: { id, organizationId },
      data: {
        progressPercentage: progress,
        status: audit.status === "draft" ? "in_progress" : audit.status,
        startedAt: audit.startedAt ?? new Date(),
      },
    });
  }
  async complete(organizationId: string, id: string) {
    const audit = await this.get(organizationId, id);
    if (!audit) return null;
    const required =
      audit.questionnaireVersion?.sections.flatMap((s) => s.questions).filter((q) => q.required) ??
      [];
    const answered = new Set(audit.answers.map((a) => a.questionId));
    if (required.some((q) => !answered.has(q.id))) return false;
    return this.db.audit.update({
      where: { id, organizationId },
      data: { status: "completed", completedAt: new Date(), progressPercentage: 100 },
    });
  }
  validate(organizationId: string, id: string) {
    return this.db.audit.update({
      where: { id, organizationId },
      data: { status: "validated", validatedAt: new Date() },
    });
  }
  archive(organizationId: string, id: string) {
    return this.db.audit.update({
      where: { id, organizationId },
      data: { status: "archived", deletedAt: new Date() },
    });
  }
}
