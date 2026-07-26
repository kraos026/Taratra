import type { Prisma } from "@/generated/prisma/client";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { DiscoveryPayload } from "../application/discovery-schemas";
import { DiscoveryConflictError } from "../domain/discovery-errors";
export class PrismaDiscoveryRepository {
  constructor(private readonly db: TransactionClient) {}
  context(userId: string) {
    return this.db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
    });
  }
  company(organizationId: string, id: string) {
    return this.db.company.findFirst({ where: { id, organizationId, deletedAt: null } });
  }
  latest(organizationId: string, companyId: string) {
    return this.db.discoverySession.findFirst({
      where: { organizationId, companyId, status: { not: "archived" } },
      include: { answers: true },
      orderBy: { version: "desc" },
    });
  }
  session(organizationId: string, id: string) {
    return this.db.discoverySession.findFirst({
      where: { id, organizationId },
      include: { answers: true },
    });
  }
  create(organizationId: string, companyId: string, userId: string, version: number) {
    return this.db.discoverySession.create({
      data: { organizationId, companyId, startedBy: userId, version },
      include: { answers: true },
    });
  }
  async save(
    organizationId: string,
    id: string,
    userId: string,
    lockVersion: number,
    payload: DiscoveryPayload,
  ) {
    const changed = await this.db.discoverySession.updateMany({
      where: {
        id,
        organizationId,
        lockVersion,
        status: { in: ["draft", "in_progress", "completed"] },
      },
      data: {
        lockVersion: { increment: 1 },
        currentStep: payload.step,
        status: payload.step === "review" ? "completed" : "in_progress",
        completedAt: payload.step === "review" ? new Date() : undefined,
      },
    });
    if (changed.count !== 1) throw new DiscoveryConflictError();
    await this.db.discoveryAnswer.upsert({
      where: {
        discoverySessionId_fieldKey: {
          discoverySessionId: id,
          fieldKey: `discovery.${payload.step}`,
        },
      },
      create: {
        organizationId,
        discoverySessionId: id,
        step: payload.step,
        fieldKey: `discovery.${payload.step}`,
        valueJson: payload as Prisma.InputJsonValue,
        answeredBy: userId,
      },
      update: {
        step: payload.step,
        valueJson: payload as Prisma.InputJsonValue,
        answeredBy: userId,
      },
    });
    await this.materialize(organizationId, id, payload);
    return this.session(organizationId, id);
  }
  private async materialize(organizationId: string, sessionId: string, payload: DiscoveryPayload) {
    const session = await this.db.discoverySession.findFirstOrThrow({
      where: { id: sessionId, organizationId },
      select: { companyId: true },
    });
    const companyId = session.companyId;
    if (payload.step === "company")
      await this.db.companyProfile.upsert({
        where: { companyId },
        create: {
          companyId,
          organizationId,
          industry: payload.industry,
          countryCode: payload.countryCode,
          employeeCount: payload.employeeCount,
          metadataJson: { description: payload.description ?? null },
        },
        update: {
          industry: payload.industry,
          countryCode: payload.countryCode,
          employeeCount: payload.employeeCount,
          metadataJson: { description: payload.description ?? null },
        },
      });
    if (payload.step === "business") {
      await this.db.companyProfile.upsert({
        where: { companyId },
        create: {
          companyId,
          organizationId,
          businessModel: payload.businessModel,
          growthStage: payload.growthStage,
          revenueAmount: payload.revenueAmount,
          revenueCurrency: payload.revenueCurrency,
          revenueYear: payload.revenueYear,
        },
        update: {
          businessModel: payload.businessModel,
          growthStage: payload.growthStage,
          revenueAmount: payload.revenueAmount,
          revenueCurrency: payload.revenueCurrency,
          revenueYear: payload.revenueYear,
        },
      });
      await this.db.companyOffering.deleteMany({ where: { organizationId, companyId } });
      await this.db.companyObjective.deleteMany({ where: { organizationId, companyId } });
      await this.db.businessChallenge.deleteMany({ where: { organizationId, companyId } });
      if (payload.offerings.length)
        await this.db.companyOffering.createMany({
          data: payload.offerings.map((x) => ({
            ...x,
            organizationId,
            companyId,
            description: x.description ?? null,
          })),
        });
      if (payload.objectives.length)
        await this.db.companyObjective.createMany({
          data: payload.objectives.map((x) => ({
            ...x,
            organizationId,
            companyId,
            description: x.description ?? null,
            targetDate: x.targetDate ? new Date(x.targetDate) : null,
          })),
        });
      if (payload.challenges.length)
        await this.db.businessChallenge.createMany({
          data: payload.challenges.map((x) => ({
            ...x,
            organizationId,
            companyId,
            description: x.description ?? null,
          })),
        });
    }
    if (payload.step === "organization") {
      await this.db.companyRole.deleteMany({ where: { organizationId, companyId } });
      await this.db.department.deleteMany({ where: { organizationId, companyId } });
      const ids = new Map<string, string>();
      for (const x of payload.departments) {
        const d = await this.db.department.create({
          data: {
            organizationId,
            companyId,
            name: x.name,
            description: x.description ?? null,
            headcount: x.headcount,
          },
        });
        ids.set(x.clientId, d.id);
      }
      if (payload.roles.length)
        await this.db.companyRole.createMany({
          data: payload.roles.map((x) => ({
            organizationId,
            companyId,
            departmentId: x.departmentClientId ? ids.get(x.departmentClientId) : null,
            title: x.title,
            headcount: x.headcount,
            responsibilitiesJson: x.responsibilities,
          })),
        });
    }
    if (payload.step === "software") {
      await this.db.companySoftware.deleteMany({ where: { organizationId, companyId } });
      if (payload.items.length)
        await this.db.companySoftware.createMany({
          data: payload.items.map((x) => ({
            organizationId,
            companyId,
            customName: x.name,
            purpose: x.purpose ?? null,
            criticality: x.criticality,
            usersCount: x.usersCount,
          })),
        });
    }
    if (payload.step === "processes") {
      await this.db.businessProcess.deleteMany({ where: { organizationId, companyId } });
      const cats = await this.db.processCategory.findMany({
        where: {
          OR: [{ organizationId: null }, { organizationId }],
          code: { in: payload.items.map((x) => x.categoryCode) },
        },
      });
      const byCode = new Map(cats.map((x) => [x.code, x.id]));
      if (payload.items.length)
        await this.db.businessProcess.createMany({
          data: payload.items.map((x) => ({
            organizationId,
            companyId,
            categoryId: byCode.get(x.categoryCode),
            name: x.name,
            description: x.description ?? null,
            frequency: x.frequency,
            volume: x.volume,
            manualHoursMonth: x.manualHoursMonth,
            painPointsJson: x.painPoints,
          })),
        });
    }
  }
  validate(organizationId: string, id: string, userId: string) {
    return this.db.discoverySession.update({
      where: { id, organizationId },
      data: {
        status: "validated",
        validatedAt: new Date(),
        validatedBy: userId,
        lockVersion: { increment: 1 },
      },
      include: { answers: true },
    });
  }
  archive(organizationId: string, id: string) {
    return this.db.discoverySession.update({
      where: { id, organizationId },
      data: { status: "archived", archivedAt: new Date(), lockVersion: { increment: 1 } },
    });
  }
}
