import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
export class PrismaRecommendationRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  audit(organizationId: string, auditId: string) {
    return this.db.audit.findFirst({ where: { id: auditId, organizationId, deletedAt: null } });
  }
  profile(organizationId: string, id: string) {
    return this.db.roiProfile.findFirst({
      where: { id, active: true, OR: [{ organizationId: null }, { organizationId }] },
    });
  }
  profiles(organizationId: string) {
    return this.db.roiProfile.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ organizationId: "desc" }, { name: "asc" }],
    });
  }
  createProfile(
    organizationId: string,
    input: {
      code: string;
      name: string;
      currency: string;
      hourlyCost: number;
      workingDaysYear: number;
      workingHoursDay: number;
      active: boolean;
    },
  ) {
    return this.db.roiProfile.create({ data: { ...input, organizationId } });
  }
  updateProfile(organizationId: string, id: string, input: Record<string, unknown>) {
    return this.db.roiProfile.update({ where: { id, organizationId }, data: input });
  }
  candidates(organizationId: string, auditId: string) {
    return this.db.auditRuleMatch.findMany({
      where: { organizationId, auditId, matched: true },
      include: {
        rule: {
          include: {
            recommendations: {
              where: { active: true },
              include: { recommendation: { include: { impact: true } } },
              orderBy: { priority: "asc" },
            },
          },
        },
      },
    });
  }
  results(organizationId: string, auditId: string) {
    return this.db.auditRecommendation.findMany({
      where: { organizationId, auditId },
      include: { recommendation: { include: { category: true } } },
      orderBy: [{ roiPercentage: "desc" }, { estimatedHoursYear: "desc" }],
    });
  }
  async store(
    organizationId: string,
    auditId: string,
    evaluationId: string,
    items: readonly {
      id: string;
      priority: string;
      hoursYear: number;
      annualSavings: number;
      roiPercentage: number;
      implementationCost: number;
      paybackMonths: number | null;
      quickWin: boolean;
      strategic: boolean;
      code: string;
      rulePriority: number;
    }[],
  ) {
    await this.db.auditRecommendation.deleteMany({ where: { organizationId, auditId } });
    if (items.length)
      await this.db.auditRecommendation.createMany({
        data: items.map((i) => ({
          organizationId,
          auditId,
          recommendationId: i.id,
          evaluationId,
          priority: i.priority,
          estimatedHoursYear: i.hoursYear,
          estimatedSavingsYear: i.annualSavings,
          roiPercentage: Number.isFinite(i.roiPercentage) ? i.roiPercentage : 999999999,
          implementationCost: i.implementationCost,
          paybackMonths: i.paybackMonths,
          quickWin: i.quickWin,
          strategic: i.strategic,
          metadataJson: {
            formulaVersion: "mvp-v1",
            rulePriority: i.rulePriority,
          } as Prisma.InputJsonValue,
        })),
      });
  }
}
