import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
export class PrismaReportRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
  }
  load(organizationId: string, auditId: string) {
    return this.db.audit.findFirst({
      where: { id: auditId, organizationId, deletedAt: null },
      include: {
        organization: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        answers: { include: { question: { select: { code: true } } } },
        scores: { include: { category: { select: { name: true } } } },
        ruleMatches: { include: { rule: { select: { categoryId: true } } } },
        recommendations: {
          include: { recommendation: { include: { category: { select: { name: true } } } } },
        },
      },
    });
  }
}
